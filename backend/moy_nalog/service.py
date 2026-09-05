"""Подключение аккаунта и идемпотентная выдача чеков."""

from __future__ import annotations

import logging
import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from .client import (
    MoyNalogClient,
    NpdAuthError,
    NpdError,
    NpdMaybeSent,
    NpdUnreachable,
    new_device_id,
)
from .crypto import decrypt_secret, encrypt_secret
from .models import MoyNalogAccount, NpdReceipt

logger = logging.getLogger(__name__)


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if digits.startswith("7") and len(digits) == 11:
        return digits
    if len(digits) == 10:
        return "7" + digits
    return digits


def normalize_inn(inn: str) -> str:
    return re.sub(r"\D+", "", inn or "")


def account_public_payload(account: MoyNalogAccount | None) -> dict:
    if not account:
        return {
            "connected": False,
            "enabled": False,
            "inn": "",
            "display_name": "",
            "phone": "",
            "connected_at": None,
            "last_error": "",
        }
    return {
        "connected": account.is_connected,
        "enabled": bool(account.enabled),
        "inn": account.inn or "",
        "display_name": account.display_name or "",
        "phone": account.phone or "",
        "connected_at": account.connected_at.isoformat() if account.connected_at else None,
        "last_error": account.last_error or "",
    }


def _client_from_account(account: MoyNalogAccount) -> MoyNalogClient:
    return MoyNalogClient(
        device_id=account.device_id,
        access_token=decrypt_secret(account.access_token_enc),
        refresh_token=decrypt_secret(account.refresh_token_enc),
        access_expires_at=account.access_expires_at,
    )


def _persist_tokens(account: MoyNalogAccount, client: MoyNalogClient, *, profile: dict | None = None) -> None:
    account.device_id = client.device_id
    account.access_token_enc = encrypt_secret(client.access_token)
    account.refresh_token_enc = encrypt_secret(client.refresh_token)
    account.access_expires_at = client.access_expires_at
    if profile:
        inn = normalize_inn(str(profile.get("inn") or profile.get("Inn") or ""))
        if inn:
            account.inn = inn
        name = (
            profile.get("displayName")
            or profile.get("fio")
            or " ".join(
                str(x)
                for x in (
                    profile.get("lastName") or profile.get("surname"),
                    profile.get("firstName") or profile.get("name"),
                    profile.get("middleName") or profile.get("patronymic"),
                )
                if x
            ).strip()
        )
        if name:
            account.display_name = str(name)[:255]
    account.connected_at = account.connected_at or timezone.now()
    account.last_error = ""
    account.save(
        update_fields=[
            "device_id",
            "access_token_enc",
            "refresh_token_enc",
            "access_expires_at",
            "inn",
            "display_name",
            "connected_at",
            "last_error",
            "updated_at",
        ]
    )


def connect_with_password(provider, *, username: str, password: str) -> MoyNalogAccount:
    username = (username or "").strip()
    password = password or ""
    if not username or not password:
        raise NpdError("Укажите ИНН (или логин ЛК ФЛ) и пароль")
    client = MoyNalogClient(device_id=new_device_id())
    payload = client.login_by_password(username, password)
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    if not profile:
        try:
            profile = client.fetch_profile()
        except NpdError:
            profile = {}
    account, _ = MoyNalogAccount.objects.get_or_create(provider=provider)
    account.enabled = True
    if normalize_inn(username):
        account.inn = normalize_inn(username)
    _persist_tokens(account, client, profile=profile)
    return account


def start_sms_login(provider, *, phone: str) -> dict:
    phone_n = normalize_phone(phone)
    if len(phone_n) != 11 or not phone_n.startswith("7"):
        raise NpdError("Укажите телефон в формате 79XXXXXXXXX")
    account, _ = MoyNalogAccount.objects.get_or_create(provider=provider)
    if not account.device_id:
        account.device_id = new_device_id()
        account.save(update_fields=["device_id", "updated_at"])
    account.phone = phone_n
    account.save(update_fields=["phone", "updated_at"])
    client = MoyNalogClient(device_id=account.device_id)
    challenge = client.start_phone_login(phone_n)
    return {
        "challenge_token": challenge.get("challengeToken"),
        "expire_in": challenge.get("expireIn"),
        "phone": phone_n,
        "device_id": account.device_id,
    }


def verify_sms_login(provider, *, phone: str, code: str, challenge_token: str) -> MoyNalogAccount:
    phone_n = normalize_phone(phone)
    code = (code or "").strip()
    challenge_token = (challenge_token or "").strip()
    if not phone_n or not code or not challenge_token:
        raise NpdError("Нужны телефон, код из SMS и challenge_token")
    account, _ = MoyNalogAccount.objects.get_or_create(provider=provider)
    if not account.device_id:
        account.device_id = new_device_id()
    client = MoyNalogClient(device_id=account.device_id)
    payload = client.verify_phone_login(phone_n, code, challenge_token)
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    if not profile:
        try:
            profile = client.fetch_profile()
        except NpdError:
            profile = {}
    account.enabled = True
    account.phone = phone_n
    _persist_tokens(account, client, profile=profile)
    return account


def disconnect_account(provider) -> None:
    account = MoyNalogAccount.objects.filter(provider=provider).first()
    if not account:
        return
    account.access_token_enc = ""
    account.refresh_token_enc = ""
    account.access_expires_at = None
    account.enabled = False
    account.last_error = ""
    account.save(
        update_fields=[
            "access_token_enc",
            "refresh_token_enc",
            "access_expires_at",
            "enabled",
            "last_error",
            "updated_at",
        ]
    )


def set_enabled(provider, enabled: bool) -> MoyNalogAccount | None:
    account = MoyNalogAccount.objects.filter(provider=provider).first()
    if not account:
        return None
    account.enabled = bool(enabled)
    account.save(update_fields=["enabled", "updated_at"])
    return account


def _claim_receipt(*, provider, source: str, source_id: int, amount: Decimal, service_name: str, operation_time) -> NpdReceipt | None:
    """Атомарно захватить выдачу: одна попытка на source. None = уже обрабатывается/выбит."""
    with transaction.atomic():
        existing = (
            NpdReceipt.objects.select_for_update()
            .filter(source=source, source_id=source_id)
            .first()
        )
        if existing:
            if existing.status in (NpdReceipt.Status.ISSUED, NpdReceipt.Status.PENDING, NpdReceipt.Status.MAYBE):
                return None
            if existing.status == NpdReceipt.Status.FAILED:
                existing.status = NpdReceipt.Status.PENDING
                existing.error_message = ""
                existing.attempted_at = timezone.now()
                existing.amount = amount
                existing.service_name = (service_name or "")[:255]
                existing.operation_time = operation_time
                existing.save(
                    update_fields=[
                        "status",
                        "error_message",
                        "attempted_at",
                        "amount",
                        "service_name",
                        "operation_time",
                        "updated_at",
                    ]
                )
                return existing
            return None
        return NpdReceipt.objects.create(
            provider=provider,
            source=source,
            source_id=source_id,
            amount=amount,
            service_name=(service_name or "")[:255],
            status=NpdReceipt.Status.PENDING,
            operation_time=operation_time,
            attempted_at=timezone.now(),
        )


def _issue_claimed(receipt: NpdReceipt) -> NpdReceipt:
    account = MoyNalogAccount.objects.filter(provider_id=receipt.provider_id).first()
    if not account or not account.is_connected or not account.enabled:
        receipt.status = NpdReceipt.Status.FAILED
        receipt.error_message = "«Мой налог» не подключён или автовыдача выключена"
        receipt.save(update_fields=["status", "error_message", "updated_at"])
        return receipt

    client = _client_from_account(account)
    try:
        uuid = client.create_income(
            name=receipt.service_name or "Оплата услуги",
            amount=str(receipt.amount),
            quantity=1,
            operation_time=receipt.operation_time or timezone.now(),
            payment_type="CASH",
        )
        # persist refreshed tokens
        _persist_tokens(account, client)
        receipt.receipt_uuid = uuid
        receipt.receipt_url = MoyNalogClient.receipt_print_url(account.inn, uuid) if account.inn else ""
        receipt.status = NpdReceipt.Status.ISSUED
        receipt.issued_at = timezone.now()
        receipt.error_message = ""
        receipt.save(
            update_fields=[
                "receipt_uuid",
                "receipt_url",
                "status",
                "issued_at",
                "error_message",
                "updated_at",
            ]
        )
        return receipt
    except NpdMaybeSent as exc:
        receipt.status = NpdReceipt.Status.MAYBE
        receipt.error_message = str(exc)[:500]
        receipt.save(update_fields=["status", "error_message", "updated_at"])
        account.last_error = str(exc)[:500]
        account.save(update_fields=["last_error", "updated_at"])
        logger.warning("moy_nalog maybe-sent provider=%s source=%s:%s: %s", receipt.provider_id, receipt.source, receipt.source_id, exc)
        return receipt
    except NpdAuthError as exc:
        receipt.status = NpdReceipt.Status.FAILED
        receipt.error_message = str(exc)[:500]
        receipt.save(update_fields=["status", "error_message", "updated_at"])
        account.last_error = str(exc)[:500]
        account.save(update_fields=["last_error", "updated_at"])
        return receipt
    except (NpdUnreachable, NpdError) as exc:
        receipt.status = NpdReceipt.Status.FAILED
        receipt.error_message = str(exc)[:500]
        receipt.save(update_fields=["status", "error_message", "updated_at"])
        account.last_error = str(exc)[:500]
        account.save(update_fields=["last_error", "updated_at"])
        logger.warning("moy_nalog fail provider=%s source=%s:%s: %s", receipt.provider_id, receipt.source, receipt.source_id, exc)
        return receipt
    except Exception as exc:  # noqa: BLE001
        receipt.status = NpdReceipt.Status.FAILED
        receipt.error_message = f"Внутренняя ошибка: {exc}"[:500]
        receipt.save(update_fields=["status", "error_message", "updated_at"])
        logger.exception("moy_nalog unexpected")
        return receipt


def issue_for_booking(booking, *, force: bool = False) -> NpdReceipt | None:
    from booking.acquiring import booking_payable_total

    account = MoyNalogAccount.objects.filter(provider_id=booking.provider_id, enabled=True).first()
    if not account or not account.is_connected:
        return None
    amount = Decimal(str(getattr(booking, "prepay_amount", 0) or 0))
    if amount <= 0:
        amount = booking_payable_total(booking)
    if amount <= 0:
        return None
    service_name = getattr(getattr(booking, "service", None), "name", None) or "Оплата записи"
    op_time = getattr(booking, "paid_at", None) or timezone.now()
    if force:
        NpdReceipt.objects.filter(source=NpdReceipt.Source.BOOKING, source_id=booking.id).exclude(
            status=NpdReceipt.Status.ISSUED
        ).update(status=NpdReceipt.Status.FAILED)
    claimed = _claim_receipt(
        provider=booking.provider,
        source=NpdReceipt.Source.BOOKING,
        source_id=booking.id,
        amount=amount,
        service_name=service_name,
        operation_time=op_time,
    )
    if not claimed:
        return NpdReceipt.objects.filter(source=NpdReceipt.Source.BOOKING, source_id=booking.id).first()
    return _issue_claimed(claimed)


def issue_for_cafe_order(order, *, force: bool = False) -> NpdReceipt | None:
    account = MoyNalogAccount.objects.filter(provider_id=order.provider_id, enabled=True).first()
    if not account or not account.is_connected:
        return None
    amount = Decimal(str(getattr(order, "total", 0) or 0))
    if amount <= 0:
        return None
    service_name = f"Заказ кафе №{order.id}"
    op_time = getattr(order, "paid_at", None) or timezone.now()
    if force:
        NpdReceipt.objects.filter(source=NpdReceipt.Source.CAFE_ORDER, source_id=order.id).exclude(
            status=NpdReceipt.Status.ISSUED
        ).update(status=NpdReceipt.Status.FAILED)
    claimed = _claim_receipt(
        provider=order.provider,
        source=NpdReceipt.Source.CAFE_ORDER,
        source_id=order.id,
        amount=amount,
        service_name=service_name,
        operation_time=op_time,
    )
    if not claimed:
        return NpdReceipt.objects.filter(source=NpdReceipt.Source.CAFE_ORDER, source_id=order.id).first()
    return _issue_claimed(claimed)


def retry_receipt(receipt: NpdReceipt) -> NpdReceipt:
    if receipt.status == NpdReceipt.Status.ISSUED:
        return receipt
    if receipt.status == NpdReceipt.Status.MAYBE:
        # Нельзя автоповторять — только смена статуса после ручной проверки
        raise NpdError(
            "Чек мог уже создаться. Проверьте в «Мой налог» и при необходимости отметьте вручную."
        )
    receipt.status = NpdReceipt.Status.FAILED
    receipt.save(update_fields=["status", "updated_at"])
    claimed = _claim_receipt(
        provider=receipt.provider,
        source=receipt.source,
        source_id=receipt.source_id,
        amount=receipt.amount,
        service_name=receipt.service_name,
        operation_time=receipt.operation_time or timezone.now(),
    )
    if not claimed:
        return NpdReceipt.objects.get(pk=receipt.pk)
    return _issue_claimed(claimed)


def maybe_issue_after_booking_paid(booking) -> None:
    try:
        issue_for_booking(booking)
    except Exception:
        logger.exception("moy_nalog booking hook failed booking=%s", getattr(booking, "id", None))


def maybe_issue_after_cafe_paid(order) -> None:
    try:
        issue_for_cafe_order(order)
    except Exception:
        logger.exception("moy_nalog cafe hook failed order=%s", getattr(order, "id", None))

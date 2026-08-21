"""Visit packages (абонементы) and loyalty points helpers."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from .models import (
    ClientPackage,
    LoyaltyAccount,
    LoyaltyLedger,
    LoyaltySettings,
    VisitPackage,
)


def get_or_create_loyalty_settings(provider) -> LoyaltySettings:
    obj, _ = LoyaltySettings.objects.get_or_create(provider=provider)
    return obj


def get_or_create_loyalty_account(provider, client) -> LoyaltyAccount:
    obj, _ = LoyaltyAccount.objects.get_or_create(provider=provider, client=client)
    return obj


def package_covers_service(purchase: ClientPackage, service_id: int) -> bool:
    svc_ids = list(purchase.package.services.values_list("id", flat=True))
    if not svc_ids:
        return True
    return int(service_id) in {int(x) for x in svc_ids}


def active_client_packages(provider_id: int, client_id: int, service_id: int | None = None):
    now = timezone.now()
    qs = (
        ClientPackage.objects.filter(
            provider_id=provider_id,
            client_id=client_id,
            status=ClientPackage.Status.ACTIVE,
            visits_remaining__gt=0,
        )
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=now))
        .select_related("package")
        .prefetch_related("package__services")
        .order_by("expires_at", "purchased_at")
    )
    if service_id is None:
        return list(qs)
    return [p for p in qs if package_covers_service(p, service_id)]


@transaction.atomic
def sell_package(*, provider, client, package: VisitPackage, note: str = "") -> ClientPackage:
    if package.provider_id != provider.id:
        raise ValueError("Пакет другой организации.")
    if not package.is_active:
        raise ValueError("Пакет неактивен.")
    expires = None
    if package.validity_days:
        expires = timezone.now() + timedelta(days=int(package.validity_days))
    return ClientPackage.objects.create(
        provider=provider,
        client=client,
        package=package,
        visits_total=package.visits_count,
        visits_remaining=package.visits_count,
        expires_at=expires,
        note=(note or "")[:250],
    )


def booking_amount_rub(booking) -> Decimal:
    service = getattr(booking, "service", None)
    price = Decimal(str(getattr(service, "price", 0) or 0))
    for opt in booking.selected_options or []:
        try:
            price += Decimal(str(opt.get("price") or 0))
        except Exception:
            pass
    return price


@transaction.atomic
def award_loyalty_for_visit(booking) -> int:
    """Award points after mark-done. Returns points awarded."""
    if not booking or not booking.client_id or not booking.provider_id:
        return 0
    if LoyaltyLedger.objects.filter(booking_id=booking.id, reason="visit", delta__gt=0).exists():
        return 0
    settings_obj = LoyaltySettings.objects.filter(provider_id=booking.provider_id, enabled=True).first()
    if not settings_obj:
        return 0
    points = int(settings_obj.points_per_visit or 0)
    per100 = int(settings_obj.points_per_100_rub or 0)
    if per100:
        if getattr(booking, "service_id", None) and getattr(booking, "service", None) is None:
            from catalog.models import Service

            booking.service = Service.objects.filter(pk=booking.service_id).first()
        amount = booking_amount_rub(booking)
        points += int(amount // 100) * per100
    if points <= 0:
        return 0
    account = get_or_create_loyalty_account(booking.provider, booking.client)
    account = LoyaltyAccount.objects.select_for_update().get(pk=account.pk)
    account.balance = int(account.balance or 0) + points
    account.save(update_fields=["balance", "updated_at"])
    LoyaltyLedger.objects.create(
        account=account,
        delta=points,
        reason="visit",
        booking=booking,
        note="Начисление за визит",
    )
    return points


@transaction.atomic
def consume_package_visit(booking, package_id: int | None = None) -> ClientPackage | None:
    """Debit one visit from a suitable active package. Returns purchase or None."""
    if not booking or not booking.client_id or not booking.service_id:
        return None
    if getattr(booking, "client_package_id", None):
        return ClientPackage.objects.filter(pk=booking.client_package_id).first()
    packs = active_client_packages(booking.provider_id, booking.client_id, booking.service_id)
    if not packs:
        return None
    purchase = None
    if package_id:
        purchase = next((p for p in packs if int(p.id) == int(package_id)), None)
    if purchase is None:
        purchase = packs[0]
    purchase = ClientPackage.objects.select_for_update().get(pk=purchase.pk)
    if purchase.visits_remaining <= 0:
        return None
    remaining = int(purchase.visits_remaining) - 1
    purchase.visits_remaining = remaining
    update_fields = ["visits_remaining"]
    if remaining <= 0:
        purchase.status = ClientPackage.Status.EXHAUSTED
        update_fields.append("status")
    purchase.save(update_fields=update_fields)
    if hasattr(booking, "client_package_id"):
        booking.client_package_id = purchase.id
        booking.save(update_fields=["client_package"])
    return purchase


@transaction.atomic
def restore_package_visit(booking) -> bool:
    """Return one visit to package if booking used an абонемент."""
    pkg_id = getattr(booking, "client_package_id", None)
    if not pkg_id:
        return False
    purchase = ClientPackage.objects.select_for_update().filter(pk=pkg_id).first()
    if not purchase:
        return False
    purchase.visits_remaining = int(purchase.visits_remaining or 0) + 1
    update_fields = ["visits_remaining"]
    if purchase.status == ClientPackage.Status.EXHAUSTED and purchase.visits_remaining > 0:
        purchase.status = ClientPackage.Status.ACTIVE
        update_fields.append("status")
    purchase.save(update_fields=update_fields)
    booking.client_package_id = None
    booking.save(update_fields=["client_package"])
    return True


@transaction.atomic
def redeem_loyalty_points(*, provider, client, points: int, booking=None, note: str = "") -> int:
    points = max(0, int(points or 0))
    if points <= 0:
        return 0
    settings_obj = LoyaltySettings.objects.filter(provider=provider, enabled=True).first()
    if not settings_obj:
        raise ValueError("Лояльность выключена.")
    account = get_or_create_loyalty_account(provider, client)
    account = LoyaltyAccount.objects.select_for_update().get(pk=account.pk)
    if int(account.balance or 0) < points:
        raise ValueError("Недостаточно баллов.")
    account.balance = int(account.balance or 0) - points
    account.save(update_fields=["balance", "updated_at"])
    LoyaltyLedger.objects.create(
        account=account,
        delta=-points,
        reason="redeem",
        booking=booking,
        note=(note or "Списание баллов")[:250],
    )
    return points


def loyalty_discount_rub(provider, points: int) -> Decimal:
    settings_obj = LoyaltySettings.objects.filter(provider=provider, enabled=True).first()
    if not settings_obj:
        return Decimal("0")
    rate = Decimal(str(settings_obj.rub_per_point or 1))
    return rate * Decimal(int(points or 0))

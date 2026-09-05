"""Неофициальный HTTP-клиент ЛК НПД (lknpd.nalog.ru / «Мой налог»).

API публично не документирован и может меняться. Ошибки сети делятся на
NpdUnreachable (повтор безопасен) и NpdMaybeSent (автоповтор запрещён).
"""

from __future__ import annotations

import logging
import secrets
import string
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any
from zoneinfo import ZoneInfo

import requests
from django.utils import timezone

logger = logging.getLogger(__name__)

BASE_URL = "https://lknpd.nalog.ru/api/"
USER_AGENT = "Mozilla/5.0 (compatible; Vmeste/1.0; +https://vsevmeste.space)"
DEFAULT_TZ = ZoneInfo("Europe/Moscow")


class NpdError(Exception):
    def __init__(self, message: str, *, status: int | None = None, payload: Any = None):
        super().__init__(message)
        self.status = status
        self.payload = payload


class NpdAuthError(NpdError):
    """Неверный логин / истёк refresh / нужна повторная авторизация."""


class NpdUnreachable(NpdError):
    """Запрос не ушёл или не установили соединение — чек точно не создан."""


class NpdMaybeSent(NpdError):
    """Запрос мог уйти, ответа нет или он неразборчив — автоповтор запрещён."""


def new_device_id() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(21))


def device_info(device_id: str) -> dict:
    return {
        "sourceDeviceId": device_id or new_device_id(),
        "sourceType": "WEB",
        "appVersion": "1.0.0",
        "metaDetails": {"userAgent": USER_AGENT},
    }


def _parse_expire(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if timezone.is_aware(value) else timezone.make_aware(value, dt_timezone.utc)
    text = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(text)
    except ValueError:
        return None
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, dt_timezone.utc)
    return dt


def _format_local(dt: datetime | None) -> str:
    if dt is None:
        dt = timezone.now()
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, dt_timezone.utc)
    local = dt.astimezone(DEFAULT_TZ).replace(microsecond=(dt.microsecond // 1000) * 1000)
    # API ожидает offset вида +03:00
    return local.isoformat(timespec="milliseconds")


class MoyNalogClient:
    def __init__(
        self,
        *,
        device_id: str | None = None,
        access_token: str = "",
        refresh_token: str = "",
        access_expires_at: datetime | None = None,
        timeout: tuple[float, float] = (6.0, 12.0),
    ):
        self.device_id = device_id or new_device_id()
        self.access_token = access_token or ""
        self.refresh_token = refresh_token or ""
        self.access_expires_at = access_expires_at
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update(
            {
                "Accept": "application/json, text/plain, */*",
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
            }
        )

    def _apply_token_payload(self, data: dict) -> dict:
        if not isinstance(data, dict):
            return {}
        access = data.get("token") or data.get("accessToken") or data.get("access_token") or ""
        refresh = data.get("refreshToken") or data.get("refresh_token") or ""
        expire = data.get("tokenExpireIn") or data.get("tokenExpireIn") or data.get("expireIn")
        if access:
            self.access_token = str(access)
        if refresh:
            self.refresh_token = str(refresh)
        parsed = _parse_expire(expire)
        if parsed:
            self.access_expires_at = parsed
        return data

    def _request(
        self,
        method: str,
        path: str,
        *,
        json_body: dict | None = None,
        auth: bool = False,
        allow_refresh: bool = True,
    ) -> dict | list | None:
        url = BASE_URL + path.lstrip("/")
        headers = {}
        if auth:
            if allow_refresh:
                self.ensure_access()
            if not self.access_token:
                raise NpdAuthError("Нет access-токена «Мой налог»")
            headers["Authorization"] = f"Bearer {self.access_token}"
        try:
            resp = self.session.request(
                method,
                url,
                json=json_body,
                headers=headers,
                timeout=self.timeout,
            )
        except requests.exceptions.ConnectionError as exc:
            raise NpdUnreachable(f"Нет связи с «Мой налог»: {exc}") from exc
        except requests.exceptions.Timeout as exc:
            # После отправки тела таймаут чтения = неопределённость для POST income
            if method.upper() == "POST" and path.rstrip("/").endswith("income"):
                raise NpdMaybeSent("Таймаут ответа при создании чека") from exc
            raise NpdUnreachable(f"Таймаут «Мой налог»: {exc}") from exc
        except requests.exceptions.RequestException as exc:
            raise NpdUnreachable(str(exc)) from exc

        if resp.status_code in (401, 403):
            raise NpdAuthError(
                "Сессия «Мой налог» недействительна — подключите кабинет снова",
                status=resp.status_code,
                payload=_safe_json(resp),
            )
        if resp.status_code >= 500:
            if method.upper() == "POST" and path.rstrip("/").endswith("income"):
                raise NpdMaybeSent(
                    f"«Мой налог» вернул {resp.status_code}",
                    status=resp.status_code,
                    payload=_safe_json(resp),
                )
            raise NpdUnreachable(
                f"«Мой налог» недоступен ({resp.status_code})",
                status=resp.status_code,
                payload=_safe_json(resp),
            )
        if resp.status_code >= 400:
            payload = _safe_json(resp)
            msg = _error_message(payload) or f"Ошибка «Мой налог» ({resp.status_code})"
            raise NpdError(msg, status=resp.status_code, payload=payload)
        if resp.status_code == 204 or not (resp.content or b"").strip():
            return None
        try:
            return resp.json()
        except ValueError as exc:
            if method.upper() == "POST" and path.rstrip("/").endswith("income"):
                raise NpdMaybeSent("Не удалось разобрать ответ при создании чека") from exc
            raise NpdError("Некорректный JSON от «Мой налог»") from exc

    def ensure_access(self) -> None:
        if self.access_token and self.access_expires_at:
            # обновляем за 2 минуты до истечения
            if timezone.now() < self.access_expires_at - timedelta(minutes=2):
                return
        if self.access_token and not self.access_expires_at:
            return
        if not self.refresh_token:
            if not self.access_token:
                raise NpdAuthError("Нет токенов «Мой налог»")
            return
        self.refresh_access()

    def refresh_access(self) -> dict:
        if not self.refresh_token:
            raise NpdAuthError("Нет refresh-токена")
        data = self._request(
            "POST",
            "v1/auth/token",
            json_body={"refreshToken": self.refresh_token, "deviceInfo": device_info(self.device_id)},
            auth=False,
            allow_refresh=False,
        )
        if not isinstance(data, dict):
            raise NpdAuthError("Пустой ответ при обновлении токена")
        return self._apply_token_payload(data)

    def login_by_password(self, username: str, password: str) -> dict:
        data = self._request(
            "POST",
            "v1/auth/lkfl",
            json_body={
                "username": username,
                "password": password,
                "deviceInfo": device_info(self.device_id),
            },
        )
        if not isinstance(data, dict):
            raise NpdAuthError("Пустой ответ авторизации")
        return self._apply_token_payload(data)

    def start_phone_login(self, phone: str) -> dict:
        data = self._request(
            "POST",
            "v2/auth/challenge/sms/start",
            json_body={"phone": phone, "requireTpToBeActive": True},
        )
        if not isinstance(data, dict) or not data.get("challengeToken"):
            raise NpdError("Не удалось отправить SMS-код")
        return data

    def verify_phone_login(self, phone: str, code: str, challenge_token: str) -> dict:
        data = self._request(
            "POST",
            "v1/auth/challenge/sms/verify",
            json_body={
                "phone": phone,
                "code": code,
                "challengeToken": challenge_token,
                "deviceInfo": device_info(self.device_id),
            },
        )
        if not isinstance(data, dict):
            raise NpdAuthError("Пустой ответ SMS-авторизации")
        applied = self._apply_token_payload(data)
        if not self.access_token and self.refresh_token:
            applied = self.refresh_access()
        return applied

    def fetch_profile(self) -> dict:
        data = self._request("GET", "v1/user", auth=True)
        return data if isinstance(data, dict) else {}

    def create_income(
        self,
        *,
        name: str,
        amount: str | float,
        quantity: int = 1,
        operation_time: datetime | None = None,
        payment_type: str = "CASH",
        client_phone: str | None = None,
        client_name: str | None = None,
    ) -> str:
        """Создать чек; вернуть approvedReceiptUuid."""
        amt = f"{float(amount):.2f}"
        body = {
            "paymentType": payment_type,
            "ignoreMaxTotalIncomeRestriction": False,
            "client": {
                "contactPhone": client_phone or None,
                "displayName": client_name or None,
                "incomeType": "FROM_INDIVIDUAL",
                "inn": None,
            },
            "requestTime": _format_local(timezone.now()),
            "operationTime": _format_local(operation_time or timezone.now()),
            "services": [{"name": (name or "Услуга")[:128], "amount": float(amt), "quantity": int(quantity)}],
            "totalAmount": f"{float(amt) * int(quantity):.2f}",
        }
        data = self._request("POST", "v1/income", json_body=body, auth=True)
        if not isinstance(data, dict):
            raise NpdMaybeSent("Пустой ответ при создании чека")
        uuid = data.get("approvedReceiptUuid") or data.get("approvedReceiptUUID") or ""
        if not uuid:
            raise NpdMaybeSent("В ответе нет UUID чека", payload=data)
        return str(uuid)

    @staticmethod
    def receipt_print_url(inn: str, receipt_uuid: str) -> str:
        return f"https://lknpd.nalog.ru/api/v1/receipt/{inn}/{receipt_uuid}/print"


def _safe_json(resp: requests.Response):
    try:
        return resp.json()
    except Exception:
        return (resp.text or "")[:500]


def _error_message(payload) -> str:
    if isinstance(payload, dict):
        for key in ("message", "error", "errorMessage", "detail", "description"):
            val = payload.get(key)
            if isinstance(val, str) and val.strip():
                return val.strip()
        errors = payload.get("errors")
        if isinstance(errors, list) and errors:
            first = errors[0]
            if isinstance(first, str):
                return first
            if isinstance(first, dict):
                return str(first.get("message") or first)
    return ""

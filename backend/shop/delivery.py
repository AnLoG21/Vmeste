"""Провайдеры доставки: свой курьер, Яндекс Доставка, СДЭК."""

from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from decimal import Decimal

import requests

logger = logging.getLogger(__name__)

YANDEX_API = "https://b2b.taxi.yandex.net/b2b/cargo/integration/v2"
CDEK_API = "https://api.cdek.ru/v2"
CDEK_TARIFF_DOOR_DOOR = 139  # Посылка склад-дверь / дверь-дверь (IM)


@dataclass
class ShipmentResult:
    tracking_id: str
    provider: str
    status: str = "created"
    raw: dict | None = None


class DeliveryProvider:
    kind: str = "own"

    def create_shipment(self, order) -> ShipmentResult:
        raise NotImplementedError

    def sync_status(self, tracking_id: str) -> str:
        raise NotImplementedError


def _provider_phone(provider) -> str:
    phones = getattr(provider, "organization_phones", None) or []
    if isinstance(phones, list) and phones:
        first = phones[0]
        if isinstance(first, dict):
            return str(first.get("number") or first.get("phone") or "").strip()
        return str(first).strip()
    return str(getattr(provider, "phone", "") or "").strip()


def _normalize_phone(raw: str) -> str:
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if not digits:
        return ""
    if digits.startswith("8") and len(digits) == 11:
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if not digits.startswith("+"):
        return f"+{digits}"
    return digits


def _order_items_weight_grams(order) -> int:
    """Оценка веса: ~300 г на позицию, минимум 500 г."""
    qty = sum(int(i.quantity or 1) for i in order.items.all())
    return max(500, qty * 300)


def _float_or_none(value):
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


class OwnCourierProvider(DeliveryProvider):
    kind = "own"

    def create_shipment(self, order) -> ShipmentResult:
        return ShipmentResult(tracking_id=f"own-{order.id}", provider=self.kind, status="assigned")

    def sync_status(self, tracking_id: str) -> str:
        return "delivering"


class YandexDeliveryProvider(DeliveryProvider):
    """Яндекс Доставка (Express / Cargo API)."""

    kind = "yandex"

    def __init__(self, token: str = ""):
        self.token = (token or "").strip()

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept-Language": "ru",
            "Content-Type": "application/json",
        }

    def create_shipment(self, order) -> ShipmentResult:
        if not self.token:
            raise RuntimeError("Укажите токен Яндекс Доставки в настройках магазина")

        provider = order.provider
        from_lat = _float_or_none(getattr(provider, "organization_latitude", None))
        from_lon = _float_or_none(getattr(provider, "organization_longitude", None))
        to_lat = _float_or_none(order.delivery_lat)
        to_lon = _float_or_none(order.delivery_lon)
        if from_lat is None or from_lon is None:
            raise RuntimeError("В профиле организации нужны координаты адреса (откуда забирать)")
        if to_lat is None or to_lon is None:
            raise RuntimeError("У заказа нет координат адреса доставки")

        from_phone = _normalize_phone(_provider_phone(provider))
        to_phone = _normalize_phone(order.guest_phone)
        if not from_phone:
            raise RuntimeError("Укажите телефон организации в профиле")
        if not to_phone:
            raise RuntimeError("У заказа нет телефона получателя")

        from_address = (getattr(provider, "organization_address", None) or "").strip() or "Адрес отправителя"
        to_address = (order.delivery_address or "").strip() or "Адрес получателя"
        org_name = (getattr(provider, "organization_name", None) or provider.username or "Отправитель").strip()
        guest_name = (order.guest_name or "Получатель").strip()

        items = []
        for line in order.items.all():
            qty = int(line.quantity or 1)
            price = float(Decimal(line.unit_price or 0))
            items.append(
                {
                    "title": (line.name or "Товар")[:128],
                    "quantity": qty,
                    "cost_value": f"{price:.2f}",
                    "cost_currency": "RUB",
                    "weight": 0.3,
                }
            )
        if not items:
            items = [
                {
                    "title": "Заказ",
                    "quantity": 1,
                    "cost_value": f"{float(order.items_total or 0):.2f}",
                    "cost_currency": "RUB",
                    "weight": 0.5,
                }
            ]

        payload = {
            "items": items,
            "route_points": [
                {
                    "point_id": 1,
                    "visit_order": 1,
                    "type": "source",
                    "address": {
                        "fullname": from_address,
                        "coordinates": [from_lon, from_lat],
                        "comment": "Забрать заказ Вместе",
                    },
                    "contact": {"name": org_name[:64], "phone": from_phone},
                },
                {
                    "point_id": 2,
                    "visit_order": 2,
                    "type": "destination",
                    "address": {
                        "fullname": to_address,
                        "coordinates": [to_lon, to_lat],
                        "comment": (order.comment or "")[:200],
                        "porch": (order.entrance or "")[:16] or None,
                        "sflat": (order.apartment or "")[:16] or None,
                        "door_code": (order.intercom or "")[:32] or None,
                    },
                    "contact": {"name": guest_name[:64], "phone": to_phone},
                },
            ],
            "client_requirements": {"taxi_class": "express"},
            "emergency_contact": {"name": org_name[:64], "phone": from_phone},
            "comment": f"Заказ Вместе #{order.id}",
            "skip_door_to_door": False,
        }
        # убрать None из address
        for rp in payload["route_points"]:
            addr = rp["address"]
            for key in list(addr.keys()):
                if addr[key] is None:
                    del addr[key]

        request_id = str(uuid.uuid4())
        create_url = f"{YANDEX_API}/claims/create?request_id={request_id}"
        try:
            create_res = requests.post(create_url, headers=self._headers(), json=payload, timeout=30)
        except requests.RequestException as exc:
            logger.exception("yandex delivery create failed")
            raise RuntimeError(f"Яндекс Доставка недоступна: {exc}") from exc

        raw = {}
        try:
            raw = create_res.json() if create_res.content else {}
        except ValueError:
            raw = {"text": create_res.text[:500]}

        if create_res.status_code >= 400:
            detail = raw.get("message") or raw.get("code") or create_res.text[:300]
            raise RuntimeError(f"Яндекс Доставка: {detail}")

        claim_id = str(raw.get("id") or "").strip()
        if not claim_id:
            raise RuntimeError("Яндекс Доставка: не получен id заявки")

        version = int(raw.get("version") or 1)
        try:
            accept_res = requests.post(
                f"{YANDEX_API}/claims/accept?claim_id={claim_id}",
                headers=self._headers(),
                json={"version": version},
                timeout=30,
            )
            accept_raw = accept_res.json() if accept_res.content else {}
            if accept_res.status_code < 400:
                raw = {**raw, "accept": accept_raw}
            else:
                logger.warning("yandex accept failed claim=%s status=%s body=%s", claim_id, accept_res.status_code, accept_raw)
        except requests.RequestException:
            logger.exception("yandex accept request failed claim=%s", claim_id)

        return ShipmentResult(
            tracking_id=claim_id,
            provider=self.kind,
            status=str(raw.get("status") or "created"),
            raw=raw,
        )

    def sync_status(self, tracking_id: str) -> str:
        if not self.token or not tracking_id:
            return "unknown"
        try:
            res = requests.post(
                f"{YANDEX_API}/claims/info",
                headers=self._headers(),
                json={"claim_id": tracking_id},
                timeout=20,
            )
            data = res.json() if res.content else {}
            return str(data.get("status") or "unknown")
        except Exception:
            logger.exception("yandex sync_status failed")
            return "unknown"


class CdekProvider(DeliveryProvider):
    """СДЭК Open API v2."""

    kind = "cdek"

    def __init__(self, client_id: str = "", client_secret: str = ""):
        self.client_id = (client_id or "").strip()
        self.client_secret = (client_secret or "").strip()
        self._token: str | None = None

    def _auth(self) -> str:
        if self._token:
            return self._token
        if not self.client_id or not self.client_secret:
            raise RuntimeError("Укажите Account и Secure password СДЭК в настройках магазина")
        try:
            res = requests.post(
                f"{CDEK_API}/oauth/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=25,
            )
        except requests.RequestException as exc:
            raise RuntimeError(f"СДЭК недоступен: {exc}") from exc
        data = res.json() if res.content else {}
        token = str(data.get("access_token") or "").strip()
        if res.status_code >= 400 or not token:
            detail = data.get("error_description") or data.get("message") or res.text[:300]
            raise RuntimeError(f"СДЭК авторизация: {detail}")
        self._token = token
        return token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self._auth()}",
            "Content-Type": "application/json",
        }

    def create_shipment(self, order) -> ShipmentResult:
        provider = order.provider
        from_address = (getattr(provider, "organization_address", None) or "").strip()
        to_address = (order.delivery_address or "").strip()
        if not from_address:
            raise RuntimeError("В профиле организации нужен адрес отправителя для СДЭК")
        if not to_address:
            raise RuntimeError("У заказа нет адреса доставки")

        to_phone = _normalize_phone(order.guest_phone)
        from_phone = _normalize_phone(_provider_phone(provider))
        if not to_phone:
            raise RuntimeError("У заказа нет телефона получателя")

        guest_name = (order.guest_name or "Получатель").strip()
        org_name = (getattr(provider, "organization_name", None) or provider.username or "Отправитель").strip()
        weight = _order_items_weight_grams(order)

        package_items = []
        for line in order.items.all():
            qty = int(line.quantity or 1)
            price = float(Decimal(line.unit_price or 0))
            package_items.append(
                {
                    "name": (line.name or "Товар")[:255],
                    "ware_key": str(line.product_id or line.id),
                    "payment": {"value": 0},
                    "cost": price,
                    "weight": max(100, weight // max(1, sum(int(i.quantity or 1) for i in order.items.all()))),
                    "amount": qty,
                }
            )
        if not package_items:
            package_items = [
                {
                    "name": "Заказ",
                    "ware_key": f"order-{order.id}",
                    "payment": {"value": 0},
                    "cost": float(order.items_total or 0),
                    "weight": weight,
                    "amount": 1,
                }
            ]

        payload = {
            "type": 1,
            "number": f"vmeste-{order.id}",
            "tariff_code": CDEK_TARIFF_DOOR_DOOR,
            "comment": f"Заказ Вместе #{order.id}",
            "sender": {
                "name": org_name[:255],
                "phones": [{"number": from_phone}] if from_phone else [],
            },
            "recipient": {
                "name": guest_name[:255],
                "phones": [{"number": to_phone}],
            },
            "from_location": {"address": from_address[:255]},
            "to_location": {"address": to_address[:255]},
            "packages": [
                {
                    "number": "1",
                    "weight": weight,
                    "items": package_items,
                }
            ],
        }
        if not payload["sender"]["phones"]:
            del payload["sender"]["phones"]

        try:
            res = requests.post(f"{CDEK_API}/orders", headers=self._headers(), json=payload, timeout=35)
        except requests.RequestException as exc:
            logger.exception("cdek create order failed")
            raise RuntimeError(f"СДЭК недоступен: {exc}") from exc

        raw = {}
        try:
            raw = res.json() if res.content else {}
        except ValueError:
            raw = {"text": res.text[:500]}

        if res.status_code >= 400:
            errs = raw.get("requests") or raw.get("errors") or raw
            raise RuntimeError(f"СДЭК: {errs}")

        entity = raw.get("entity") or {}
        uuid_val = str(entity.get("uuid") or "").strip()
        cdek_number = str(entity.get("cdek_number") or entity.get("number") or "").strip()
        tracking = cdek_number or uuid_val
        if not tracking:
            # иногда uuid только в requests
            reqs = raw.get("requests") or []
            if reqs and isinstance(reqs[0], dict):
                tracking = str(reqs[0].get("request_uuid") or reqs[0].get("uuid") or "").strip()
        if not tracking:
            raise RuntimeError("СДЭК: не получен номер заказа")

        return ShipmentResult(
            tracking_id=tracking,
            provider=self.kind,
            status="created",
            raw=raw,
        )

    def sync_status(self, tracking_id: str) -> str:
        if not tracking_id:
            return "unknown"
        try:
            res = requests.get(f"{CDEK_API}/orders/{tracking_id}", headers=self._headers(), timeout=20)
            data = res.json() if res.content else {}
            entity = data.get("entity") or {}
            statuses = entity.get("statuses") or []
            if statuses:
                last = statuses[-1]
                return str(last.get("code") or last.get("name") or "unknown")
            return str(entity.get("status") or "unknown")
        except Exception:
            logger.exception("cdek sync_status failed")
            return "unknown"


def get_delivery_provider(settings_obj) -> DeliveryProvider:
    kind = getattr(settings_obj, "delivery_provider", "own") or "own"
    if kind == "yandex":
        return YandexDeliveryProvider(getattr(settings_obj, "yandex_delivery_token", ""))
    if kind == "cdek":
        return CdekProvider(
            getattr(settings_obj, "cdek_client_id", ""),
            getattr(settings_obj, "cdek_client_secret", ""),
        )
    return OwnCourierProvider()

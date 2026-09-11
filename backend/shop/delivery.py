"""Провайдеры доставки: свой курьер, Яндекс Доставка, СДЭК."""

from __future__ import annotations

import logging
import re
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


DEFAULT_ITEM_WEIGHT_GRAMS = 300
DEFAULT_PACKAGE_DIMS_MM = (100, 100, 100)  # L×W×H


def _line_product(line):
    product_id = getattr(line, "product_id", None)
    if not product_id:
        return None
    try:
        return line.product
    except Exception:
        try:
            from .models import Product

            return Product.objects.filter(pk=product_id).only(
                "weight_grams", "length_mm", "width_mm", "height_mm"
            ).first()
        except Exception:
            return None


def _line_weight_grams(line) -> int:
    product = _line_product(line)
    qty = max(1, int(getattr(line, "quantity", None) or 1))
    unit = DEFAULT_ITEM_WEIGHT_GRAMS
    if product and getattr(product, "weight_grams", None):
        try:
            unit = max(1, int(product.weight_grams))
        except (TypeError, ValueError):
            unit = DEFAULT_ITEM_WEIGHT_GRAMS
    return unit * qty


def _order_items_weight_grams(order) -> int:
    """Суммарный вес позиций (г). Пустой вес товара → 300 г/шт. Минимум 500 г."""
    items = list(order.items.select_related("product").all())
    if not items:
        return 500
    total = sum(_line_weight_grams(line) for line in items)
    return max(500, total)


def _order_package_dims_cm(order) -> tuple[int, int, int]:
    """Габариты посылки в см для СДЭК: max по осям среди товаров, иначе 10×10×10."""
    length = width = height = 0
    for line in order.items.select_related("product").all():
        product = _line_product(line)
        if not product:
            continue
        for attr, cur in (
            ("length_mm", length),
            ("width_mm", width),
            ("height_mm", height),
        ):
            try:
                val = int(getattr(product, attr, None) or 0)
            except (TypeError, ValueError):
                val = 0
            if attr == "length_mm":
                length = max(length, val)
            elif attr == "width_mm":
                width = max(width, val)
            else:
                height = max(height, val)
    dl, dw, dh = DEFAULT_PACKAGE_DIMS_MM
    length = length or dl
    width = width or dw
    height = height or dh
    return (
        max(1, (length + 9) // 10),
        max(1, (width + 9) // 10),
        max(1, (height + 9) // 10),
    )


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
        for line in order.items.select_related("product").all():
            qty = int(line.quantity or 1)
            price = float(Decimal(line.unit_price or 0))
            line_grams = _line_weight_grams(line)
            unit_kg = max(0.1, round((line_grams / max(1, qty)) / 1000, 3))
            items.append(
                {
                    "title": (line.name or "Товар")[:128],
                    "quantity": qty,
                    "cost_value": f"{price:.2f}",
                    "cost_currency": "RUB",
                    "weight": unit_kg,
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
        length_cm, width_cm, height_cm = _order_package_dims_cm(order)

        package_items = []
        for line in order.items.select_related("product").all():
            qty = int(line.quantity or 1)
            price = float(Decimal(line.unit_price or 0))
            line_w = max(100, _line_weight_grams(line) // max(1, qty))
            package_items.append(
                {
                    "name": (line.name or "Товар")[:255],
                    "ware_key": str(line.product_id or line.id),
                    "payment": {"value": 0},
                    "cost": price,
                    "weight": line_w,
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
                    "length": length_cm,
                    "width": width_cm,
                    "height": height_cm,
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


POCHTA_API = "https://otpravka-api.pochta.ru/1.0"
DOSTAVISTA_API = "https://robot.dostavista.ru/api/business/1.3"


def _extract_postal_code(address: str) -> str:
    m = re.search(r"\b(\d{6})\b", address or "")
    return m.group(1) if m else ""


class RussianPostProvider(DeliveryProvider):
    """Почта России: API «Отправка» (otpravka-api.pochta.ru)."""

    kind = "russian_post"

    def __init__(self, token: str = "", user_key: str = ""):
        self.token = (token or "").strip()
        # user_key — Base64(login:password) или уже с префиксом Basic
        key = (user_key or "").strip()
        if key.lower().startswith("basic "):
            key = key[6:].strip()
        self.user_key = key

    def _headers(self) -> dict:
        return {
            "Authorization": f"AccessToken {self.token}",
            "X-User-Authorization": f"Basic {self.user_key}",
            "Content-Type": "application/json;charset=UTF-8",
            "Accept": "application/json",
        }

    def create_shipment(self, order) -> ShipmentResult:
        if not self.token or not self.user_key:
            raise RuntimeError("Укажите токен и ключ пользователя Почты России в настройках")

        to_address = (order.delivery_address or "").strip()
        index_to = _extract_postal_code(to_address)
        if not index_to:
            raise RuntimeError("Для Почты России в адресе нужен индекс (6 цифр), например: 101000, …")

        to_phone = "".join(ch for ch in _normalize_phone(order.guest_phone) if ch.isdigit())
        if not to_phone:
            raise RuntimeError("У заказа нет телефона получателя")

        guest_name = (order.guest_name or "Получатель").strip()
        weight = _order_items_weight_grams(order)
        payload = [
            {
                "order-num": f"vmeste-{order.id}",
                "address-type-to": "DEFAULT",
                "mail-category": "ORDINARY",
                "mail-type": "POSTAL_PARCEL",
                "mass": weight,
                "index-to": int(index_to),
                "place-to": to_address[:250],
                "street-to": to_address[:250],
                "recipient-name": guest_name[:120],
                "tel-address": to_phone,
                "given-name": guest_name.split()[0][:50] if guest_name else "Получатель",
                "surname": (guest_name.split()[-1] if len(guest_name.split()) > 1 else guest_name)[:50],
            }
        ]

        try:
            res = requests.put(
                f"{POCHTA_API}/user/backlog",
                headers=self._headers(),
                json=payload,
                timeout=35,
            )
        except requests.RequestException as exc:
            logger.exception("russian post create failed")
            raise RuntimeError(f"Почта России недоступна: {exc}") from exc

        raw = {}
        try:
            raw = res.json() if res.content else {}
        except ValueError:
            raw = {"text": res.text[:500]}

        if res.status_code >= 400:
            detail = raw.get("desc") or raw.get("message") or raw or res.text[:300]
            raise RuntimeError(f"Почта России: {detail}")

        # ответ: {"result-ids":[…]} или errors
        result_ids = raw.get("result-ids") or raw.get("result_ids") or []
        errors = raw.get("errors") or []
        if errors and not result_ids:
            raise RuntimeError(f"Почта России: {errors}")
        tracking = str(result_ids[0] if result_ids else raw.get("barcode") or f"rp-{order.id}")
        return ShipmentResult(tracking_id=tracking, provider=self.kind, status="created", raw=raw)

    def sync_status(self, tracking_id: str) -> str:
        if not tracking_id or not self.token:
            return "unknown"
        try:
            res = requests.get(
                f"{POCHTA_API}/backlog/{tracking_id}",
                headers=self._headers(),
                timeout=20,
            )
            data = res.json() if res.content else {}
            return str(data.get("mail-status") or data.get("status") or "unknown")
        except Exception:
            logger.exception("russian post sync failed")
            return "unknown"


class DostavistaProvider(DeliveryProvider):
    """Dostavista Business API."""

    kind = "dostavista"

    def __init__(self, token: str = ""):
        self.token = (token or "").strip()

    def _headers(self) -> dict:
        return {
            "X-DV-Auth-Token": self.token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def create_shipment(self, order) -> ShipmentResult:
        if not self.token:
            raise RuntimeError("Укажите токен Dostavista в настройках магазина")

        provider = order.provider
        from_lat = _float_or_none(getattr(provider, "organization_latitude", None))
        from_lon = _float_or_none(getattr(provider, "organization_longitude", None))
        to_lat = _float_or_none(order.delivery_lat)
        to_lon = _float_or_none(order.delivery_lon)
        from_address = (getattr(provider, "organization_address", None) or "").strip()
        to_address = (order.delivery_address or "").strip()
        if not from_address:
            raise RuntimeError("В профиле организации нужен адрес отправителя для Dostavista")
        if not to_address:
            raise RuntimeError("У заказа нет адреса доставки")

        from_phone = _normalize_phone(_provider_phone(provider))
        to_phone = _normalize_phone(order.guest_phone)
        if not from_phone:
            raise RuntimeError("Укажите телефон организации в профиле")
        if not to_phone:
            raise RuntimeError("У заказа нет телефона получателя")

        org_name = (getattr(provider, "organization_name", None) or provider.username or "Отправитель").strip()
        guest_name = (order.guest_name or "Получатель").strip()

        point_a = {
            "address": from_address,
            "contact_person": {"phone": from_phone, "name": org_name[:100]},
            "client_order_id": f"vmeste-from-{order.id}",
            "required_order_id": False,
        }
        point_b = {
            "address": to_address,
            "contact_person": {"phone": to_phone, "name": guest_name[:100]},
            "client_order_id": f"vmeste-to-{order.id}",
            "required_order_id": False,
            "note": (order.comment or "")[:200],
        }
        if from_lat is not None and from_lon is not None:
            point_a["latitude"] = from_lat
            point_a["longitude"] = from_lon
        if to_lat is not None and to_lon is not None:
            point_b["latitude"] = to_lat
            point_b["longitude"] = to_lon

        payload = {
            "matter": f"Заказ Вместе #{order.id}",
            "vehicle_type_id": 1,
            "total_weight_kg": max(1, round(_order_items_weight_grams(order) / 1000)),
            "points": [point_a, point_b],
        }

        try:
            res = requests.post(
                f"{DOSTAVISTA_API}/create-order",
                headers=self._headers(),
                json=payload,
                timeout=35,
            )
        except requests.RequestException as exc:
            logger.exception("dostavista create failed")
            raise RuntimeError(f"Dostavista недоступна: {exc}") from exc

        raw = {}
        try:
            raw = res.json() if res.content else {}
        except ValueError:
            raw = {"text": res.text[:500]}

        if res.status_code >= 400 or raw.get("is_successful") is False:
            errors = raw.get("errors") or raw.get("parameter_errors") or raw
            raise RuntimeError(f"Dostavista: {errors}")

        order_obj = raw.get("order") or {}
        tracking = str(order_obj.get("order_id") or order_obj.get("id") or "").strip()
        if not tracking:
            raise RuntimeError("Dostavista: не получен order_id")
        return ShipmentResult(
            tracking_id=tracking,
            provider=self.kind,
            status=str(order_obj.get("status") or "created"),
            raw=raw,
        )

    def sync_status(self, tracking_id: str) -> str:
        if not tracking_id or not self.token:
            return "unknown"
        try:
            res = requests.get(
                f"{DOSTAVISTA_API}/orders",
                headers=self._headers(),
                params={"order_id": tracking_id},
                timeout=20,
            )
            data = res.json() if res.content else {}
            orders = data.get("orders") or []
            if orders:
                return str(orders[0].get("status") or "unknown")
            return "unknown"
        except Exception:
            logger.exception("dostavista sync failed")
            return "unknown"


def get_delivery_provider(settings_obj, kind: str | None = None) -> DeliveryProvider:
    selected = (kind or getattr(settings_obj, "delivery_provider", "own") or "own").strip()
    if selected == "yandex":
        return YandexDeliveryProvider(getattr(settings_obj, "yandex_delivery_token", ""))
    if selected == "cdek":
        return CdekProvider(
            getattr(settings_obj, "cdek_client_id", ""),
            getattr(settings_obj, "cdek_client_secret", ""),
        )
    if selected == "russian_post":
        return RussianPostProvider(
            getattr(settings_obj, "russian_post_token", ""),
            getattr(settings_obj, "russian_post_user_key", ""),
        )
    if selected == "dostavista":
        return DostavistaProvider(getattr(settings_obj, "dostavista_token", ""))
    return OwnCourierProvider()


KNOWN_DELIVERY_KINDS = ("own", "yandex", "cdek", "russian_post", "dostavista")

# Курьерские способы: ETA зависит от расстояния до адреса.
DISTANCE_BASED_KINDS = frozenset({"own", "yandex", "dostavista"})


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    import math

    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(min(1.0, a)))


def _round_minutes(value: float, step: int = 5) -> int:
    return max(step, int(round(value / step) * step))


def format_courier_eta(distance_m: float | None, *, kind: str = "own", fallback: str = "") -> str:
    """Оценка времени доставки по прямой + запас на сборку и пробки."""
    if distance_m is None or distance_m < 0:
        return (fallback or "").strip()

    # Сборка / передача курьеру
    prep = 20 if kind == "own" else 25
    # Средняя скорость по городу с учётом пробок (км/ч)
    speed_kmh = 22.0 if kind == "own" else 26.0
    travel_min = (float(distance_m) / 1000.0) / speed_kmh * 60.0
    # Коэффициент «не по прямой»
    total = prep + travel_min * 1.35
    low = _round_minutes(total * 0.9)
    high = _round_minutes(total * 1.25)
    if high <= low:
        high = low + 10

    if high < 60:
        return f"{low}–{high} мин"
    if low < 60:
        return f"{low} мин – {_format_hours(high)}"
    return f"{_format_hours(low)} – {_format_hours(high)}"


def _format_hours(minutes: int) -> str:
    h = minutes // 60
    m = minutes % 60
    if h <= 0:
        return f"{m} мин"
    if m == 0:
        return f"{h} ч" if h != 1 else "1 ч"
    return f"{h} ч {m:02d} мин"


def available_delivery_methods(
    settings_obj,
    *,
    dest_lat: float | None = None,
    dest_lon: float | None = None,
    origin_lat: float | None = None,
    origin_lon: float | None = None,
) -> list[dict]:
    """Список способов доставки, которые продавец включил и для которых есть ключи.

    Если переданы координаты магазина и адреса — для курьерских способов
    ETA считается от расстояния, иначе остаётся текст из настроек.
    """
    if not getattr(settings_obj, "enable_delivery", False):
        return []

    fee = str(getattr(settings_obj, "delivery_fee", 0) or 0)
    distance_m = None
    if (
        dest_lat is not None
        and dest_lon is not None
        and origin_lat is not None
        and origin_lon is not None
    ):
        try:
            distance_m = haversine_m(
                float(origin_lat), float(origin_lon), float(dest_lat), float(dest_lon)
            )
        except (TypeError, ValueError):
            distance_m = None

    out: list[dict] = []

    if getattr(settings_obj, "enable_own_courier", True):
        fallback = (getattr(settings_obj, "own_eta_text", None) or "1–3 часа").strip()
        out.append(
            {
                "id": "own",
                "label": "Курьер продавца",
                "eta": format_courier_eta(distance_m, kind="own", fallback=fallback),
                "fee": fee,
                "needs_credentials": False,
                "ready": True,
                "distance_m": round(distance_m) if distance_m is not None else None,
            }
        )

    if getattr(settings_obj, "enable_yandex_delivery", False):
        has_token = bool((getattr(settings_obj, "yandex_delivery_token", "") or "").strip())
        fallback = (getattr(settings_obj, "yandex_eta_text", None) or "от 40 минут").strip()
        out.append(
            {
                "id": "yandex",
                "label": "Яндекс Доставка",
                "eta": format_courier_eta(distance_m, kind="yandex", fallback=fallback),
                "fee": fee,
                "needs_credentials": True,
                "ready": has_token,
                "distance_m": round(distance_m) if distance_m is not None else None,
            }
        )

    if getattr(settings_obj, "enable_cdek_delivery", False):
        has_keys = bool(
            (getattr(settings_obj, "cdek_client_id", "") or "").strip()
            and (getattr(settings_obj, "cdek_client_secret", "") or "").strip()
        )
        out.append(
            {
                "id": "cdek",
                "label": "СДЭК",
                "eta": (getattr(settings_obj, "cdek_eta_text", None) or "1–5 дней").strip(),
                "fee": fee,
                "needs_credentials": True,
                "ready": has_keys,
                "distance_m": None,
            }
        )

    if getattr(settings_obj, "enable_russian_post", False):
        has_keys = bool(
            (getattr(settings_obj, "russian_post_token", "") or "").strip()
            and (getattr(settings_obj, "russian_post_user_key", "") or "").strip()
        )
        out.append(
            {
                "id": "russian_post",
                "label": "Почта России",
                "eta": (getattr(settings_obj, "russian_post_eta_text", None) or "3–10 дней").strip(),
                "fee": fee,
                "needs_credentials": True,
                "ready": has_keys,
                "distance_m": None,
            }
        )

    if getattr(settings_obj, "enable_dostavista", False):
        has_token = bool((getattr(settings_obj, "dostavista_token", "") or "").strip())
        fallback = (getattr(settings_obj, "dostavista_eta_text", None) or "1–3 часа").strip()
        out.append(
            {
                "id": "dostavista",
                "label": "Dostavista",
                "eta": format_courier_eta(distance_m, kind="dostavista", fallback=fallback),
                "fee": fee,
                "needs_credentials": True,
                "ready": has_token,
                "distance_m": round(distance_m) if distance_m is not None else None,
            }
        )

    return [m for m in out if m.get("ready")]


def resolve_order_delivery_kind(order, settings_obj) -> str:
    chosen = (getattr(order, "chosen_delivery_provider", None) or "").strip()
    if chosen in KNOWN_DELIVERY_KINDS:
        return chosen
    return (getattr(settings_obj, "delivery_provider", None) or "own").strip() or "own"
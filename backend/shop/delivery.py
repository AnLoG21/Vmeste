"""Абстракция провайдеров доставки. v1 — свой курьер; Яндекс/СДЭК — заглушки под ключи."""

from __future__ import annotations

from dataclasses import dataclass


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


class OwnCourierProvider(DeliveryProvider):
    kind = "own"

    def create_shipment(self, order) -> ShipmentResult:
        return ShipmentResult(tracking_id=f"own-{order.id}", provider=self.kind, status="assigned")

    def sync_status(self, tracking_id: str) -> str:
        return "delivering"


class YandexDeliveryProvider(DeliveryProvider):
    """Заглушка: подключение по API Яндекс Доставки после договора и токена."""

    kind = "yandex"

    def __init__(self, token: str = ""):
        self.token = (token or "").strip()

    def create_shipment(self, order) -> ShipmentResult:
        if not self.token:
            raise RuntimeError("Не указан токен Яндекс Доставки в настройках магазина")
        # TODO: POST в API Яндекс Доставки
        raise RuntimeError("Интеграция Яндекс Доставки ещё не подключена — используйте своего курьера")

    def sync_status(self, tracking_id: str) -> str:
        raise RuntimeError("Интеграция Яндекс Доставки ещё не подключена")


class CdekProvider(DeliveryProvider):
    """Заглушка: СДЭК Open API после client_id/secret."""

    kind = "cdek"

    def __init__(self, client_id: str = "", client_secret: str = ""):
        self.client_id = (client_id or "").strip()
        self.client_secret = (client_secret or "").strip()

    def create_shipment(self, order) -> ShipmentResult:
        if not self.client_id or not self.client_secret:
            raise RuntimeError("Не указаны ключи СДЭК в настройках магазина")
        raise RuntimeError("Интеграция СДЭК ещё не подключена — используйте своего курьера")

    def sync_status(self, tracking_id: str) -> str:
        raise RuntimeError("Интеграция СДЭК ещё не подключена")


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

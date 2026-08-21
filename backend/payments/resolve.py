"""Единый выбор эквайера организации (кафе + booking)."""

from __future__ import annotations

from payments.gateway import provider_ready


def _cafe_settings(provider):
    cafe = getattr(provider, "cafe_settings", None)
    if cafe is not None:
        return cafe
    try:
        from cafe.models import CafeSettings

        return CafeSettings.objects.filter(provider=provider).first()
    except Exception:
        return None


def _booking_acquiring(provider):
    try:
        from booking.models import ProviderAcquiring

        return ProviderAcquiring.objects.filter(provider=provider).first()
    except Exception:
        return None


def resolve_org_payment_setup(provider) -> tuple[str, dict]:
    """
    Возвращает (provider_code, creds).
    Для кафе сначала CafeSettings, иначе ProviderAcquiring; для остальных — наоборот.
    Берётся первый готовый набор ключей; если ни один не готов — первый настроенный.
    """
    sphere = getattr(provider, "provider_sphere", "") or ""
    cafe = _cafe_settings(provider)
    acq = _booking_acquiring(provider)

    candidates: list[tuple[str, dict]] = []

    def add(code, creds):
        if not isinstance(creds, dict):
            return
        candidates.append(((code or "yookassa").strip() or "yookassa", creds))

    if sphere == "cafe_restaurant":
        if cafe:
            add(getattr(cafe, "payment_provider", None), cafe.payment_creds())
        if acq:
            add(getattr(acq, "payment_provider", None), acq.payment_creds())
    else:
        if acq:
            add(getattr(acq, "payment_provider", None), acq.payment_creds())
        if cafe:
            add(getattr(cafe, "payment_provider", None), cafe.payment_creds())

    for code, creds in candidates:
        if provider_ready(code, creds):
            return code, creds
    if candidates:
        return candidates[0]
    return "yookassa", {}

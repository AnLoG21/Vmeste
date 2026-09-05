"""First-setup checklist items by provider sphere (P3 onboarding)."""

from __future__ import annotations


def build_setup_progress(provider) -> list[dict]:
    """
    Return up to 3 checklist steps for an organization owner (or staff employer).
    Each item: {id, label, done, view}.
    """
    if not provider or str(getattr(provider, "role", "")) != "provider":
        return []

    sphere = (getattr(provider, "provider_sphere", None) or "").strip()
    steps: list[dict] = []

    if sphere == "marketplaces":
        steps.append(_marketplace_keys_step(provider))
        steps.append(_map_address_step(provider, optional_for_mp=True))
        steps.append(
            {
                "id": "marketplaces_catalog",
                "label": "Создайте или импортируйте первую карточку товара",
                "done": _has_marketplace_history(provider),
                "view": "marketplaces",
            }
        )
    elif sphere == "cafe_restaurant":
        steps.append(_map_address_step(provider))
        steps.append(
            {
                "id": "cafe_menu",
                "label": "Добавьте блюда в меню",
                "done": _has_cafe_menu(provider),
                "view": "cafe",
            }
        )
        steps.append(
            {
                "id": "cafe_floor",
                "label": "Настройте зал или режимы заказа",
                "done": _has_cafe_floor_or_modes(provider),
                "view": "cafe",
            }
        )
    else:
        # hair_salon / service_center / default booking orgs
        steps.append(_map_address_step(provider))
        steps.append(
            {
                "id": "services",
                "label": "Добавьте хотя бы одну услугу",
                "done": _has_services(provider),
                "view": "services",
            }
        )
        steps.append(
            {
                "id": "intervals",
                "label": "Откройте слоты в календаре интервалов",
                "done": _has_availability(provider),
                "view": "intervals",
            }
        )

    return steps[:3]


def _map_address_step(provider, *, optional_for_mp: bool = False) -> dict:
    lat = getattr(provider, "organization_latitude", None)
    lng = getattr(provider, "organization_longitude", None)
    done = lat is not None and lng is not None
    label = (
        "Укажите точку на карте (необязательно для витрины МП)"
        if optional_for_mp
        else "Укажите адрес организации на карте"
    )
    return {"id": "map_address", "label": label, "done": bool(done), "view": "organization"}


def _marketplace_keys_step(provider) -> dict:
    try:
        from marketplaces.models import MarketplaceSettings

        s = MarketplaceSettings.objects.filter(provider_id=provider.id).first()
        done = bool(s and (s.has_ozon() or s.has_wb()))
    except Exception:
        done = False
    return {
        "id": "marketplace_keys",
        "label": "Подключите ключи Ozon или Wildberries",
        "done": done,
        "view": "marketplaces",
    }


def _has_marketplace_history(provider) -> bool:
    try:
        from marketplaces.models import MarketplaceProductHistory

        return MarketplaceProductHistory.objects.filter(provider_id=provider.id).exists()
    except Exception:
        return False


def _has_cafe_menu(provider) -> bool:
    try:
        from cafe.models import CafeMenuItem

        return CafeMenuItem.objects.filter(category__provider_id=provider.id, is_active=True).exists()
    except Exception:
        return False


def _has_cafe_floor_or_modes(provider) -> bool:
    try:
        from cafe.models import CafeFloorPlan, CafeSettings, CafeTable

        if CafeTable.objects.filter(floor_plan__provider_id=provider.id).exists():
            return True
        if CafeFloorPlan.objects.filter(provider_id=provider.id).exists():
            return True
        s = CafeSettings.objects.filter(provider_id=provider.id).first()
        if not s:
            return False
        # Default dine_in=True alone does not count as "set up".
        return bool(s.enable_takeaway or s.enable_delivery)
    except Exception:
        return False


def _has_services(provider) -> bool:
    try:
        from catalog.models import Service

        return Service.objects.filter(provider_id=provider.id, is_active=True).exists()
    except Exception:
        return False


def _has_availability(provider) -> bool:
    try:
        from booking.models import AvailabilitySlot

        return AvailabilitySlot.objects.filter(provider_id=provider.id).exists()
    except Exception:
        return False

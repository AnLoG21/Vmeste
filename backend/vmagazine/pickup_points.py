"""Pickup addresses for shop orders: main office + branches."""

from __future__ import annotations


def _f(val):
    if val is None or val == "":
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def pickup_points_for_provider(provider) -> list[dict]:
    """Main organization address plus ProviderLocation branches with coordinates."""
    points: list[dict] = []
    if not provider:
        return points

    main_lat = _f(getattr(provider, "organization_latitude", None))
    main_lon = _f(getattr(provider, "organization_longitude", None))
    main_addr = (getattr(provider, "organization_address", None) or "").strip()
    if main_addr or (main_lat is not None and main_lon is not None):
        points.append(
            {
                "id": "main",
                "title": "Основной адрес",
                "address": main_addr,
                "lat": main_lat,
                "lon": main_lon,
                "is_main": True,
            }
        )

    try:
        from locations.models import ProviderLocation

        for loc in ProviderLocation.objects.filter(provider_id=provider.id).order_by("id"):
            lat = _f(loc.latitude)
            lon = _f(loc.longitude)
            points.append(
                {
                    "id": f"loc-{loc.id}",
                    "title": (loc.title or "Филиал").strip()[:150],
                    "address": (loc.address or "").strip()[:255],
                    "lat": lat,
                    "lon": lon,
                    "is_main": False,
                }
            )
    except Exception:
        pass

    return points

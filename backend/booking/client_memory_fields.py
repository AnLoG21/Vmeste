"""Sphere-specific CRM memory field catalogs for ProviderClientCard."""

from __future__ import annotations

# Shared notes always available where CRM is on
_NOTES = {
    "technical_notes": True,
    "preferences_notes": True,
    "allergies": True,
}

SALON_MEMORY_FIELDS = {
    "hair_color": True,
    "lash_length": True,
    "lash_curl": True,
    "nail_shape": True,
    "wax_brand": True,
    "materials": True,
    "music": True,
    "drink": True,
    "talk_topics": True,
    **_NOTES,
}

AUTO_MEMORY_FIELDS = {
    "vehicle_title": True,
    "vehicle_plate": True,
    "vehicle_vin": True,
    "vehicle_year": True,
    "mileage_km": True,
    "oil_spec": True,
    "tire_size": True,
    "last_works": True,
    "parts_notes": True,
    "materials": True,
    **_NOTES,
}

SHOP_MEMORY_FIELDS = {
    "preferred_size": True,
    "delivery_pref": True,
    "purchase_notes": True,
    "materials": False,
    **_NOTES,
}

# Union of all tech/personal JSON keys we accept on PATCH
ALL_TECH_KEYS = (
    "hair_color",
    "lash_length",
    "lash_curl",
    "nail_shape",
    "wax_brand",
    "materials",
    "vehicle_title",
    "vehicle_plate",
    "vehicle_vin",
    "vehicle_year",
    "mileage_km",
    "oil_spec",
    "tire_size",
    "last_works",
    "parts_notes",
    "preferred_size",
    "delivery_pref",
    "purchase_notes",
)

ALL_PERSONAL_KEYS = (
    "music",
    "drink",
    "allergies",
    "talk_topics",
)

# Spheres that should not expose «База клиентов» at all
CLIENT_BASE_DISABLED_SPHERES = frozenset({"marketplaces", "cafe_restaurant"})


def memory_fields_for_sphere(sphere: str | None) -> dict[str, bool]:
    s = (sphere or "").strip()
    if s == "service_center":
        return dict(AUTO_MEMORY_FIELDS)
    if s == "shops":
        return dict(SHOP_MEMORY_FIELDS)
    # hair_salon and any other booking-like sphere
    return dict(SALON_MEMORY_FIELDS)


def merge_memory_field_prefs(raw, sphere: str | None) -> dict[str, bool]:
    base = memory_fields_for_sphere(sphere)
    out = dict(base)
    if isinstance(raw, dict):
        for key in base:
            if key in raw:
                out[key] = bool(raw[key])
    return out


def client_base_enabled_for_sphere(sphere: str | None) -> bool:
    return (sphere or "").strip() not in CLIENT_BASE_DISABLED_SPHERES

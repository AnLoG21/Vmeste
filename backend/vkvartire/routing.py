"""Commute filter without paid Yandex Router — haversine only.

Maps UI uses the project's existing Yandex Maps loader on the frontend when a key
is already configured; Вквартире does not call Distance Matrix / paid routing.
"""

from __future__ import annotations

from .geo import commute_radius_m, haversine_m


def filter_ids_by_commute(
    *,
    anchor_lat: float,
    anchor_lon: float,
    candidates: list[tuple[int, float, float]],
    max_commute_min: float,
    commute_mode: str = "walk",
) -> tuple[list[int], str]:
    """
    candidates: [(id, lat, lon), ...]
    Returns (kept_ids, method='haversine').
    """
    if not candidates or not max_commute_min:
        return [c[0] for c in candidates], "none"

    radius = commute_radius_m(max_commute_min, "transit" if commute_mode == "transit" else "walk")
    kept = []
    for lid, lat, lon in candidates:
        if haversine_m(anchor_lat, anchor_lon, lat, lon) <= radius:
            kept.append(lid)
    return kept, "haversine"

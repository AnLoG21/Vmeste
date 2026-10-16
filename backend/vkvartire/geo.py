"""Haversine helpers for commute-proxy radius filter."""

from __future__ import annotations

import math

# Approximate walking speed used for «N минут пешком» → metres
WALK_M_PER_MIN = 80.0
# Rough transit-inclusive average when mode=transit (slower than pure walk radius)
TRANSIT_M_PER_MIN = 220.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def commute_radius_m(max_commute_min: float, mode: str = "walk") -> float:
    speed = TRANSIT_M_PER_MIN if mode == "transit" else WALK_M_PER_MIN
    return float(max_commute_min) * speed


def bbox_around(lat: float, lon: float, radius_m: float) -> tuple[float, float, float, float]:
    """Return (lat_min, lat_max, lon_min, lon_max) approximating a circle."""
    dlat = radius_m / 111_320.0
    cos_lat = max(0.01, abs(math.cos(math.radians(lat))))
    dlon = radius_m / (111_320.0 * cos_lat)
    return lat - dlat, lat + dlat, lon - dlon, lon + dlon

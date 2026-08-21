"""Delivery zones: polygons on the map + point-in-polygon checks."""

from __future__ import annotations

import uuid
from decimal import Decimal, InvalidOperation


def _to_decimal(value, default="0") -> Decimal:
    try:
        return Decimal(str(value if value is not None else default)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(str(default)).quantize(Decimal("0.01"))


def normalize_delivery_zones(raw) -> list[dict]:
    """Sanitize zones list for storage / API."""
    if not isinstance(raw, list):
        return []
    out = []
    colors = ["#ff6a00", "#2f5d50", "#1565c0", "#8b3a2a", "#7b1fa2", "#c62828"]
    for i, row in enumerate(raw[:20]):
        if not isinstance(row, dict):
            continue
        poly = row.get("polygon") or row.get("coordinates") or []
        if not isinstance(poly, list) or len(poly) < 3:
            continue
        points = []
        for p in poly[:80]:
            if not isinstance(p, (list, tuple)) or len(p) < 2:
                continue
            try:
                lat = float(p[0])
                lon = float(p[1])
            except (TypeError, ValueError):
                continue
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                continue
            points.append([round(lat, 6), round(lon, 6)])
        if len(points) < 3:
            continue
        # Close ring if needed
        if points[0] != points[-1]:
            points.append(list(points[0]))
        zid = str(row.get("id") or "").strip() or str(uuid.uuid4())
        name = str(row.get("name") or f"Зона {i + 1}").strip()[:80] or f"Зона {i + 1}"
        color = str(row.get("color") or colors[i % len(colors)])[:20]
        fee = _to_decimal(row.get("fee"), "0")
        min_order = _to_decimal(row.get("min_order"), "0")
        out.append(
            {
                "id": zid,
                "name": name,
                "color": color,
                "fee": str(fee),
                "min_order": str(min_order),
                "polygon": points,
            }
        )
    return out


def point_in_polygon(lat: float, lon: float, polygon: list) -> bool:
    """Ray casting. polygon = [[lat, lon], ...]."""
    if not polygon or len(polygon) < 3:
        return False
    pts = list(polygon)
    if pts[0] != pts[-1]:
        pts = pts + [pts[0]]
    inside = False
    j = len(pts) - 1
    for i in range(len(pts)):
        lat_i, lon_i = float(pts[i][0]), float(pts[i][1])
        lat_j, lon_j = float(pts[j][0]), float(pts[j][1])
        if ((lat_i > lat) != (lat_j > lat)) and (
            lon < (lon_j - lon_i) * (lat - lat_i) / ((lat_j - lat_i) or 1e-12) + lon_i
        ):
            inside = not inside
        j = i
    return inside


def find_delivery_zone(lat: float, lon: float, zones) -> dict | None:
    zones = normalize_delivery_zones(zones)
    for z in zones:
        if point_in_polygon(lat, lon, z.get("polygon") or []):
            return z
    return None

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
            lat = lon = None
            if isinstance(p, dict):
                try:
                    lat = float(p.get("lat", p.get("latitude")))
                    lon = float(p.get("lon", p.get("lng", p.get("longitude"))))
                except (TypeError, ValueError):
                    continue
            elif isinstance(p, (list, tuple)) and len(p) >= 2:
                try:
                    a, b = float(p[0]), float(p[1])
                except (TypeError, ValueError):
                    continue
                # Яндекс: [lat, lon]; GeoJSON иногда [lon, lat]
                if abs(a) <= 90 and abs(b) <= 180:
                    lat, lon = a, b
                elif abs(b) <= 90 and abs(a) <= 180:
                    lat, lon = b, a
                else:
                    continue
            else:
                continue
            if lat is None or lon is None:
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


def quote_delivery_for_point(
    *,
    zones,
    fallback_fee,
    fallback_min_order,
    lat: float | None,
    lon: float | None,
    items_total,
) -> tuple[Decimal | None, dict | None, str | None]:
    """
    Resolve delivery fee for a cart point.
    Returns (fee, zone_or_none, error_message_or_none).
    """
    zones = normalize_delivery_zones(zones)
    items_total = _to_decimal(items_total, "0")
    fallback_fee = _to_decimal(fallback_fee, "0")
    fallback_min = _to_decimal(fallback_min_order, "0")

    if zones:
        if lat is None or lon is None:
            return None, None, "Укажите точку доставки на карте — адрес должен попадать в зону."
        try:
            d_lat = float(lat)
            d_lon = float(lon)
        except (TypeError, ValueError):
            return None, None, "Укажите точку доставки на карте — адрес должен попадать в зону."
        zone = find_delivery_zone(d_lat, d_lon, zones)
        if not zone:
            return None, None, "Адрес вне зон доставки. Выберите точку внутри выделенной области на карте."
        zone_min = _to_decimal(zone.get("min_order"), "0")
        zone_fee = _to_decimal(zone.get("fee"), "0")
        if zone_min <= 0:
            zone_min = fallback_min
        if zone_fee < 0:
            zone_fee = fallback_fee
        if zone_min > 0 and items_total < zone_min:
            return None, zone, f"Минимальная сумма заказа для доставки: {zone_min} ₽."
        return zone_fee, zone, None

    if fallback_min > 0 and items_total < fallback_min:
        return None, None, f"Минимальная сумма для доставки: {fallback_min} ₽."
    return fallback_fee, None, None

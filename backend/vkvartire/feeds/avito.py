"""Parse Avito Autoload XML (official partner feed format)."""

from __future__ import annotations

import xml.etree.ElementTree as ET


def _text(el, default="") -> str:
    if el is None or el.text is None:
        return default
    return str(el.text).strip()


def _child(parent, *names):
    for name in names:
        node = parent.find(name)
        if node is not None:
            return node
    return None


def _rooms(raw: str) -> int | None:
    s = (raw or "").strip().lower()
    if not s:
        return None
    if "студ" in s:
        return 0
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return None
    n = int(digits)
    return min(n, 5)


def _deal(operation: str, category: str = "") -> str | None:
    blob = f"{operation} {category}".lower()
    if any(x in blob for x in ("сдам", "аренда", "снять", "сдаю")):
        return "rent"
    if any(x in blob for x in ("продам", "продажа", "купить", "продаю")):
        return "sale"
    return None


def parse_avito_xml(xml_bytes: bytes | str) -> list[dict]:
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")
    root = ET.fromstring(xml_bytes)
    ads = root.findall(".//Ad") or root.findall("Ad")
    out = []
    for ad in ads:
        external_id = _text(_child(ad, "Id", "id"))
        deal = _deal(_text(_child(ad, "OperationType", "Operation")), _text(_child(ad, "Category")))
        if not deal:
            continue
        price_raw = _text(_child(ad, "Price", "price"))
        try:
            price = int(float(price_raw.replace(" ", "").replace(",", ".")))
        except (TypeError, ValueError):
            continue
        rooms = _rooms(_text(_child(ad, "Rooms", "RoomType", "rooms")))
        if rooms is None:
            rooms = 1
        area_raw = _text(_child(ad, "Square", "LivingSpace", "area"))
        floor_raw = _text(_child(ad, "Floor", "floor"))
        floors_raw = _text(_child(ad, "Floors", "HouseFloors", "floors"))
        lat = _text(_child(ad, "Latitude", "lat"))
        lon = _text(_child(ad, "Longitude", "lon"))
        photos = []
        images = ad.find("Images")
        if images is not None:
            for img in images.findall("Image"):
                url = img.attrib.get("url") or _text(img)
                if url:
                    photos.append(url)
        for img in ad.findall("Image"):
            url = img.attrib.get("url") or _text(img)
            if url:
                photos.append(url)

        row = {
            "deal_type": deal,
            "rooms": rooms,
            "price": price,
            "area_m2": area_raw or None,
            "floor": int(floor_raw) if floor_raw.isdigit() else None,
            "floors_total": int(floors_raw) if floors_raw.isdigit() else None,
            "address": _text(_child(ad, "Address", "address")),
            "lat": float(lat) if lat else None,
            "lon": float(lon) if lon else None,
            "metro_name": _text(_child(ad, "Metro", "metro")),
            "description": _text(_child(ad, "Description", "description")),
            "source": "avito",
            "external_id": external_id or "",
            "external_url": _text(_child(ad, "ListingUrl", "Url", "url")),
            "is_agent": True,
            "realtor_name": _text(_child(ad, "ManagerName", "ContactName", "SellerName")),
            "realtor_phone": _text(_child(ad, "ContactPhone", "Phone", "phone")),
            "realtor_email": _text(_child(ad, "Email", "email")),
            "photos": photos,
            "is_active": True,
        }
        try:
            if row["lat"] is not None:
                row["lat"] = float(row["lat"])
            if row["lon"] is not None:
                row["lon"] = float(row["lon"])
        except (TypeError, ValueError):
            row["lat"] = row["lon"] = None
        out.append(row)
    return out

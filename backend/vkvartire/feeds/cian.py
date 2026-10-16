"""Parse Cian partner XML / Yandex-Realty-like feeds commonly used by agencies."""

from __future__ import annotations

import xml.etree.ElementTree as ET


def _text(el, default="") -> str:
    if el is None or el.text is None:
        return default
    return str(el.text).strip()


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _find(parent, *names):
    want = {n.lower() for n in names}
    for child in list(parent):
        if _local(child.tag).lower() in want:
            return child
    return None


def _findall(parent, *names):
    want = {n.lower() for n in names}
    return [c for c in list(parent) if _local(c.tag).lower() in want]


def _rooms(raw: str) -> int | None:
    s = (raw or "").strip().lower()
    if not s:
        return None
    if "студ" in s:
        return 0
    digits = "".join(ch for ch in s if ch.isdigit())
    if not digits:
        return None
    return min(int(digits), 5)


def _deal(offer) -> str | None:
    t = _text(_find(offer, "type", "category", "deal-status", "operation")).lower()
    if any(x in t for x in ("rent", "аренда", "сдам", "снят")):
        return "rent"
    if any(x in t for x in ("sale", "продаж", "продам", "купить")):
        return "sale"
    # Yandex Realty: type=продажа|аренда
    cat = _text(_find(offer, "category")).lower()
    if "аренд" in cat:
        return "rent"
    if "продаж" in cat or cat == "квартира":
        # ambiguous — look at price period
        period = _text(_find(offer, "price", "period")).lower()
        if "месяц" in period or "month" in period:
            return "rent"
    return None


def parse_cian_xml(xml_bytes: bytes | str) -> list[dict]:
    if isinstance(xml_bytes, str):
        xml_bytes = xml_bytes.encode("utf-8")
    root = ET.fromstring(xml_bytes)
    offers = []
    for node in root.iter():
        name = _local(node.tag).lower()
        if name in ("offer", "object", "ad", "item"):
            offers.append(node)

    out = []
    for offer in offers:
        deal = _deal(offer)
        # Explicit type child
        type_el = _find(offer, "type")
        if type_el is not None:
            tt = _text(type_el).lower()
            if "аренд" in tt or tt == "rent":
                deal = "rent"
            elif "продаж" in tt or tt == "sale":
                deal = "sale"
        if not deal:
            continue

        price_el = _find(offer, "price", "value")
        price_raw = _text(price_el)
        if price_el is not None and price_el.find("value") is not None:
            price_raw = _text(price_el.find("value"))
        try:
            price = int(float(price_raw.replace(" ", "").replace(",", ".")))
        except (TypeError, ValueError):
            continue

        rooms = _rooms(_text(_find(offer, "rooms", "rooms-offered", "room")))
        if rooms is None:
            rooms = 1

        area = _text(_find(offer, "area", "living-space", "square"))
        if area and not area.replace(".", "").isdigit():
            # nested value
            area_el = _find(offer, "area", "living-space")
            if area_el is not None:
                area = _text(_find(area_el, "value")) or area

        location = _find(offer, "location", "address")
        address = _text(location) if location is not None and _local(location.tag).lower() == "address" else ""
        if location is not None and not address:
            address = ", ".join(
                filter(
                    None,
                    [
                        _text(_find(location, "locality-name", "city")),
                        _text(_find(location, "address", "street")),
                        _text(_find(location, "house")),
                    ],
                )
            )
        if not address:
            address = _text(_find(offer, "address"))

        lat = _text(_find(location, "latitude", "lat") if location is not None else None) or _text(
            _find(offer, "latitude", "lat")
        )
        lon = _text(_find(location, "longitude", "lon") if location is not None else None) or _text(
            _find(offer, "longitude", "lon")
        )

        photos = []
        for img in _findall(offer, "image", "photo"):
            url = img.attrib.get("url") or _text(img)
            if url:
                photos.append(url)
        images = _find(offer, "images", "photos")
        if images is not None:
            for img in list(images):
                url = img.attrib.get("url") or _text(img)
                if url:
                    photos.append(url)

        external_id = (
            offer.attrib.get("internal-id")
            or offer.attrib.get("id")
            or _text(_find(offer, "id", "external-id"))
        )

        floor = _text(_find(offer, "floor"))
        floors = _text(_find(offer, "floors-total", "floors"))

        row = {
            "deal_type": deal,
            "rooms": rooms,
            "price": price,
            "area_m2": area or None,
            "floor": int(floor) if floor.isdigit() else None,
            "floors_total": int(floors) if floors.isdigit() else None,
            "address": address,
            "lat": float(lat) if lat else None,
            "lon": float(lon) if lon else None,
            "metro_name": _text(_find(offer, "metro", "subway")),
            "description": _text(_find(offer, "description")),
            "source": "cian",
            "external_id": external_id or "",
            "external_url": _text(_find(offer, "url", "link")),
            "is_agent": True,
            "realtor_name": _text(_find(offer, "sales-agent", "name"))
            or _text(_find(_find(offer, "sales-agent") or offer, "name")),
            "realtor_phone": _text(_find(offer, "phone"))
            or _text(_find(_find(offer, "sales-agent") or offer, "phone")),
            "realtor_email": _text(_find(offer, "email"))
            or _text(_find(_find(offer, "sales-agent") or offer, "email")),
            "photos": photos,
            "is_active": True,
        }
        agent = _find(offer, "sales-agent")
        if agent is not None:
            row["realtor_name"] = row["realtor_name"] or _text(_find(agent, "name"))
            row["realtor_phone"] = row["realtor_phone"] or _text(_find(agent, "phone"))
            row["realtor_email"] = row["realtor_email"] or _text(_find(agent, "email"))
        try:
            if row["lat"] is not None:
                row["lat"] = float(row["lat"])
            if row["lon"] is not None:
                row["lon"] = float(row["lon"])
        except (TypeError, ValueError):
            row["lat"] = row["lon"] = None
        out.append(row)
    return out

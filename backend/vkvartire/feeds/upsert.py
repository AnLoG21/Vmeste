"""Shared upsert for feed / JSON import rows."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from vkvartire.models import Listing, ListingPhoto


def _dec(value):
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def upsert_listing_dicts(rows: list[dict], *, source_default: str = "other") -> tuple[int, int, int]:
    created = updated = skipped = 0
    for row in rows:
        if not isinstance(row, dict):
            skipped += 1
            continue
        deal_type = (row.get("deal_type") or "").strip().lower()
        if deal_type not in (Listing.DealType.RENT, Listing.DealType.SALE):
            skipped += 1
            continue
        try:
            price = int(row["price"])
            rooms = int(row.get("rooms", 1))
        except (KeyError, TypeError, ValueError):
            skipped += 1
            continue

        source = (row.get("source") or source_default).strip().lower()
        if source not in dict(Listing.Source.choices):
            source = Listing.Source.OTHER
        external_id = (row.get("external_id") or "").strip()
        address = (row.get("address") or "").strip()
        area = _dec(row.get("area_m2"))
        fp = Listing.make_fingerprint(
            address=address,
            rooms=rooms,
            area_m2=area,
            price=price,
            deal_type=deal_type,
        )

        listing = None
        if source and external_id:
            listing = Listing.objects.filter(source=source, external_id=external_id).first()
        if listing is None:
            listing = Listing.objects.filter(fingerprint=fp, is_active=True).first()

        fields = {
            "deal_type": deal_type,
            "rooms": rooms,
            "price": price,
            "currency": (row.get("currency") or "RUB")[:3],
            "area_m2": area,
            "floor": row.get("floor"),
            "floors_total": row.get("floors_total"),
            "address": address,
            "lat": row.get("lat"),
            "lon": row.get("lon"),
            "metro_name": (row.get("metro_name") or "")[:128],
            "metro_walk_min": row.get("metro_walk_min"),
            "description": row.get("description") or "",
            "source": source,
            "external_id": external_id,
            "external_url": (row.get("external_url") or "")[:1024],
            "fingerprint": fp,
            "is_agent": bool(row.get("is_agent", False)),
            "is_active": bool(row.get("is_active", True)),
            "realtor_name": (row.get("realtor_name") or "")[:160],
            "realtor_phone": (row.get("realtor_phone") or "")[:32],
            "realtor_email": (row.get("realtor_email") or "")[:254],
        }
        realtor_id = row.get("realtor_id")
        if realtor_id:
            fields["realtor_id"] = int(realtor_id)

        if listing:
            for k, v in fields.items():
                setattr(listing, k, v)
            listing.save()
            updated += 1
        else:
            listing = Listing.objects.create(**fields)
            created += 1

        photos = row.get("photos") or []
        if isinstance(photos, list) and photos:
            listing.photos.all().delete()
            for i, url in enumerate(photos):
                if not url:
                    continue
                ListingPhoto.objects.create(listing=listing, url=str(url)[:1024], sort_order=i)

    return created, updated, skipped

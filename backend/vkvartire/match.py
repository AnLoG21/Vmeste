"""Match a Listing against a saved-search filters dict."""

from __future__ import annotations

from .geo import commute_radius_m, haversine_m
from .models import Listing


def _num(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def listing_matches_filters(listing: Listing, filters: dict | None) -> bool:
    f = filters if isinstance(filters, dict) else {}
    if not listing.is_active:
        return False

    deal = (f.get("deal_type") or "").strip().lower()
    if deal in (Listing.DealType.RENT, Listing.DealType.SALE) and listing.deal_type != deal:
        return False

    rooms = f.get("rooms")
    if rooms is not None and rooms != "":
        if isinstance(rooms, list):
            wanted = []
            for r in rooms:
                try:
                    wanted.append(int(r))
                except (TypeError, ValueError):
                    pass
            if wanted:
                ok = False
                for w in wanted:
                    if w >= 5 and listing.rooms >= 5:
                        ok = True
                    elif listing.rooms == w:
                        ok = True
                if not ok:
                    return False
        else:
            try:
                w = int(rooms)
                if w >= 5:
                    if listing.rooms < 5:
                        return False
                elif listing.rooms != w:
                    return False
            except (TypeError, ValueError):
                pass

    pmin = _num(f.get("price_min"))
    pmax = _num(f.get("price_max"))
    if pmin is not None and listing.price < pmin:
        return False
    if pmax is not None and listing.price > pmax:
        return False

    amin = _num(f.get("area_min"))
    amax = _num(f.get("area_max"))
    area = float(listing.area_m2) if listing.area_m2 is not None else None
    if amin is not None and (area is None or area < amin):
        return False
    if amax is not None and (area is None or area > amax):
        return False

    fmin = _num(f.get("floor_min"))
    fmax = _num(f.get("floor_max"))
    if fmin is not None and (listing.floor is None or listing.floor < fmin):
        return False
    if fmax is not None and (listing.floor is None or listing.floor > fmax):
        return False

    if f.get("no_agents") in (True, 1, "1", "true", "yes") and listing.is_agent:
        return False

    q = (f.get("q") or "").strip().lower()
    if q:
        blob = f"{listing.address} {listing.metro_name} {listing.description}".lower()
        if q not in blob:
            return False

    alat = _num(f.get("anchor_lat"))
    alon = _num(f.get("anchor_lon"))
    mins = _num(f.get("max_commute_min"))
    mode = (f.get("commute_mode") or "walk").strip().lower()
    if alat is not None and alon is not None and mins and listing.lat is not None and listing.lon is not None:
        radius = commute_radius_m(mins, "transit" if mode == "transit" else "walk")
        if haversine_m(alat, alon, listing.lat, listing.lon) > radius:
            return False
    elif alat is not None and alon is not None and mins:
        return False

    return True

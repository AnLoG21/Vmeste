"""Notify users whose saved searches match newly created listings."""

from __future__ import annotations

import logging

from .match import listing_matches_filters
from .models import Listing, SavedSearch

logger = logging.getLogger(__name__)


def notify_saved_searches_for_listing(listing: Listing) -> int:
    if not listing or not listing.is_active:
        return 0
    searches = list(SavedSearch.objects.filter(notify=True).select_related("user")[:300])
    matched_user_ids = []
    for s in searches:
        try:
            if listing_matches_filters(listing, s.filters):
                matched_user_ids.append(s.user_id)
        except Exception:
            logger.exception("saved search match failed id=%s", s.id)

    matched_user_ids = list(dict.fromkeys(matched_user_ids))
    if not matched_user_ids:
        return 0

    rooms = "студия" if listing.rooms == 0 else f"{listing.rooms}-комн."
    price = f"{listing.price:,}".replace(",", " ")
    title = "Вквартире: новое объявление"
    body = f"{rooms}, {price} ₽ — {listing.address or listing.metro_name or 'без адреса'}"
    try:
        from notifications.push import notify_users

        notify_users(
            matched_user_ids,
            kind="vkvartire",
            title=title,
            body=body,
            payload={"listing_id": listing.id, "path": "/vkvartire"},
            inbox=True,
        )
    except Exception:
        logger.exception("vkvartire notify_users failed")
        return 0
    return len(matched_user_ids)


def notify_saved_searches_for_listings(listings) -> int:
    total = 0
    for listing in listings:
        total += notify_saved_searches_for_listing(listing)
    return total

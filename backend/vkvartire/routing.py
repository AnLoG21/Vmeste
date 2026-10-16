"""Yandex Router Distance Matrix for commute ETA (optional; falls back to haversine)."""

from __future__ import annotations

import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

MATRIX_URL = "https://api.routing.yandex.net/v2/distancematrix"
MAX_DESTINATIONS = 40


def routing_api_key() -> str:
    return (
        (getattr(settings, "YANDEX_ROUTING_API_KEY", "") or "").strip()
        or (getattr(settings, "YANDEX_MAPS_API_KEY", "") or "").strip()
    )


def router_mode(commute_mode: str) -> str:
    if commute_mode == "transit":
        return "transit"
    if commute_mode == "driving":
        return "driving"
    return "walking"


def matrix_durations_sec(
    origin_lat: float,
    origin_lon: float,
    destinations: list[tuple[float, float]],
    *,
    mode: str = "walking",
) -> list[float | None] | None:
    """
    Return list of travel durations in seconds aligned with destinations.
    None entry = no route. Returns None if API unavailable / failed (caller should fallback).
    """
    key = routing_api_key()
    if not key or not destinations:
        return None

    # Batch to stay under API limits
    out: list[float | None] = []
    for i in range(0, len(destinations), MAX_DESTINATIONS):
        chunk = destinations[i : i + MAX_DESTINATIONS]
        dest_str = "|".join(f"{lat},{lon}" for lat, lon in chunk)
        params = urllib.parse.urlencode(
            {
                "apikey": key,
                "origins": f"{origin_lat},{origin_lon}",
                "destinations": dest_str,
                "mode": mode,
            }
        )
        url = f"{MATRIX_URL}?{params}"
        try:
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=8) as resp:
                data = resp.read()
            import json

            payload = json.loads(data.decode("utf-8"))
        except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, ValueError, OSError) as e:
            logger.info("Yandex routing matrix failed: %s", e)
            return None

        rows = payload.get("rows") or []
        if not rows:
            return None
        elements = rows[0].get("elements") or []
        for el in elements:
            status = (el.get("status") or "").upper()
            if status and status not in ("OK",):
                out.append(None)
                continue
            dur = el.get("duration")
            if isinstance(dur, dict):
                val = dur.get("value")
            else:
                val = dur
            try:
                out.append(float(val) if val is not None else None)
            except (TypeError, ValueError):
                out.append(None)
        # If API returned fewer elements, pad
        while len(out) < i + len(chunk):
            out.append(None)

    return out[: len(destinations)]


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
    Returns (kept_ids, method) where method is 'routing' or 'haversine'.
    """
    from .geo import commute_radius_m, haversine_m

    if not candidates or not max_commute_min:
        return [c[0] for c in candidates], "none"

    mode = router_mode(commute_mode)
    dests = [(lat, lon) for _, lat, lon in candidates]
    durations = matrix_durations_sec(anchor_lat, anchor_lon, dests, mode=mode)
    max_sec = float(max_commute_min) * 60.0

    if durations is not None and len(durations) == len(candidates):
        kept = []
        for (lid, _lat, _lon), sec in zip(candidates, durations):
            if sec is not None and sec <= max_sec:
                kept.append(lid)
        return kept, "routing"

    # Haversine fallback with generous radius for the mode
    radius = commute_radius_m(max_commute_min, "transit" if commute_mode == "transit" else "walk")
    kept = []
    for lid, lat, lon in candidates:
        if haversine_m(anchor_lat, anchor_lon, lat, lon) <= radius:
            kept.append(lid)
    return kept, "haversine"

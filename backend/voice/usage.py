"""Monthly SpeechKit minute quota per salon."""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.utils import timezone


def _maybe_reset_period(vs) -> None:
    now = timezone.now()
    from subscriptions.voice_entitlement import live_voice_subscription

    if live_voice_subscription(getattr(vs, "provider", None)):
        return
    start = vs.voice_minutes_period_start
    if not start or start + timedelta(days=31) < now:
        vs.voice_minutes_used = Decimal("0")
        vs.voice_minutes_period_start = now
        vs.save(update_fields=["voice_minutes_used", "voice_minutes_period_start"])


def remaining_minutes(vs) -> float:
    if vs is None:
        return 0.0
    _maybe_reset_period(vs)
    quota = float(vs.voice_minutes_quota or 0)
    if quota <= 0:
        return 9999.0
    used = float(vs.voice_minutes_used or 0)
    return max(0.0, round(quota - used, 1))


def can_use_speechkit(vs) -> bool:
    if vs is None:
        return False
    quota = float(vs.voice_minutes_quota or 0)
    if quota <= 0:
        return True
    return remaining_minutes(vs) > 0


def consume_voice_seconds(vs, seconds: float) -> bool:
    """Debit quota. Returns False if over limit (does not debit)."""
    if vs is None or seconds <= 0:
        return True
    _maybe_reset_period(vs)
    add = Decimal(str(round(seconds / 60.0, 2)))
    quota = Decimal(str(vs.voice_minutes_quota or 0))
    used = Decimal(str(vs.voice_minutes_used or 0))
    if quota > 0 and used + add > quota:
        return False
    vs.voice_minutes_used = used + add
    vs.save(update_fields=["voice_minutes_used"])
    return True

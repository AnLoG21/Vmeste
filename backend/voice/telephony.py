"""Normalize Mango / Novofon / generic telephony webhooks."""

from __future__ import annotations

from typing import Any


def normalize_inbound(payload: dict, *, ats: str = "generic") -> dict[str, Any]:
    """
    Unified event:
    {event, call_id, caller_phone, called_phone, text, hangup}
    """
    p = payload or {}
    ats = (ats or p.get("ats") or "generic").lower()

    if ats == "mango":
        # Mango Office: json with json, call_id, from, to, dtmf, etc.
        inner = p.get("json") if isinstance(p.get("json"), dict) else p
        event = str(inner.get("call_state") or inner.get("event") or p.get("event") or "incoming").lower()
        return {
            "event": _map_event(event),
            "call_id": str(inner.get("call_id") or inner.get("entry_id") or p.get("call_id") or ""),
            "caller_phone": str(inner.get("from") or inner.get("caller") or inner.get("from_number") or ""),
            "called_phone": str(inner.get("to") or inner.get("called") or inner.get("to_number") or ""),
            "text": str(inner.get("text") or inner.get("speech") or p.get("text") or "").strip(),
            "hangup": event in ("disconnected", "hangup", "end"),
        }

    if ats in ("novofon", "uis"):
        return {
            "event": _map_event(str(p.get("event") or p.get("notification") or "incoming").lower()),
            "call_id": str(p.get("call_session_id") or p.get("pbx_call_id") or p.get("call_id") or ""),
            "caller_phone": str(p.get("caller_id") or p.get("from") or p.get("phone") or ""),
            "called_phone": str(p.get("called_number") or p.get("to") or ""),
            "text": str(p.get("text") or p.get("speech_result") or "").strip(),
            "hangup": str(p.get("event") or "").lower() in ("hangup", "end", "completed"),
        }

    return {
        "event": _map_event(str(p.get("event") or "incoming").lower()),
        "call_id": str(p.get("call_id") or p.get("session_id") or ""),
        "caller_phone": str(p.get("caller_phone") or p.get("from") or p.get("phone") or ""),
        "called_phone": str(p.get("called_phone") or p.get("to") or ""),
        "text": str(p.get("text") or p.get("speech") or "").strip(),
        "hangup": bool(p.get("hangup")) or str(p.get("event") or "").lower() in ("hangup", "end"),
    }


def _map_event(raw: str) -> str:
    if raw in ("incoming", "ringing", "start", "appeared", "connected", "answered"):
        return "incoming"
    if raw in ("speech", "asr", "phrase", "text"):
        return "speech"
    if raw in ("hangup", "end", "disconnected", "completed"):
        return "hangup"
    return raw or "incoming"

"""Voice session turn processing."""

from __future__ import annotations

import logging
from typing import Any

from django.utils import timezone

from .booking_adapter import execute_tool, find_windows_for_voice, get_voice_catalog, match_service, match_staff, parse_after_time, parse_relative_date
from .llm import llm_plan_turn
from .models import ProviderVoiceSettings, VoiceCallSession, VoiceCallTurn
from .outbound import process_confirmation_response

logger = logging.getLogger(__name__)


def _history(session: VoiceCallSession) -> list[dict]:
    turns = session.turns.order_by("created_at")
    out = []
    for t in turns:
        if t.role in (VoiceCallTurn.Role.USER, VoiceCallTurn.Role.ASSISTANT):
            out.append({"role": t.role, "content": t.text})
    return out


def _append_turn(session: VoiceCallSession, role: str, text: str = "", tool_name: str = "", tool_payload: dict | None = None):
    VoiceCallTurn.objects.create(
        session=session,
        role=role,
        text=(text or "")[:4000],
        tool_name=tool_name or "",
        tool_payload=tool_payload or {},
    )


def _auto_tool_chain(provider_id: int, caller_phone: str, user_text: str) -> tuple[list[dict], dict | None]:
    """
    Rule path after match_service: chain find_windows for complex phrases.
    Returns (tool_results, pending_window)
    """
    results: list[dict] = []
    catalog = get_voice_catalog(provider_id)
    svc = match_service(provider_id, user_text)
    if not svc:
        return results, None
    results.append({"match_service": svc})
    staff = match_staff(provider_id, user_text, svc["id"])
    staff_id = staff["id"] if staff else None
    if staff:
        results.append({"match_staff": staff})
    book_date = parse_relative_date(user_text) or parse_relative_date("завтра")
    if not book_date:
        dates = execute_tool(provider_id, caller_phone, "find_dates", {"service_id": svc["id"]})
        return results + [dates], None
    after = parse_after_time(user_text, catalog.get("working_hours"))
    windows = find_windows_for_voice(
        provider_id,
        svc["id"],
        book_date,
        staff_id=staff_id,
        staff_fallback=True,
        after_time=after,
    )
    payload = {"date": book_date.isoformat(), "windows": windows, "count": len(windows)}
    results.append(payload)
    pending = windows[0] if windows else None
    return results, pending


def process_turn(session: VoiceCallSession, user_text: str, *, greeting: str = "") -> dict[str, Any]:
    """
    Process user utterance; returns {say, action, booking_id, transfer_phone, session_id}.
    """
    user_text = (user_text or "").strip()
    ctx = dict(session.context or {})
    provider = session.provider
    settings_obj = ProviderVoiceSettings.objects.filter(provider=provider).first()
    transfer_phone = (settings_obj.transfer_phone if settings_obj else "") or ""

    if ctx.get("mode") == "confirm":
        if user_text:
            _append_turn(session, VoiceCallTurn.Role.USER, user_text)
        confirm = process_confirmation_response(session, user_text)
        if confirm:
            say = confirm.get("say") or ""
            _append_turn(session, VoiceCallTurn.Role.ASSISTANT, say)
            return {
                "say": say,
                "action": confirm.get("action") or "continue",
                "session_id": session.id,
                "booking_id": confirm.get("booking_id") or session.booking_id,
                "transfer_phone": transfer_phone or None,
            }

    if not user_text:
        say = greeting or (settings_obj.greeting_text if settings_obj else "") or "Здравствуйте! Чем могу помочь?"
        _append_turn(session, VoiceCallTurn.Role.ASSISTANT, say)
        return {
            "say": say,
            "action": "continue",
            "session_id": session.id,
            "booking_id": session.booking_id,
            "transfer_phone": transfer_phone or None,
        }

    _append_turn(session, VoiceCallTurn.Role.USER, user_text)

    # Confirm pending slot on "да"
    pending = ctx.get("pending_booking")
    if pending and user_text.lower().strip() in ("да", "давай", "подтверждаю", "yes", "ок", "хорошо"):
        svc_id = ctx.get("service_id") or pending.get("service_id")
        if not svc_id and ctx.get("last_service"):
            svc_id = ctx["last_service"].get("id")
        if svc_id:
            book_res = execute_tool(
                provider.id,
                session.caller_phone,
                "create_booking",
                {
                    "service_id": svc_id,
                    "starts_at": pending["starts_at"],
                    "ends_at": pending["ends_at"],
                    "staff_id": pending.get("staff_id"),
                },
            )
            if book_res.get("booking_id"):
                session.booking_id = book_res["booking_id"]
                session.status = VoiceCallSession.Status.COMPLETED
                session.save(update_fields=["booking_id", "status"])
                say = f"Записала вас на {pending.get('starts_at', '')[:16].replace('T', ' ')}. До встречи!"
                _append_turn(session, VoiceCallTurn.Role.ASSISTANT, say)
                ctx.pop("pending_booking", None)
                session.context = ctx
                session.save(update_fields=["context"])
                return {
                    "say": say,
                    "action": "hangup",
                    "session_id": session.id,
                    "booking_id": book_res["booking_id"],
                    "transfer_phone": None,
                }

    catalog = get_voice_catalog(provider.id)
    org_name = catalog.get("organization_name") or "салон"
    tool_results: list[dict] = []
    plan = llm_plan_turn(
        organization_name=org_name,
        caller_phone=session.caller_phone,
        history=_history(session)[:-1],
        user_text=user_text,
    )
    if plan.get("transfer"):
        session.status = VoiceCallSession.Status.TRANSFERRED
        session.ended_at = timezone.now()
        session.save(update_fields=["status", "ended_at"])
        say = plan.get("reply") or "Соединяю с администратором."
        _append_turn(session, VoiceCallTurn.Role.ASSISTANT, say)
        return {
            "say": say,
            "action": "transfer",
            "session_id": session.id,
            "booking_id": None,
            "transfer_phone": transfer_phone or None,
        }

    tool_calls = plan.get("tool_calls") or []
    if not tool_calls:
        # Auto chain for rule-based
        tool_results, pending_win = _auto_tool_chain(provider.id, session.caller_phone, user_text)
        if pending_win:
            svc = match_service(provider.id, user_text)
            if svc:
                ctx["last_service"] = svc
                ctx["service_id"] = svc["id"]
            ctx["pending_booking"] = pending_win
            session.context = ctx
            session.save(update_fields=["context"])
    else:
        for call in tool_calls[:4]:
            name = call.get("name") or call.get("tool")
            args = call.get("arguments") or call.get("args") or {}
            res = execute_tool(provider.id, session.caller_phone, name, args)
            tool_results.append({name: res})
            _append_turn(session, VoiceCallTurn.Role.TOOL, "", tool_name=name, tool_payload=res)
            if name == "match_service" and res.get("service"):
                ctx["last_service"] = res["service"]
                ctx["service_id"] = res["service"]["id"]
            if name == "find_windows" and res.get("windows"):
                ctx["pending_booking"] = res["windows"][0]
            if name == "create_booking" and res.get("booking_id"):
                session.booking_id = res["booking_id"]
                session.status = VoiceCallSession.Status.COMPLETED
                session.save(update_fields=["booking_id", "status"])

    if tool_results and not plan.get("reply"):
        plan = llm_plan_turn(
            organization_name=org_name,
            caller_phone=session.caller_phone,
            history=_history(session)[:-1],
            user_text=user_text,
            tool_results=tool_results,
        )

    say = (plan.get("reply") or "").strip()
    if not say and tool_results:
        for tr in tool_results:
            wins = tr.get("windows") if isinstance(tr, dict) else None
            if not wins:
                for v in tr.values() if isinstance(tr, dict) else []:
                    if isinstance(v, dict) and v.get("windows"):
                        wins = v["windows"]
            if wins:
                w = wins[0]
                say = f"Могу предложить {w.get('starts_at', '')[:16].replace('T', ' ')} у {w.get('staff_label', 'мастера')}. Записать?"
                ctx["pending_booking"] = w
                break
    if not say:
        say = "Уточните услугу и время, пожалуйста."

    session.context = ctx
    session.save(update_fields=["context"])
    _append_turn(session, VoiceCallTurn.Role.ASSISTANT, say)

    action = "hangup" if session.booking_id else "continue"
    return {
        "say": say,
        "action": action,
        "session_id": session.id,
        "booking_id": session.booking_id,
        "transfer_phone": transfer_phone or None,
    }


def get_or_create_session(
    *,
    provider,
    call_id: str,
    caller_phone: str,
) -> VoiceCallSession:
    if call_id:
        existing = VoiceCallSession.objects.filter(
            provider=provider,
            external_call_id=call_id,
            status=VoiceCallSession.Status.ACTIVE,
        ).first()
        if existing:
            return existing
    return VoiceCallSession.objects.create(
        provider=provider,
        external_call_id=call_id or "",
        caller_phone=caller_phone or "",
        context={},
    )


def close_session(session: VoiceCallSession):
    if session.status == VoiceCallSession.Status.ACTIVE:
        session.status = VoiceCallSession.Status.COMPLETED
    session.ended_at = timezone.now()
    session.save(update_fields=["status", "ended_at"])

"""Booking tools for voice orchestrator (wraps booking_windows + catalog)."""

from __future__ import annotations

import re
from datetime import date, datetime, time, timedelta
from typing import Any

from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from booking.booking_windows import book_time_window, list_available_dates, list_available_windows, staff_booking_label
from booking.models import ProviderStaff
from booking.public_widget import _get_or_create_guest_client, _normalize_phone
from catalog.models import Service

User = get_user_model()

SERVICE_SYNONYMS = {
    "маникюр": ["маникюр", "ногот", "ногти", "маник"],
    "педикюр": ["педикюр", "педик", "стоп"],
    "стрижка": ["стриж", "волос", "парикмах"],
    "окрашивание": ["окраш", "краск", "блонд"],
    "брови": ["бров", "архитектур"],
    "ресницы": ["ресниц", "наращ"],
}


def _digits(phone: str) -> str:
    return re.sub(r"\D+", "", phone or "")


def get_voice_catalog(provider_id: int) -> dict[str, Any]:
    provider = User.objects.filter(pk=provider_id, role=User.Role.PROVIDER).first()
    if not provider:
        return {"error": "Организация не найдена."}
    services = list(
        Service.objects.filter(provider_id=provider_id, is_active=True).order_by("name").values(
            "id", "name", "duration_minutes", "price"
        )
    )
    staff_links = list(
        ProviderStaff.objects.filter(
            provider_id=provider_id,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).select_related("staff")
    )
    staff = []
    for link in staff_links:
        u = link.staff
        staff.append(
            {
                "id": u.id,
                "label": staff_booking_label(u),
                "first_name": (u.first_name or "").strip(),
                "job_title": (link.job_title or "").strip(),
            }
        )
    return {
        "organization_name": provider.organization_name or provider.username,
        "services": services,
        "staff": staff,
        "working_hours": provider.organization_working_hours or {},
    }


def match_service(provider_id: int, query: str) -> dict[str, Any] | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    services = list(Service.objects.filter(provider_id=provider_id, is_active=True))
    if not services:
        return None
    for svc in services:
        name = (svc.name or "").lower()
        if q in name or name in q:
            return {"id": svc.id, "name": svc.name, "duration_minutes": svc.duration_minutes}
    for _key, words in SERVICE_SYNONYMS.items():
        if any(w in q for w in words):
            for svc in services:
                sn = (svc.name or "").lower()
                if any(w in sn for w in words):
                    return {"id": svc.id, "name": svc.name, "duration_minutes": svc.duration_minutes}
    best = None
    best_score = 0
    for svc in services:
        name = (svc.name or "").lower()
        score = sum(1 for part in q.split() if len(part) > 2 and part in name)
        if score > best_score:
            best_score = score
            best = svc
    if best and best_score > 0:
        return {"id": best.id, "name": best.name, "duration_minutes": best.duration_minutes}
    return None


def match_staff(provider_id: int, query: str, service_id: int | None = None) -> dict[str, Any] | None:
    q = (query or "").strip().lower()
    if not q:
        return None
    links = list(
        ProviderStaff.objects.filter(
            provider_id=provider_id,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).select_related("staff")
    )
    if service_id:
        from booking.booking_windows import _staff_ids_for_service

        try:
            svc = Service.objects.get(pk=service_id, provider_id=provider_id)
            allowed = set(_staff_ids_for_service(provider_id, svc))
            links = [l for l in links if l.staff_id in allowed or None in allowed]
        except Service.DoesNotExist:
            pass
    for link in links:
        u = link.staff
        fn = (u.first_name or "").lower()
        ln = (u.last_name or "").lower()
        label = staff_booking_label(u).lower()
        if q in fn or q in label or (fn and fn.startswith(q[:3])):
            return {"id": u.id, "label": staff_booking_label(u)}
    return None


def parse_relative_date(text: str, today: date | None = None) -> date | None:
    t = (text or "").lower()
    base = today or timezone.localdate()
    if "послезавтра" in t:
        return base + timedelta(days=2)
    if "завтра" in t:
        return base + timedelta(days=1)
    if "сегодня" in t:
        return base
    m = re.search(r"(\d{1,2})[./](\d{1,2})", t)
    if m:
        d, mo = int(m.group(1)), int(m.group(2))
        y = base.year
        try:
            return date(y, mo, d)
        except ValueError:
            return None
    return None


def parse_after_time(text: str, working_hours: dict | None = None) -> time | None:
    t = (text or "").lower()
    if "после работ" in t or "вечер" in t or "после 18" in t:
        return time(18, 0)
    m = re.search(r"после\s+(\d{1,2})(?::(\d{2}))?", t)
    if m:
        h = int(m.group(1))
        mi = int(m.group(2) or 0)
        if 0 <= h <= 23:
            return time(h, mi)
    if working_hours and isinstance(working_hours, dict):
        # weekday end from org hours — rough default
        pass
    return None


def find_windows_for_voice(
    provider_id: int,
    service_id: int,
    book_date: date,
    *,
    staff_id: int | None = None,
    staff_fallback: bool = True,
    after_time: time | None = None,
    limit: int = 5,
) -> list[dict]:
    windows = list_available_windows(provider_id, service_id, book_date, staff_id=staff_id)
    if not windows and staff_id is not None and staff_fallback:
        windows = list_available_windows(provider_id, service_id, book_date, staff_id=None)
    if after_time:
        filtered = []
        for w in windows:
            starts = parse_datetime(w.get("starts_at") or "")
            if not starts:
                continue
            if timezone.is_naive(starts):
                starts = timezone.make_aware(starts, timezone.get_current_timezone())
            if starts.time() >= after_time:
                filtered.append(w)
        windows = filtered
    return windows[:limit]


def find_dates_for_voice(
    provider_id: int,
    service_id: int,
    *,
    staff_id: int | None = None,
    days: int = 14,
) -> list[str]:
    today = timezone.localdate()
    dates = list_available_dates(
        provider_id,
        service_id,
        today,
        today + timedelta(days=days),
        staff_id=staff_id,
    )
    return [d.isoformat() if hasattr(d, "isoformat") else str(d) for d in dates]


def create_voice_booking(
    provider_id: int,
    *,
    service_id: int,
    starts_at: str,
    ends_at: str,
    caller_phone: str,
    guest_name: str = "",
    staff_id: int | None = None,
    comment: str = "Запись с телефона (голосовой администратор)",
) -> dict[str, Any]:
    phone = _normalize_phone(caller_phone)
    if len(_digits(phone)) < 10:
        return {"error": "Не удалось определить номер телефона звонящего."}
    try:
        client = _get_or_create_guest_client(phone=phone, name=guest_name)
    except ValueError as e:
        return {"error": str(e)}
    starts = parse_datetime(starts_at)
    ends = parse_datetime(ends_at)
    if not starts or not ends:
        return {"error": "Некорректное время записи."}
    if timezone.is_naive(starts):
        starts = timezone.make_aware(starts, timezone.get_current_timezone())
    if timezone.is_naive(ends):
        ends = timezone.make_aware(ends, timezone.get_current_timezone())
    try:
        booking = book_time_window(
            provider_id,
            int(service_id),
            starts,
            ends,
            int(staff_id) if staff_id else None,
            client,
            comment[:250],
            notify=True,
        )
    except ValueError as e:
        return {"error": str(e)}
    svc = Service.objects.filter(pk=service_id).first()
    return {
        "booking_id": booking.id,
        "status": booking.status,
        "starts_at": starts.isoformat(),
        "service": svc.name if svc else "",
        "message": "Запись создана.",
    }


def execute_tool(provider_id: int, caller_phone: str, name: str, args: dict) -> dict[str, Any]:
    """Dispatch LLM / rule tool call."""
    tool = (name or "").strip()
    a = args or {}
    if tool == "list_catalog":
        return get_voice_catalog(provider_id)
    if tool == "match_service":
        svc = match_service(provider_id, a.get("query") or "")
        return {"service": svc} if svc else {"service": None, "hint": "Уточните услугу."}
    if tool == "match_staff":
        sid = a.get("service_id")
        st = match_staff(provider_id, a.get("query") or "", int(sid) if sid else None)
        return {"staff": st} if st else {"staff": None}
    if tool == "find_dates":
        dates = find_dates_for_voice(
            provider_id,
            int(a["service_id"]),
            staff_id=int(a["staff_id"]) if a.get("staff_id") else None,
        )
        return {"dates": dates[:10]}
    if tool == "find_windows":
        bd = a.get("date")
        if isinstance(bd, str):
            from django.utils.dateparse import parse_date

            book_date = parse_date(bd) or parse_relative_date(bd)
        else:
            book_date = parse_relative_date(str(bd or ""))
        if not book_date:
            return {"error": "Укажите дату."}
        catalog = get_voice_catalog(provider_id)
        after = None
        if a.get("after_time"):
            parts = str(a["after_time"]).split(":")
            after = time(int(parts[0]), int(parts[1]) if len(parts) > 1 else 0)
        elif a.get("time_hint"):
            after = parse_after_time(str(a["time_hint"]), catalog.get("working_hours"))
        staff_id = int(a["staff_id"]) if a.get("staff_id") else None
        windows = find_windows_for_voice(
            provider_id,
            int(a["service_id"]),
            book_date,
            staff_id=staff_id,
            staff_fallback=bool(a.get("staff_fallback", True)),
            after_time=after,
            limit=int(a.get("limit") or 5),
        )
        return {"date": book_date.isoformat(), "windows": windows, "count": len(windows)}
    if tool == "create_booking":
        return create_voice_booking(
            provider_id,
            service_id=int(a["service_id"]),
            starts_at=a["starts_at"],
            ends_at=a["ends_at"],
            caller_phone=caller_phone,
            guest_name=a.get("guest_name") or "",
            staff_id=int(a["staff_id"]) if a.get("staff_id") else None,
        )
    return {"error": f"Unknown tool {tool}"}

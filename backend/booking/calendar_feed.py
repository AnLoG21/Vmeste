"""ICS calendar feed for organization bookings (Google / Yandex subscribe-by-URL)."""

from __future__ import annotations

from datetime import timedelta

from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .acquiring import ensure_calendar_token, get_or_create_acquiring
from .models import Booking, ProviderAcquiring


def _ics_escape(text: str) -> str:
    return (
        str(text or "")
        .replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def _fmt_dt(dt) -> str:
    if timezone.is_naive(dt):
        dt = timezone.make_aware(dt, timezone.get_current_timezone())
    return timezone.localtime(dt).strftime("%Y%m%dT%H%M%S")


def build_bookings_ics(provider, bookings) -> str:
    org = (getattr(provider, "organization_name", None) or provider.username or "Вместе").strip()
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Vmeste//Bookings//RU",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_escape(org)} — Вместе",
    ]
    now = timezone.now()
    for b in bookings:
        starts = getattr(b, "slot_starts_at", None) or getattr(getattr(b, "slot", None), "starts_at", None)
        ends = getattr(b, "slot_ends_at", None) or getattr(getattr(b, "slot", None), "ends_at", None)
        if not starts:
            continue
        if not ends:
            ends = starts + timedelta(hours=1)
        service = getattr(b.service, "name", None) or "Запись"
        client = ""
        if b.client_id:
            client = (
                f"{(b.client.first_name or '').strip()} {(b.client.last_name or '').strip()}".strip()
                or b.client.username
            )
        summary = f"{service}" + (f" — {client}" if client else "")
        desc = f"Статус: {b.status}\\nЗапись #{b.id} · Вместе"
        uid = f"booking-{b.id}@vsevmeste.space"
        lines.extend(
            [
                "BEGIN:VEVENT",
                f"UID:{uid}",
                f"DTSTAMP:{_fmt_dt(now)}",
                f"DTSTART:{_fmt_dt(starts)}",
                f"DTEND:{_fmt_dt(ends)}",
                f"SUMMARY:{_ics_escape(summary)}",
                f"DESCRIPTION:{_ics_escape(desc)}",
                "END:VEVENT",
            ]
        )
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


class CalendarFeedView(APIView):
    """Public ICS feed: GET /api/booking/calendar/<token>.ics"""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        acq = ProviderAcquiring.objects.select_related("provider").filter(calendar_ics_token=token).first()
        if not acq or not token:
            return Response(status=status.HTTP_404_NOT_FOUND)
        provider = acq.provider
        since = timezone.now() - timedelta(days=14)
        until = timezone.now() + timedelta(days=120)
        bookings = (
            Booking.objects.filter(provider=provider, slot__isnull=False)
            .exclude(status=Booking.Status.CANCELLED)
            .select_related("service", "client", "slot")
            .filter(slot__starts_at__gte=since, slot__starts_at__lte=until)
            .order_by("slot__starts_at")[:500]
        )
        ics = build_bookings_ics(provider, bookings)
        resp = HttpResponse(ics, content_type="text/calendar; charset=utf-8")
        resp["Content-Disposition"] = 'attachment; filename="vmeste-bookings.ics"'
        return resp


class CalendarSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from django.conf import settings as dj_settings

        token = ensure_calendar_token(request.user)
        front = (getattr(dj_settings, "FRONTEND_URL", "") or "https://vsevmeste.space").rstrip("/")
        # Feed is on API path (same host via nginx)
        ics_path = f"{front}/api/booking/calendar/{token}.ics"
        webcal = ics_path.replace("https://", "webcal://").replace("http://", "webcal://")
        return Response(
            {
                "ics_url": ics_path,
                "webcal_url": webcal,
                "google_url": f"https://calendar.google.com/calendar/r?cid={ics_path}",
                "yandex_hint": "Яндекс Календарь → Добавить календарь → Из интернета → вставьте ссылку ICS",
            }
        )

    def post(self, request):
        """Rotate calendar token."""
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        import secrets

        acq = get_or_create_acquiring(request.user)
        acq.calendar_ics_token = secrets.token_urlsafe(24)
        acq.save(update_fields=["calendar_ics_token"])
        return self.get(request)

"""Быстрая запись клиента организацией + публичное подтверждение визита."""

from __future__ import annotations

import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Service

from .booking_actions import client_display_name, format_booking_when
from .booking_windows import book_time_window, resolve_selected_options
from .models import Booking, ProviderStaff
from .phone_clients import client_brief, find_client_by_phone, get_or_create_client_by_phone, normalize_phone, phone_digits
from .serializers import BookingSerializer

User = get_user_model()


def _provider_context(user):
    """Вернуть (provider_id, is_allowed) для provider/staff с manage_bookings."""
    if not user or not getattr(user, "is_authenticated", False):
        return None, False
    if user.role == "provider":
        return user.id, True
    if user.role == "staff":
        link = (
            ProviderStaff.objects.filter(
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            )
            .order_by("id")
            .first()
        )
        if not link:
            return None, False
        perms = link.permissions or {}
        if not perms.get("manage_bookings", True):
            return None, False
        return link.provider_id, True
    return None, False


def ensure_client_confirm_token(booking: Booking) -> str:
    token = (booking.client_confirm_token or "").strip()
    if token:
        return token
    token = secrets.token_urlsafe(24)
    booking.client_confirm_token = token
    booking.save(update_fields=["client_confirm_token"])
    return token


def build_client_confirm_url(booking: Booking) -> str:
    front = (getattr(settings, "FRONTEND_URL", None) or "https://vsevmeste.space").rstrip("/")
    token = ensure_client_confirm_token(booking)
    return f"{front}/?visit_confirm={token}"


class ClientPhoneLookupView(APIView):
    """GET /api/booking/clients/lookup/?phone=… — найти клиента по телефону."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider_id, ok = _provider_context(request.user)
        if not ok:
            return Response(status=status.HTTP_403_FORBIDDEN)
        phone = (request.query_params.get("phone") or "").strip()
        if len(phone_digits(phone)) < 10:
            return Response({"detail": "Укажите телефон."}, status=status.HTTP_400_BAD_REQUEST)
        client = find_client_by_phone(phone)
        if not client:
            return Response(
                {
                    "found": False,
                    "normalized_phone": normalize_phone(phone),
                    "client": None,
                }
            )
        # Сколько визитов у этой организации
        visits = Booking.objects.filter(
            provider_id=provider_id,
            client_id=client.id,
            status=Booking.Status.DONE,
        ).count()
        brief = client_brief(client)
        brief["visits_done"] = visits
        return Response({"found": True, "normalized_phone": normalize_phone(phone), "client": brief})


class BookForClientView(APIView):
    """POST /api/booking/book-for-client/ — мастер записывает клиента на свободное окно."""

    permission_classes = [permissions.IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        provider_id, ok = _provider_context(request.user)
        if not ok:
            return Response(status=status.HTTP_403_FORBIDDEN)

        data = request.data or {}
        phone = (data.get("phone") or data.get("guest_phone") or "").strip()
        client_id = data.get("client") or data.get("client_id")
        name = (data.get("name") or data.get("guest_name") or "").strip()
        comment = (data.get("comment") or "")[:250]
        service_id = data.get("service") or data.get("service_id")
        starts_raw = data.get("starts_at")
        ends_raw = data.get("ends_at")
        staff_id = data.get("staff") or data.get("staff_id")
        option_ids = data.get("option_ids") or data.get("options") or []

        client = None
        if client_id not in (None, "", "null"):
            try:
                client = User.objects.filter(pk=int(client_id), role=User.Role.CLIENT).first()
            except (TypeError, ValueError):
                client = None
        if not client and phone:
            try:
                client = get_or_create_client_by_phone(phone=phone, name=name)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if not client:
            return Response(
                {"detail": "Укажите телефон или клиента."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if name:
            from .phone_clients import _apply_name

            _apply_name(client, name)

        if not service_id or not starts_raw:
            return Response(
                {"detail": "Укажите service и starts_at."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        starts_at = parse_datetime(str(starts_raw))
        if not starts_at:
            return Response({"detail": "Некорректное время начала."}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.is_naive(starts_at):
            starts_at = timezone.make_aware(starts_at, timezone.get_current_timezone())

        try:
            service = Service.objects.get(pk=int(service_id), provider_id=provider_id, is_active=True)
        except (Service.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Услуга не найдена."}, status=status.HTTP_400_BAD_REQUEST)

        snapshots = resolve_selected_options(service, option_ids)
        extra = sum(int(o.get("extra_minutes") or 0) for o in snapshots)
        duration = int(service.duration_minutes or 30) + extra

        if ends_raw:
            ends_at = parse_datetime(str(ends_raw))
            if not ends_at:
                return Response({"detail": "Некорректное время окончания."}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.is_naive(ends_at):
                ends_at = timezone.make_aware(ends_at, timezone.get_current_timezone())
        else:
            ends_at = starts_at + timedelta(minutes=duration)

        if ends_at <= starts_at:
            return Response({"detail": "Интервал слишком короткий."}, status=status.HTTP_400_BAD_REQUEST)

        sid = None
        if staff_id not in (None, "", "null", "any"):
            try:
                sid = int(staff_id)
            except (TypeError, ValueError):
                sid = None

        try:
            booking = book_time_window(
                provider_id,
                int(service_id),
                starts_at,
                ends_at,
                sid,
                client,
                comment,
                selected_options=snapshots,
                notify=True,
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        booking = (
            Booking.objects.select_related("client", "provider", "service", "slot", "staff")
            .filter(pk=booking.pk)
            .first()
            or booking
        )
        ser = BookingSerializer(booking, context={"request": request})
        data_out = dict(ser.data)
        data_out["client_brief"] = client_brief(client)
        data_out["confirm_url"] = build_client_confirm_url(booking)
        return Response(data_out, status=status.HTTP_201_CREATED)


class PublicVisitConfirmView(APIView):
    """GET/POST /api/booking/public/visit-confirm/<token>/ — клиент подтверждает визит по ссылке."""

    permission_classes = [permissions.AllowAny]

    def _booking(self, token: str):
        token = (token or "").strip()
        if not token:
            return None
        return (
            Booking.objects.select_related("client", "provider", "service", "slot")
            .filter(client_confirm_token=token)
            .exclude(status=Booking.Status.CANCELLED)
            .first()
        )

    def get(self, request, token: str):
        booking = self._booking(token)
        if not booking:
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_404_NOT_FOUND)
        org = (getattr(booking.provider, "organization_name", None) or "").strip() or "Организация"
        return Response(
            {
                "booking_id": booking.id,
                "status": booking.status,
                "already_confirmed": bool(booking.client_confirmed_at)
                or booking.status == Booking.Status.CONFIRMED,
                "org": org,
                "service": getattr(booking.service, "name", "") or "",
                "when": format_booking_when(booking),
                "client_name": client_display_name(booking.client),
            }
        )

    def post(self, request, token: str):
        booking = self._booking(token)
        if not booking:
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_404_NOT_FOUND)
        if booking.status in (Booking.Status.DONE, Booking.Status.NO_SHOW, Booking.Status.CANCELLED):
            return Response({"detail": "Запись уже завершена."}, status=status.HTTP_400_BAD_REQUEST)
        if booking.payment_status == "pending":
            return Response(
                {"detail": "Сначала нужно внести предоплату."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        update_fields = []
        if not booking.client_confirmed_at:
            booking.client_confirmed_at = now
            update_fields.append("client_confirmed_at")
        if booking.status == Booking.Status.NEW:
            booking.status = Booking.Status.CONFIRMED
            update_fields.append("status")
        if update_fields:
            booking.save(update_fields=update_fields)

        try:
            from notifications.delivery import deliver_booking_event

            when = format_booking_when(booking)
            name = client_display_name(booking.client)
            body = f"{name} подтвердил(а) визит · {when}" if name else f"Клиент подтвердил визит · {when}"
            deliver_booking_event(
                booking,
                "client_confirm",
                body,
                audience="org",
                title_org="Клиент подтвердил визит",
            )
        except Exception:
            pass

        return Response(
            {
                "ok": True,
                "status": booking.status,
                "already_confirmed": True,
                "org": (getattr(booking.provider, "organization_name", None) or "").strip() or "Организация",
                "service": getattr(booking.service, "name", "") or "",
                "when": format_booking_when(booking),
            }
        )

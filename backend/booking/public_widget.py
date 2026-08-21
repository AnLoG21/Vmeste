"""Public booking widget API (AllowAny) for embed on salon websites."""

from __future__ import annotations

import re
import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from catalog.models import Service
from users.slug_utils import ensure_organization_slug

from .booking_windows import book_time_window, list_available_dates, list_available_windows, resolve_selected_options
from .models import ProviderStaff

User = get_user_model()


def _provider_by_slug(slug: str):
    slug = (slug or "").strip()
    if not slug:
        return None
    return (
        User.objects.filter(role=User.Role.PROVIDER, is_active=True, organization_slug__iexact=slug)
        .exclude(provider_sphere=User.ProviderSphere.CAFE_RESTAURANT)
        .first()
    )


def _normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("7"):
        return "+" + digits
    return (raw or "").strip()[:30]


def _get_or_create_guest_client(*, phone: str, name: str = ""):
    phone_n = _normalize_phone(phone)
    if len(re.sub(r"\D+", "", phone_n)) < 10:
        raise ValueError("Укажите корректный телефон.")
    existing = User.objects.filter(phone=phone_n, role=User.Role.CLIENT).first()
    if existing:
        if name and not (existing.first_name or "").strip():
            parts = name.strip().split(None, 1)
            existing.first_name = parts[0][:30]
            if len(parts) > 1:
                existing.last_name = parts[1][:30]
            existing.save(update_fields=["first_name", "last_name"])
        return existing
    base = f"guest_{re.sub(r'\D+', '', phone_n)[-10:]}"
    username = base
    for _ in range(8):
        if not User.objects.filter(username=username).exists():
            break
        username = f"{base}_{secrets.token_hex(2)}"
    parts = (name or "").strip().split(None, 1)
    user = User(
        username=username,
        role=User.Role.CLIENT,
        phone=phone_n,
        first_name=(parts[0] if parts else "")[:30],
        last_name=(parts[1] if len(parts) > 1 else "")[:30],
    )
    user.set_unusable_password()
    user.save()
    return user


class PublicWidgetCatalogView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug: str):
        provider = _provider_by_slug(slug)
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        ensure_organization_slug(provider)
        services = list(
            Service.objects.filter(provider=provider, is_active=True)
            .prefetch_related("options")
            .order_by("name")
        )
        staff_links = list(
            ProviderStaff.objects.filter(
                provider=provider,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            )
            .select_related("staff")
            .prefetch_related("assigned_services", "assigned_categories", "portfolio_photos")
        )
        from .serializers import ProviderStaffSerializer
        from catalog.serializers import ServiceSerializer

        return Response(
            {
                "provider_id": provider.id,
                "organization_name": provider.organization_name or provider.username,
                "slug": provider.organization_slug,
                "sphere": provider.provider_sphere or "",
                "phones": list(provider.organization_phones or [])[:5] if isinstance(provider.organization_phones, list) else [],
                "address": provider.organization_address or "",
                "widget_url": f"/w/{provider.organization_slug}",
                "services": ServiceSerializer(services, many=True, context={"request": request}).data,
                "staff": ProviderStaffSerializer(staff_links, many=True, context={"request": request}).data,
            }
        )


class PublicWidgetWindowsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug: str):
        provider = _provider_by_slug(slug)
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        service = (request.query_params.get("service") or "").strip()
        book_date_raw = (request.query_params.get("date") or "").strip()
        staff_raw = (request.query_params.get("staff") or "").strip()
        extra_raw = (request.query_params.get("extra_minutes") or "0").strip()
        try:
            extra_minutes = max(0, int(extra_raw or 0))
        except ValueError:
            extra_minutes = 0
        staff_id = None
        if staff_raw and staff_raw not in ("any", "null", "none"):
            try:
                staff_id = int(staff_raw)
            except ValueError:
                staff_id = None
        if not service or not book_date_raw:
            return Response({"detail": "Укажите service и date."}, status=status.HTTP_400_BAD_REQUEST)
        book_date = parse_date(book_date_raw)
        if not book_date:
            return Response({"detail": "Некорректная дата."}, status=status.HTTP_400_BAD_REQUEST)
        data = list_available_windows(
            provider.id, int(service), book_date, extra_minutes=extra_minutes, staff_id=staff_id
        )
        return Response(data)


class PublicWidgetDatesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug: str):
        provider = _provider_by_slug(slug)
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        service = (request.query_params.get("service") or "").strip()
        staff_raw = (request.query_params.get("staff") or "").strip()
        extra_raw = (request.query_params.get("extra_minutes") or "0").strip()
        try:
            extra_minutes = max(0, int(extra_raw or 0))
        except ValueError:
            extra_minutes = 0
        staff_id = None
        if staff_raw and staff_raw not in ("any", "null", "none"):
            try:
                staff_id = int(staff_raw)
            except ValueError:
                staff_id = None
        if not service:
            return Response({"detail": "Укажите service."}, status=status.HTTP_400_BAD_REQUEST)
        today = timezone.localdate()
        date_from = parse_date((request.query_params.get("from") or "").strip()) or today
        date_to = parse_date((request.query_params.get("to") or "").strip()) or (today + timedelta(days=60))
        dates = list_available_dates(
            provider.id,
            int(service),
            date_from,
            date_to,
            extra_minutes=extra_minutes,
            staff_id=staff_id,
        )
        return Response({"dates": dates})


class PublicWidgetBookView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, slug: str):
        provider = _provider_by_slug(slug)
        if not provider:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        data = request.data or {}
        guest_phone = (data.get("guest_phone") or data.get("phone") or "").strip()
        guest_name = (data.get("guest_name") or data.get("name") or "").strip()
        comment = (data.get("comment") or "")[:250]
        try:
            client = _get_or_create_guest_client(phone=guest_phone, name=guest_name)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        service_id = data.get("service")
        starts_raw = data.get("starts_at")
        ends_raw = data.get("ends_at")
        staff_id = data.get("staff")
        option_ids = data.get("option_ids") or data.get("options") or []
        if not service_id or not starts_raw or not ends_raw:
            return Response(
                {"detail": "Укажите service, starts_at и ends_at."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        starts_at = parse_datetime(str(starts_raw))
        ends_at = parse_datetime(str(ends_raw))
        if not starts_at or not ends_at or ends_at <= starts_at:
            return Response({"detail": "Некорректное время."}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.is_naive(starts_at):
            starts_at = timezone.make_aware(starts_at, timezone.get_current_timezone())
        if timezone.is_naive(ends_at):
            ends_at = timezone.make_aware(ends_at, timezone.get_current_timezone())
        try:
            service = Service.objects.get(pk=int(service_id), provider_id=provider.id, is_active=True)
            snapshots = resolve_selected_options(service, option_ids)
            booking = book_time_window(
                provider.id,
                int(service_id),
                starts_at,
                ends_at,
                int(staff_id) if staff_id not in (None, "", "null") else None,
                client,
                comment,
                selected_options=snapshots,
                notify=True,
            )
        except Service.DoesNotExist:
            return Response({"detail": "Услуга не найдена."}, status=status.HTTP_400_BAD_REQUEST)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "id": booking.id,
                "status": booking.status,
                "starts_at": starts_at.isoformat(),
                "ends_at": ends_at.isoformat(),
                "service": service.name,
                "organization_name": provider.organization_name or provider.username,
                "guest_phone": client.phone,
                "message": "Запись создана. Мы свяжемся с вами при необходимости.",
            },
            status=status.HTTP_201_CREATED,
        )

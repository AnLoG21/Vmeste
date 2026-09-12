"""CRM-карточка клиента: техкарта и личные предпочтения («Помнить всё»)."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.analytics import _provider_for_user
from booking.booking_actions import client_display_name
from booking.client_memory_fields import (
    ALL_PERSONAL_KEYS,
    ALL_TECH_KEYS,
    client_base_enabled_for_sphere,
    merge_memory_field_prefs,
    memory_fields_for_sphere,
)
from booking.loyalty import get_or_create_loyalty_settings
from booking.loyalty_views import _resolve_client
from booking.models import Booking, ProviderClientCard
from common.media_urls import photo_urls
from users.models import User


class ProviderClientCardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_card(self, request):
        if request.user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return None, None, None, Response({"detail": "Нет доступа"}, status=403)
        provider = _provider_for_user(request.user)
        if not provider:
            return None, None, None, Response({"detail": "Организация не найдена"}, status=403)
        sphere = getattr(provider, "provider_sphere", "") or ""
        if not client_base_enabled_for_sphere(sphere):
            return None, None, None, Response(
                {"detail": "База клиентов для этой сферы не используется."},
                status=403,
            )
        settings_obj = get_or_create_loyalty_settings(provider)
        raw = request.query_params.get("client") or request.data.get("client")
        client = _resolve_client(str(raw or ""))
        if not client:
            return provider, None, settings_obj, Response({"detail": "Клиент не найден"}, status=404)
        card, _ = ProviderClientCard.objects.get_or_create(provider=provider, client=client)
        return provider, card, settings_obj, None

    def _serialize(self, card, provider, settings_obj, request=None):
        sphere = getattr(provider, "provider_sphere", "") or ""
        recent_bookings = (
            Booking.objects.filter(provider=provider, client_id=card.client_id)
            .exclude(status=Booking.Status.CANCELLED)
            .select_related("service")
            .order_by("-created_at")[:12]
        )
        timeline = []
        status_labels = dict(Booking.Status.choices)
        for b in recent_bookings:
            timeline.append(
                {
                    "id": f"b-{b.id}",
                    "kind": "booking",
                    "service_name": b.service.name if b.service_id else "Запись",
                    "status": b.status,
                    "status_label": status_labels.get(b.status, b.status),
                    "created_at": b.created_at,
                    "comment": b.comment or "",
                    "total": float(getattr(b.service, "price", 0) or 0) if b.service_id else 0,
                }
            )
        if sphere == "cafe_restaurant":
            try:
                from cafe.models import CafeOrder

                cafe_labels = dict(CafeOrder.Status.choices)
                for o in CafeOrder.objects.filter(provider=provider, client_id=card.client_id).order_by(
                    "-created_at"
                )[:8]:
                    timeline.append(
                        {
                            "id": f"c-{o.id}",
                            "kind": "cafe",
                            "service_name": f"Заказ кафе #{o.id}",
                            "status": o.status,
                            "status_label": cafe_labels.get(o.status, o.status),
                            "created_at": o.created_at,
                            "comment": "",
                            "total": float(o.total or 0),
                        }
                    )
            except Exception:
                pass
        if sphere == "shops":
            try:
                from shop.models import ShopOrder

                shop_labels = dict(ShopOrder.Status.choices)
                for o in ShopOrder.objects.filter(provider=provider, client_id=card.client_id).order_by(
                    "-created_at"
                )[:8]:
                    timeline.append(
                        {
                            "id": f"s-{o.id}",
                            "kind": "shop",
                            "service_name": f"Заказ магазина #{o.id}",
                            "status": o.status,
                            "status_label": shop_labels.get(o.status, o.status),
                            "created_at": o.created_at,
                            "comment": o.comment or "",
                            "total": float(o.total or 0),
                        }
                    )
            except Exception:
                pass
        if sphere == "service_center":
            try:
                from inspections.models import InspectionReport

                for rep in (
                    InspectionReport.objects.filter(provider=provider, client_id=card.client_id)
                    .order_by("-created_at")[:8]
                ):
                    vehicle = " · ".join(
                        x
                        for x in (
                            (getattr(rep, "vehicle_title", None) or "").strip(),
                            (getattr(rep, "vehicle_plate", None) or "").strip(),
                        )
                        if x
                    )
                    timeline.append(
                        {
                            "id": f"i-{rep.id}",
                            "kind": "inspection",
                            "service_name": vehicle or f"Приёмка #{rep.id}",
                            "status": getattr(rep, "status", "") or "",
                            "status_label": getattr(rep, "status", "") or "Приёмка",
                            "created_at": rep.created_at,
                            "comment": (getattr(rep, "vehicle_vin", None) or "")[:80],
                            "total": 0,
                        }
                    )
            except Exception:
                pass
        timeline.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        timeline = timeline[:12]

        tech = card.tech if isinstance(card.tech, dict) else {}
        personal = card.personal if isinstance(card.personal, dict) else {}
        av = photo_urls(request, getattr(card.client, "avatar_image", None))
        field_prefs = merge_memory_field_prefs(getattr(settings_obj, "client_memory_fields", None), sphere)
        return {
            "id": card.id,
            "provider": provider.id,
            "client": card.client_id,
            "client_name": client_display_name(card.client),
            "client_phone": getattr(card.client, "phone", "") or "",
            "client_avatar_url": av.get("thumb_url") or av.get("url") or "",
            "provider_sphere": sphere,
            "is_blocked": bool(card.is_blocked),
            "no_show_count": int(card.no_show_count or 0),
            "acquisition_source": card.acquisition_source or "",
            "hidden": bool(card.hidden),
            "tech": {key: str(tech.get(key) or "") for key in ALL_TECH_KEYS},
            "personal": {key: str(personal.get(key) or "") for key in ALL_PERSONAL_KEYS},
            "technical_notes": card.technical_notes or "",
            "preferences_notes": card.preferences_notes or "",
            "field_prefs": field_prefs,
            "field_catalog": memory_fields_for_sphere(sphere),
            "updated_at": card.updated_at,
            "recent_visits": timeline,
        }

    def get(self, request):
        provider, card, settings_obj, err = self._get_card(request)
        if err:
            return err
        return Response(self._serialize(card, provider, settings_obj, request=request))

    def patch(self, request):
        provider, card, settings_obj, err = self._get_card(request)
        if err:
            return err
        data = request.data if isinstance(request.data, dict) else {}
        sphere = getattr(provider, "provider_sphere", "") or ""

        if "field_prefs" in data and isinstance(data.get("field_prefs"), dict):
            settings_obj.client_memory_fields = merge_memory_field_prefs(data["field_prefs"], sphere)
            settings_obj.save(update_fields=["client_memory_fields", "updated_at"])

        if "technical_notes" in data:
            card.technical_notes = str(data.get("technical_notes") or "")[:8000]
        if "preferences_notes" in data:
            card.preferences_notes = str(data.get("preferences_notes") or "")[:8000]
        if "is_blocked" in data:
            card.is_blocked = bool(data.get("is_blocked"))
        if "no_show_count" in data:
            try:
                card.no_show_count = max(0, min(999, int(data.get("no_show_count"))))
            except (TypeError, ValueError):
                pass
        if "acquisition_source" in data:
            card.acquisition_source = str(data.get("acquisition_source") or "")[:120]
        if "hidden" in data:
            card.hidden = bool(data.get("hidden"))
        if "tech" in data and isinstance(data.get("tech"), dict):
            cur = dict(card.tech) if isinstance(card.tech, dict) else {}
            for key in ALL_TECH_KEYS:
                if key in data["tech"]:
                    cur[key] = str(data["tech"].get(key) or "")[:500]
            card.tech = cur
        if "personal" in data and isinstance(data.get("personal"), dict):
            cur = dict(card.personal) if isinstance(card.personal, dict) else {}
            for key in ALL_PERSONAL_KEYS:
                if key in data["personal"]:
                    cur[key] = str(data["personal"].get(key) or "")[:500]
            card.personal = cur
        card.save()
        return Response(self._serialize(card, provider, settings_obj, request=request))

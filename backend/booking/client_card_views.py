"""CRM-карточка клиента: техкарта и личные предпочтения («Помнить всё»)."""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.analytics import _provider_for_user
from booking.booking_actions import client_display_name
from booking.loyalty import get_or_create_loyalty_settings
from booking.loyalty_views import _resolve_client
from booking.models import Booking, ProviderClientCard
from common.media_urls import photo_urls
from users.models import User

DEFAULT_MEMORY_FIELDS = {
    "hair_color": True,
    "lash_length": True,
    "lash_curl": True,
    "nail_shape": True,
    "wax_brand": True,
    "materials": True,
    "technical_notes": True,
    "music": True,
    "drink": True,
    "allergies": True,
    "talk_topics": True,
    "preferences_notes": True,
}


def _merged_field_prefs(raw) -> dict:
    out = dict(DEFAULT_MEMORY_FIELDS)
    if isinstance(raw, dict):
        for key in DEFAULT_MEMORY_FIELDS:
            if key in raw:
                out[key] = bool(raw[key])
    return out


class ProviderClientCardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get_card(self, request):
        if request.user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return None, None, None, Response({"detail": "Нет доступа"}, status=403)
        provider = _provider_for_user(request.user)
        if not provider:
            return None, None, None, Response({"detail": "Организация не найдена"}, status=403)
        settings_obj = get_or_create_loyalty_settings(provider)
        raw = request.query_params.get("client") or request.data.get("client")
        client = _resolve_client(str(raw or ""))
        if not client:
            return provider, None, settings_obj, Response({"detail": "Клиент не найден"}, status=404)
        card, _ = ProviderClientCard.objects.get_or_create(provider=provider, client=client)
        return provider, card, settings_obj, None

    def _serialize(self, card, provider, settings_obj, request=None):
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
        timeline.sort(key=lambda x: x.get("created_at") or "", reverse=True)
        timeline = timeline[:12]

        tech = card.tech if isinstance(card.tech, dict) else {}
        personal = card.personal if isinstance(card.personal, dict) else {}
        av = photo_urls(request, getattr(card.client, "avatar_image", None))
        return {
            "id": card.id,
            "provider": provider.id,
            "client": card.client_id,
            "client_name": client_display_name(card.client),
            "client_phone": getattr(card.client, "phone", "") or "",
            "client_avatar_url": av.get("thumb_url") or av.get("url") or "",
            "is_blocked": bool(card.is_blocked),
            "no_show_count": int(card.no_show_count or 0),
            "acquisition_source": card.acquisition_source or "",
            "hidden": bool(card.hidden),
            "tech": {
                "hair_color": tech.get("hair_color") or "",
                "lash_length": tech.get("lash_length") or "",
                "lash_curl": tech.get("lash_curl") or "",
                "nail_shape": tech.get("nail_shape") or "",
                "wax_brand": tech.get("wax_brand") or "",
                "materials": tech.get("materials") or "",
            },
            "personal": {
                "music": personal.get("music") or "",
                "drink": personal.get("drink") or "",
                "allergies": personal.get("allergies") or "",
                "talk_topics": personal.get("talk_topics") or "",
            },
            "technical_notes": card.technical_notes or "",
            "preferences_notes": card.preferences_notes or "",
            "field_prefs": _merged_field_prefs(getattr(settings_obj, "client_memory_fields", None)),
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

        if "field_prefs" in data and isinstance(data.get("field_prefs"), dict):
            settings_obj.client_memory_fields = _merged_field_prefs(data["field_prefs"])
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
            for key in ("hair_color", "lash_length", "lash_curl", "nail_shape", "wax_brand", "materials"):
                if key in data["tech"]:
                    cur[key] = str(data["tech"].get(key) or "")[:500]
            card.tech = cur
        if "personal" in data and isinstance(data.get("personal"), dict):
            cur = dict(card.personal) if isinstance(card.personal, dict) else {}
            for key in ("music", "drink", "allergies", "talk_topics"):
                if key in data["personal"]:
                    cur[key] = str(data["personal"].get(key) or "")[:500]
            card.personal = cur
        card.save()
        return Response(self._serialize(card, provider, settings_obj, request=request))

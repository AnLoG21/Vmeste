from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .geo import bbox_around, commute_radius_m, haversine_m
from .models import Favorite, Listing, ListingPhoto, SavedSearch

User = get_user_model()
from .serializers import (
    FavoriteSerializer,
    ListingDetailSerializer,
    ListingListSerializer,
    MapPinSerializer,
    SavedSearchSerializer,
)


def _favorite_ids(user) -> set[int]:
    if not user or not user.is_authenticated:
        return set()
    return set(Favorite.objects.filter(user=user).values_list("listing_id", flat=True))


def _parse_int(value, default=None):
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _parse_float(value, default=None):
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _filtered_listings(request):
    qs = (
        Listing.objects.filter(is_active=True)
        .prefetch_related(
            Prefetch("photos", queryset=ListingPhoto.objects.order_by("sort_order", "id"))
        )
        .order_by("-updated_at", "-id")
    )

    deal_type = (request.query_params.get("deal_type") or "").strip().lower()
    if deal_type in (Listing.DealType.RENT, Listing.DealType.SALE):
        qs = qs.filter(deal_type=deal_type)

    rooms = request.query_params.get("rooms")
    if rooms is not None and rooms != "":
        # comma-separated: 0,1,2 or "5" meaning 5+
        parts = [p.strip() for p in str(rooms).split(",") if p.strip() != ""]
        room_q = Q()
        for p in parts:
            n = _parse_int(p)
            if n is None:
                continue
            if n >= 5:
                room_q |= Q(rooms__gte=5)
            else:
                room_q |= Q(rooms=n)
        if room_q:
            qs = qs.filter(room_q)

    price_min = _parse_int(request.query_params.get("price_min"))
    price_max = _parse_int(request.query_params.get("price_max"))
    if price_min is not None:
        qs = qs.filter(price__gte=price_min)
    if price_max is not None:
        qs = qs.filter(price__lte=price_max)

    area_min = _parse_float(request.query_params.get("area_min"))
    area_max = _parse_float(request.query_params.get("area_max"))
    if area_min is not None:
        qs = qs.filter(area_m2__gte=area_min)
    if area_max is not None:
        qs = qs.filter(area_m2__lte=area_max)

    floor_min = _parse_int(request.query_params.get("floor_min"))
    floor_max = _parse_int(request.query_params.get("floor_max"))
    if floor_min is not None:
        qs = qs.filter(floor__gte=floor_min)
    if floor_max is not None:
        qs = qs.filter(floor__lte=floor_max)

    no_agents = (request.query_params.get("no_agents") or "").strip().lower()
    if no_agents in ("1", "true", "yes"):
        qs = qs.filter(is_agent=False)

    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(address__icontains=q) | Q(metro_name__icontains=q) | Q(description__icontains=q))

    # Bounding box
    lat_min = _parse_float(request.query_params.get("lat_min"))
    lat_max = _parse_float(request.query_params.get("lat_max"))
    lon_min = _parse_float(request.query_params.get("lon_min"))
    lon_max = _parse_float(request.query_params.get("lon_max"))
    if None not in (lat_min, lat_max, lon_min, lon_max):
        qs = qs.filter(lat__gte=lat_min, lat__lte=lat_max, lon__gte=lon_min, lon__lte=lon_max)

    # Anchor + commute minutes (haversine only — no paid Yandex Router)
    anchor_lat = _parse_float(request.query_params.get("anchor_lat"))
    anchor_lon = _parse_float(request.query_params.get("anchor_lon"))
    max_commute_min = _parse_float(request.query_params.get("max_commute_min"))
    commute_mode = (request.query_params.get("commute_mode") or "walk").strip().lower()
    if commute_mode not in ("walk", "transit", "driving"):
        commute_mode = "walk"

    radius_m = _parse_float(request.query_params.get("radius_m"))
    if radius_m is None and anchor_lat is not None and anchor_lon is not None and max_commute_min:
        radius_m = commute_radius_m(max_commute_min, "transit" if commute_mode == "transit" else "walk")

    commute_method = None
    if anchor_lat is not None and anchor_lon is not None and radius_m and max_commute_min:
        b_lat_min, b_lat_max, b_lon_min, b_lon_max = bbox_around(anchor_lat, anchor_lon, radius_m)
        qs = qs.filter(
            lat__isnull=False,
            lon__isnull=False,
            lat__gte=b_lat_min,
            lat__lte=b_lat_max,
            lon__gte=b_lon_min,
            lon__lte=b_lon_max,
        )
        candidates = []
        for row in qs.only("id", "lat", "lon")[:400]:
            if row.lat is None or row.lon is None:
                continue
            if haversine_m(anchor_lat, anchor_lon, row.lat, row.lon) <= radius_m:
                candidates.append((row.id, row.lat, row.lon))
        from .routing import filter_ids_by_commute

        keep_ids, commute_method = filter_ids_by_commute(
            anchor_lat=anchor_lat,
            anchor_lon=anchor_lon,
            candidates=candidates,
            max_commute_min=max_commute_min,
            commute_mode=commute_mode,
        )
        qs = qs.filter(id__in=keep_ids)

    return qs, {
        "anchor_lat": anchor_lat,
        "anchor_lon": anchor_lon,
        "radius_m": radius_m,
        "commute_mode": commute_mode,
        "max_commute_min": max_commute_min,
        "commute_method": commute_method,
    }


class VkvartireFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs, meta = _filtered_listings(request)
        page = max(1, _parse_int(request.query_params.get("page"), 1) or 1)
        page_size = min(50, max(1, _parse_int(request.query_params.get("page_size"), 20) or 20))
        total = qs.count()
        start = (page - 1) * page_size
        rows = list(qs[start : start + page_size])
        fav = _favorite_ids(request.user)
        data = ListingListSerializer(rows, many=True, context={"favorite_ids": fav}).data
        return Response(
            {
                "results": data,
                "page": page,
                "page_size": page_size,
                "total": total,
                "has_more": start + page_size < total,
                "meta": {
                    "commute_note": (
                        (
                            "Удалённость — по прямой: пешком ~80 м/мин, транспорт ~220 м/мин "
                            "(без платного Яндекс Router)."
                        )
                        if meta.get("radius_m")
                        else None
                    ),
                    **{k: v for k, v in meta.items() if v is not None},
                },
            }
        )


class VkvartireMapView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs, meta = _filtered_listings(request)
        qs = qs.filter(lat__isnull=False, lon__isnull=False)[:500]
        data = MapPinSerializer(qs, many=True).data
        return Response({"pins": data, "meta": meta})


class VkvartireListingDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, listing_id: int):
        try:
            listing = Listing.objects.prefetch_related("photos").get(pk=listing_id, is_active=True)
        except Listing.DoesNotExist:
            return Response({"detail": "Объявление не найдено."}, status=status.HTTP_404_NOT_FOUND)
        fav = _favorite_ids(request.user)
        return Response(ListingDetailSerializer(listing, context={"favorite_ids": fav}).data)


class VkvartireFavoritesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = (
            Favorite.objects.filter(user=request.user)
            .select_related("listing")
            .prefetch_related("listing__photos")
            .order_by("-created_at")
        )
        fav = {f.listing_id for f in rows}
        # Serialize listings with is_favorite=True
        listings = [f.listing for f in rows if f.listing.is_active]
        data = ListingListSerializer(listings, many=True, context={"favorite_ids": fav}).data
        return Response({"results": data})

    def post(self, request):
        listing_id = _parse_int(request.data.get("listing_id"))
        if not listing_id:
            return Response({"detail": "listing_id обязателен."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            listing = Listing.objects.get(pk=listing_id, is_active=True)
        except Listing.DoesNotExist:
            return Response({"detail": "Объявление не найдено."}, status=status.HTTP_404_NOT_FOUND)
        fav, _created = Favorite.objects.get_or_create(user=request.user, listing=listing)
        return Response(
            {"ok": True, "id": fav.id, "listing_id": listing.id},
            status=status.HTTP_201_CREATED if _created else status.HTTP_200_OK,
        )

    def delete(self, request):
        listing_id = _parse_int(request.query_params.get("listing_id") or request.data.get("listing_id"))
        if not listing_id:
            return Response({"detail": "listing_id обязателен."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = Favorite.objects.filter(user=request.user, listing_id=listing_id).delete()
        return Response({"ok": True, "deleted": deleted > 0})


def _sanitize_filters(raw) -> dict:
    if not isinstance(raw, dict):
        return {}
    allowed = {
        "deal_type",
        "rooms",
        "price_min",
        "price_max",
        "area_min",
        "area_max",
        "floor_min",
        "floor_max",
        "no_agents",
        "q",
        "anchor_lat",
        "anchor_lon",
        "anchor_label",
        "max_commute_min",
        "commute_mode",
    }
    out = {}
    for key in allowed:
        if key in raw:
            out[key] = raw[key]
    return out


class VkvartireSavedSearchListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = SavedSearch.objects.filter(user=request.user)[:50]
        return Response({"results": SavedSearchSerializer(rows, many=True).data})

    def post(self, request):
        name = (request.data.get("name") or "").strip()[:120]
        if not name:
            return Response({"detail": "name обязателен."}, status=status.HTTP_400_BAD_REQUEST)
        filters = _sanitize_filters(request.data.get("filters") or {})
        notify = bool(request.data.get("notify", False))
        row = SavedSearch.objects.create(
            user=request.user, name=name, filters=filters, notify=notify
        )
        return Response(SavedSearchSerializer(row).data, status=status.HTTP_201_CREATED)


class VkvartireSavedSearchDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _get(self, request, search_id: int):
        try:
            return SavedSearch.objects.get(pk=search_id, user=request.user)
        except SavedSearch.DoesNotExist:
            return None

    def patch(self, request, search_id: int):
        row = self._get(request, search_id)
        if not row:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        if "name" in request.data:
            name = (request.data.get("name") or "").strip()[:120]
            if name:
                row.name = name
        if "filters" in request.data:
            row.filters = _sanitize_filters(request.data.get("filters") or {})
        if "notify" in request.data:
            row.notify = bool(request.data.get("notify"))
        row.save()
        return Response(SavedSearchSerializer(row).data)

    def delete(self, request, search_id: int):
        row = self._get(request, search_id)
        if not row:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        row.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class VkvartireListingChatView(APIView):
    """Открыть чат с риелтором объявления (user-direct) + intro-сообщение."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, listing_id: int):
        try:
            listing = Listing.objects.select_related("realtor").get(pk=listing_id, is_active=True)
        except Listing.DoesNotExist:
            return Response({"detail": "Объявление не найдено."}, status=status.HTTP_404_NOT_FOUND)

        contact = {
            "realtor_name": listing.realtor_name or "",
            "realtor_phone": listing.realtor_phone or "",
            "realtor_email": listing.realtor_email or "",
            "external_url": listing.external_url or "",
        }

        realtor = listing.realtor
        if not realtor or not realtor.is_active:
            return Response(
                {
                    "can_chat": False,
                    "detail": "Чат недоступен — нет аккаунта риелтора во Вместе. Используйте телефон или источник.",
                    "contact": contact,
                },
                status=status.HTTP_200_OK,
            )
        if realtor.id == request.user.id:
            return Response({"detail": "Это ваше объявление."}, status=status.HTTP_400_BAD_REQUEST)

        from chat.models import Conversation, ConversationMember, Message
        from chat.serializers import ConversationSerializer

        candidates = (
            Conversation.objects.filter(
                is_group=False,
                is_saved_messages=False,
                is_client_correspondence=False,
                is_user_direct=True,
                organization__isnull=True,
            )
            .prefetch_related("members")
        )
        conv = None
        created = False
        for c in candidates:
            user_ids = {m.user_id for m in c.members.all()}
            if user_ids == {request.user.id, realtor.id}:
                conv = c
                break
        if conv is None:
            with transaction.atomic():
                conv = Conversation.objects.create(
                    title="",
                    is_group=False,
                    is_saved_messages=False,
                    is_client_correspondence=False,
                    is_user_direct=True,
                    organization=None,
                )
                ConversationMember.objects.create(conversation=conv, user=request.user)
                ConversationMember.objects.create(conversation=conv, user=realtor)
                created = True

        rooms = "студия" if listing.rooms == 0 else f"{listing.rooms}-комн."
        price = f"{listing.price:,}".replace(",", " ")
        intro = (
            f"Здравствуйте! Интересует объявление во Вместе (Вквартире) "
            f"№{listing.id}: {rooms}, {price} ₽ — {listing.address or listing.metro_name or 'без адреса'}."
        )
        if listing.external_url:
            intro += f"\n{listing.external_url}"
        # Avoid spam: only auto-intro on brand-new conversation
        if created:
            Message.objects.create(
                conversation=conv,
                sender=request.user,
                kind=Message.Kind.TEXT,
                text=intro,
                payload={"vkvartire_listing_id": listing.id},
            )

        conv = (
            Conversation.objects.filter(pk=conv.pk)
            .prefetch_related("members", "members__user")
            .first()
        )
        data = ConversationSerializer(conv, context={"request": request}).data
        return Response(
            {
                "can_chat": True,
                "created": created,
                "conversation": data,
                "conversation_id": conv.id,
                "contact": contact,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

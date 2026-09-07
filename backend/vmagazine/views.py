from __future__ import annotations

import math

from django.db.models import Avg, Count, Q
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from reviews.models import Review
from shop.access import SHOP_SPHERES
from shop.models import Product, ShopOrder
from users.models import User

from .models import ShopFavorite
from .serializers import VmagazineOrderSerializer, shop_card_from_provider


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def _parse_float(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def shop_providers_base_qs():
    from django.db.models import Exists, OuterRef

    has_storefront = Exists(Product.objects.filter(provider_id=OuterRef("pk")))
    return (
        User.objects.filter(
            role=User.Role.PROVIDER,
            is_active=True,
            is_demo=False,
            map_hidden=False,
        )
        .filter(
            Q(provider_sphere=User.ProviderSphere.SHOPS)
            | (
                Q(provider_sphere__in=[User.ProviderSphere.HAIR_SALON, User.ProviderSphere.SERVICE_CENTER])
                & ~Q(organization_slug="")
                & has_storefront
            )
        )
        .exclude(organization_slug="")
    )


class VmagazineShopsSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        lat = _parse_float(request.query_params.get("lat"))
        lon = _parse_float(request.query_params.get("lon"))

        qs = shop_providers_base_qs()
        if q:
            qs = qs.filter(
                Q(organization_name__icontains=q)
                | Q(organization_address__icontains=q)
                | Q(username__icontains=q)
            )

        fav_ids = set(
            ShopFavorite.objects.filter(user=request.user).values_list("provider_id", flat=True)
        )

        review_map = {
            row["provider_id"]: row
            for row in Review.objects.filter(provider_id__in=qs.values("id"))
            .values("provider_id")
            .annotate(avg=Avg("rating"), cnt=Count("id"))
        }

        cards = []
        for provider in qs[:200]:
            distance_m = None
            if (
                lat is not None
                and lon is not None
                and provider.organization_latitude is not None
                and provider.organization_longitude is not None
            ):
                distance_m = _haversine_m(
                    lat,
                    lon,
                    float(provider.organization_latitude),
                    float(provider.organization_longitude),
                )
            rev = review_map.get(provider.id) or {}
            cards.append(
                shop_card_from_provider(
                    provider,
                    is_favorite=provider.id in fav_ids,
                    distance_m=distance_m,
                    avg=rev.get("avg"),
                    reviews_count=rev.get("cnt") or 0,
                )
            )

        if lat is not None and lon is not None:
            cards.sort(
                key=lambda c: (
                    c["distance_m"] is None,
                    c["distance_m"] if c["distance_m"] is not None else 0,
                    c["organization_name"].lower(),
                )
            )
        else:
            cards.sort(key=lambda c: c["organization_name"].lower())

        return Response(cards[:100])


class VmagazineFavoritesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        favs = (
            ShopFavorite.objects.filter(user=request.user)
            .select_related("provider")
            .order_by("-created_at")
        )
        provider_ids = [f.provider_id for f in favs]
        review_map = {
            row["provider_id"]: row
            for row in Review.objects.filter(provider_id__in=provider_ids)
            .values("provider_id")
            .annotate(avg=Avg("rating"), cnt=Count("id"))
        }
        out = []
        for fav in favs:
            p = fav.provider
            if not p or not p.is_active:
                continue
            rev = review_map.get(p.id) or {}
            out.append(
                {
                    "id": fav.id,
                    "created_at": fav.created_at,
                    "provider": shop_card_from_provider(
                        p,
                        is_favorite=True,
                        avg=rev.get("avg"),
                        reviews_count=rev.get("cnt") or 0,
                    ),
                }
            )
        return Response(out)

    def post(self, request):
        provider_id = request.data.get("provider_id") or request.data.get("provider")
        try:
            provider_id = int(provider_id)
        except (TypeError, ValueError):
            return Response({"detail": "Укажите provider_id."}, status=status.HTTP_400_BAD_REQUEST)

        provider = shop_providers_base_qs().filter(pk=provider_id).first()
        if not provider:
            # Allow favoriting any shop-sphere provider even without products yet.
            provider = User.objects.filter(
                pk=provider_id,
                role=User.Role.PROVIDER,
                is_active=True,
                provider_sphere__in=SHOP_SPHERES,
            ).first()
        if not provider:
            return Response({"detail": "Магазин не найден."}, status=status.HTTP_404_NOT_FOUND)

        fav, created = ShopFavorite.objects.get_or_create(user=request.user, provider=provider)
        return Response(
            {
                "id": fav.id,
                "created": created,
                "provider": shop_card_from_provider(provider, is_favorite=True),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )

    def delete(self, request):
        provider_id = request.query_params.get("provider_id") or request.data.get("provider_id")
        try:
            provider_id = int(provider_id)
        except (TypeError, ValueError):
            return Response({"detail": "Укажите provider_id."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = ShopFavorite.objects.filter(user=request.user, provider_id=provider_id).delete()
        if not deleted:
            return Response({"detail": "Не в избранном."}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class VmagazineMyOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = (
            ShopOrder.objects.filter(client=request.user)
            .select_related("provider")
            .prefetch_related("items")
            .order_by("-created_at")[:100]
        )
        return Response(VmagazineOrderSerializer(qs, many=True, context={"request": request}).data)

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.db.models import Count, F, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from shop.access import can_manage_shop, resolve_shop_provider
from shop.models import Product, ProductCategory, ShopOrder

from .models import (
    CartItem,
    DeliveryAddress,
    PopularSearchQuery,
    ProductLike,
    ProductViewHistory,
    SavedPaymentCard,
    ShopBonusBalance,
)
from .product_cards import active_products_qs, product_card, record_product_view


def _liked_ids(user, product_ids):
    if not user or not user.is_authenticated or not product_ids:
        return set()
    return set(
        ProductLike.objects.filter(user=user, product_id__in=product_ids).values_list("product_id", flat=True)
    )


class HomeFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        originals_only = str(request.query_params.get("originals") or "").lower() in ("1", "true", "yes")
        qs = active_products_qs()
        if originals_only:
            qs = qs.filter(authenticity_status=Product.AuthenticityStatus.VERIFIED)
        recommended = list(qs.order_by("-view_count", "-id")[:40])
        liked = _liked_ids(request.user, [p.id for p in recommended])
        addresses = list(
            DeliveryAddress.objects.filter(user=request.user).values(
                "id", "label", "address", "lat", "lon", "is_default", "apartment", "entrance", "floor"
            )[:20]
        )
        return Response(
            {
                "addresses": addresses,
                "recommended": [
                    product_card(p, request, liked=p.id in liked) for p in recommended
                ],
            }
        )


class SearchSuggestView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        originals_only = str(request.query_params.get("originals") or "").lower() in ("1", "true", "yes")
        suggestions = []
        sections = []

        if q:
            obj, created = PopularSearchQuery.objects.get_or_create(query=q[:120], defaults={"hits": 1})
            if not created:
                PopularSearchQuery.objects.filter(pk=obj.pk).update(hits=F("hits") + 1)

            popular = list(
                PopularSearchQuery.objects.filter(query__icontains=q).order_by("-hits")[:8].values_list(
                    "query", flat=True
                )
            )
            cats = list(
                ProductCategory.objects.filter(name__icontains=q)
                .values("id", "name")
                .annotate(cnt=Count("products"))
                .order_by("-cnt")[:8]
            )
            for name in popular:
                suggestions.append({"type": "query", "text": name})
            for c in cats:
                suggestions.append({"type": "category", "text": c["name"], "category_id": c["id"]})
            # synthetic expansions
            for suffix in (" женские", " мужские", " набор", " детские"):
                text = f"{q}{suffix}".strip()
                if text.lower() not in {s["text"].lower() for s in suggestions}:
                    suggestions.append({"type": "query", "text": text})

            qs = active_products_qs().filter(
                Q(name__icontains=q)
                | Q(category__name__icontains=q)
                | Q(provider__organization_name__icontains=q)
            )
            if originals_only:
                qs = qs.filter(authenticity_status=Product.AuthenticityStatus.VERIFIED)

            # sections carousel: top categories matching query
            for c in cats[:5]:
                top = (
                    active_products_qs()
                    .filter(category_id=c["id"])
                    .order_by("-view_count")
                    .first()
                )
                cover = ""
                if top:
                    card = product_card(top, request)
                    cover = card.get("cover_url") or ""
                sections.append(
                    {
                        "type": "category",
                        "id": c["id"],
                        "title": c["name"],
                        "cover_url": cover,
                    }
                )

            # popular shops matching
            shops = (
                UserShopHints(q)[:3]
            )
            sections.extend(shops)

            products = list(qs.order_by("-view_count")[:30])
            liked = _liked_ids(request.user, [p.id for p in products])
            return Response(
                {
                    "suggestions": suggestions[:12],
                    "sections": sections[:5],
                    "products": [product_card(p, request, liked=p.id in liked) for p in products],
                }
            )

        # empty query: popular searches + top sections
        popular = list(PopularSearchQuery.objects.order_by("-hits")[:10].values_list("query", flat=True))
        for name in popular:
            suggestions.append({"type": "query", "text": name})
        cats = (
            ProductCategory.objects.values("id", "name")
            .annotate(cnt=Count("products", filter=Q(products__is_active=True)))
            .order_by("-cnt")[:5]
        )
        for c in cats:
            top = active_products_qs().filter(category_id=c["id"]).order_by("-view_count").first()
            cover = product_card(top, request).get("cover_url") if top else ""
            sections.append({"type": "category", "id": c["id"], "title": c["name"], "cover_url": cover})
        return Response({"suggestions": suggestions, "sections": sections, "products": []})


def UserShopHints(q: str) -> list[dict]:
    from users.models import User

    out = []
    for u in User.objects.filter(
        role=User.Role.PROVIDER,
        is_active=True,
        organization_name__icontains=q,
    ).exclude(organization_slug="")[:3]:
        out.append(
            {
                "type": "shop",
                "id": u.id,
                "title": u.organization_name or u.username,
                "cover_url": "",
                "shop_url": f"/s/{u.organization_slug}",
            }
        )
    return out


class ProductLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        likes = (
            ProductLike.objects.filter(user=request.user)
            .select_related("product", "product__provider", "product__category")
            .prefetch_related("product__photos")
            .order_by("-created_at")[:100]
        )
        return Response(
            [product_card(like.product, request, liked=True) for like in likes if like.product_id]
        )

    def post(self, request):
        try:
            pid = int(request.data.get("product_id") or request.data.get("product"))
        except (TypeError, ValueError):
            return Response({"detail": "Укажите product_id"}, status=400)
        product = active_products_qs().filter(pk=pid).first()
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        ProductLike.objects.get_or_create(user=request.user, product=product)
        return Response(product_card(product, request, liked=True), status=201)

    def delete(self, request):
        try:
            pid = int(request.query_params.get("product_id") or request.data.get("product_id"))
        except (TypeError, ValueError):
            return Response({"detail": "Укажите product_id"}, status=400)
        ProductLike.objects.filter(user=request.user, product_id=pid).delete()
        return Response(status=204)


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        items = (
            CartItem.objects.filter(user=request.user)
            .select_related("product", "product__provider", "product__category")
            .prefetch_related("product__photos")
        )
        bonus_map = {
            b.provider_id: b.balance
            for b in ShopBonusBalance.objects.filter(user=request.user)
        }
        out = []
        for row in items:
            card = product_card(row.product, request)
            provider_id = row.product.provider_id
            bal = bonus_map.get(provider_id) or Decimal("0")
            out.append(
                {
                    "id": row.id,
                    "quantity": row.quantity,
                    "use_bonuses": row.use_bonuses,
                    "product": card,
                    "bonus_balance": str(bal),
                }
            )
        return Response(out)

    def post(self, request):
        try:
            pid = int(request.data.get("product_id") or request.data.get("product"))
            qty = int(request.data.get("quantity") or 1)
        except (TypeError, ValueError):
            return Response({"detail": "product_id и quantity"}, status=400)
        if qty < 1:
            return Response({"detail": "quantity >= 1"}, status=400)
        product = active_products_qs().filter(pk=pid).first()
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        item, created = CartItem.objects.get_or_create(
            user=request.user, product=product, defaults={"quantity": qty}
        )
        if not created:
            item.quantity = qty
            item.save(update_fields=["quantity", "updated_at"])
        if "use_bonuses" in request.data:
            item.use_bonuses = bool(request.data.get("use_bonuses"))
            item.save(update_fields=["use_bonuses", "updated_at"])
        return Response({"id": item.id, "quantity": item.quantity, "use_bonuses": item.use_bonuses}, status=201 if created else 200)

    def delete(self, request):
        try:
            pid = int(request.query_params.get("product_id") or request.data.get("product_id"))
        except (TypeError, ValueError):
            return Response({"detail": "product_id"}, status=400)
        CartItem.objects.filter(user=request.user, product_id=pid).delete()
        return Response(status=204)


class ProductViewTrackView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        product = active_products_qs().filter(pk=product_id).first()
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        record_product_view(request.user, product)
        return Response(product_card(product, request))


class RecentlyViewedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        limit = 15
        if str(request.query_params.get("all") or "").lower() in ("1", "true", "yes"):
            limit = 80
        rows = (
            ProductViewHistory.objects.filter(user=request.user)
            .select_related("product", "product__provider", "product__category")
            .prefetch_related("product__photos")
            .order_by("-viewed_at")[:limit]
        )
        liked = _liked_ids(request.user, [r.product_id for r in rows])
        return Response(
            [product_card(r.product, request, liked=r.product_id in liked) for r in rows if r.product_id]
        )


class AddressesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = DeliveryAddress.objects.filter(user=request.user)
        return Response(
            [
                {
                    "id": a.id,
                    "label": a.label,
                    "address": a.address,
                    "entrance": a.entrance,
                    "floor": a.floor,
                    "apartment": a.apartment,
                    "lat": a.lat,
                    "lon": a.lon,
                    "is_default": a.is_default,
                }
                for a in rows
            ]
        )

    def post(self, request):
        address = str(request.data.get("address") or "").strip()
        if not address:
            return Response({"detail": "Укажите адрес"}, status=400)
        with transaction.atomic():
            if request.data.get("is_default"):
                DeliveryAddress.objects.filter(user=request.user).update(is_default=False)
            row = DeliveryAddress.objects.create(
                user=request.user,
                label=str(request.data.get("label") or "Дом")[:80],
                address=address[:400],
                entrance=str(request.data.get("entrance") or "")[:32],
                floor=str(request.data.get("floor") or "")[:32],
                apartment=str(request.data.get("apartment") or "")[:64],
                lat=request.data.get("lat"),
                lon=request.data.get("lon"),
                is_default=bool(request.data.get("is_default")),
            )
        return Response({"id": row.id}, status=201)

    def delete(self, request):
        try:
            aid = int(request.query_params.get("id") or request.data.get("id"))
        except (TypeError, ValueError):
            return Response({"detail": "id"}, status=400)
        DeliveryAddress.objects.filter(user=request.user, pk=aid).delete()
        return Response(status=204)


class BonusesView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = ShopBonusBalance.objects.filter(user=request.user).select_related("provider")
        return Response(
            [
                {
                    "provider_id": r.provider_id,
                    "provider_name": r.provider.organization_name or r.provider.username,
                    "shop_url": f"/s/{r.provider.organization_slug}" if r.provider.organization_slug else "",
                    "balance": str(r.balance),
                    "updated_at": r.updated_at,
                }
                for r in rows
                if r.balance > 0
            ]
        )


class PaymentCardsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = SavedPaymentCard.objects.filter(user=request.user)
        return Response(
            [
                {
                    "id": c.id,
                    "brand": c.brand,
                    "last4": c.last4,
                    "exp_month": c.exp_month,
                    "exp_year": c.exp_year,
                    "is_default": c.is_default,
                }
                for c in rows
            ]
        )

    def post(self, request):
        last4 = str(request.data.get("last4") or "").strip()
        if len(last4) != 4 or not last4.isdigit():
            return Response({"detail": "Укажите last4 карты"}, status=400)
        with transaction.atomic():
            if request.data.get("is_default"):
                SavedPaymentCard.objects.filter(user=request.user).update(is_default=False)
            card = SavedPaymentCard.objects.create(
                user=request.user,
                brand=str(request.data.get("brand") or "card")[:32],
                last4=last4,
                exp_month=int(request.data.get("exp_month") or 1),
                exp_year=int(request.data.get("exp_year") or 2030),
                is_default=bool(request.data.get("is_default")),
            )
        return Response({"id": card.id}, status=201)

    def delete(self, request):
        try:
            cid = int(request.query_params.get("id") or request.data.get("id"))
        except (TypeError, ValueError):
            return Response({"detail": "id"}, status=400)
        SavedPaymentCard.objects.filter(user=request.user, pk=cid).delete()
        return Response(status=204)


class ProfileHubView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        orders = (
            ShopOrder.objects.filter(client=request.user)
            .exclude(status=ShopOrder.Status.CANCELLED)
            .select_related("provider")
            .prefetch_related("items")
            .order_by("-created_at")[:30]
        )
        active = [
            o
            for o in orders
            if o.status
            not in (ShopOrder.Status.DONE, ShopOrder.Status.CANCELLED, ShopOrder.Status.AWAITING_PAYMENT)
        ]
        purchases = [o for o in orders if o.status == ShopOrder.Status.DONE]
        # товары для отзыва после покупки
        reviewable = []
        for o in purchases[:20]:
            for item in o.items.all():
                if item.product_id:
                    reviewable.append(
                        {
                            "order_id": o.id,
                            "product_id": item.product_id,
                            "name": item.name,
                            "provider_name": o.provider.organization_name or o.provider.username,
                            "shop_url": f"/s/{o.provider.organization_slug}" if o.provider.organization_slug else "",
                            "purchased_at": o.paid_at or o.created_at,
                        }
                    )
        from .serializers import VmagazineOrderSerializer

        return Response(
            {
                "active_orders": VmagazineOrderSerializer(active[:10], many=True, context={"request": request}).data,
                "purchases": VmagazineOrderSerializer(purchases[:40], many=True, context={"request": request}).data,
                "reviewable": reviewable[:40],
            }
        )


class ProductAuthenticityRequestView(APIView):
    """Продавец запрашивает проверку подлинности товара."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        product = Product.objects.filter(pk=product_id, provider=provider).first()
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        note = str(request.data.get("note") or "").strip()[:2000]
        product.authenticity_status = Product.AuthenticityStatus.PENDING
        product.authenticity_note = note
        product.authenticity_requested_at = timezone.now()
        product.save(
            update_fields=[
                "authenticity_status",
                "authenticity_note",
                "authenticity_requested_at",
                "updated_at",
            ]
        )
        return Response(
            {
                "id": product.id,
                "authenticity_status": product.authenticity_status,
                "authenticity_note": product.authenticity_note,
            }
        )


class ProductAuthenticityVerifyView(APIView):
    """Подтверждение оригинала (владелец магазина / модерация MVP)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, product_id):
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        product = Product.objects.filter(pk=product_id, provider=provider).first()
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        action = str(request.data.get("action") or "verify").strip()
        if action == "reject":
            product.authenticity_status = Product.AuthenticityStatus.REJECTED
            product.authenticity_verified_at = None
        else:
            product.authenticity_status = Product.AuthenticityStatus.VERIFIED
            product.authenticity_verified_at = timezone.now()
        product.save(update_fields=["authenticity_status", "authenticity_verified_at", "updated_at"])
        return Response({"id": product.id, "authenticity_status": product.authenticity_status})

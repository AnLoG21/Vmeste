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
    ReturnRequest,
    SavedPaymentCard,
    ShopBonusBalance,
)
from .product_cards import active_products_qs, product_card, product_detail, record_product_view


def _liked_ids(user, product_ids):
    if not user or not user.is_authenticated or not product_ids:
        return set()
    return set(
        ProductLike.objects.filter(user=user, product_id__in=product_ids).values_list("product_id", flat=True)
    )


class HomeFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = active_products_qs()
        recommended = list(qs.order_by("-view_count", "-id")[:48])
        liked = _liked_ids(request.user, [p.id for p in recommended])
        addresses = list(
            DeliveryAddress.objects.filter(user=request.user).values(
                "id",
                "label",
                "address",
                "lat",
                "lon",
                "is_default",
                "apartment",
                "entrance",
                "floor",
                "intercom",
                "extra",
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
        sort = (request.query_params.get("sort") or "popular").strip()
        suggestions = []
        sections = []

        base = active_products_qs()
        if originals_only:
            base = base.filter(authenticity_status=Product.AuthenticityStatus.VERIFIED)

        def sort_qs(qs):
            if sort == "price_asc":
                return qs.order_by("price", "id")
            if sort == "price_desc":
                return qs.order_by("-price", "id")
            if sort == "name":
                return qs.order_by("name", "id")
            return qs.order_by("-view_count", "-id")

        if q:
            # Подсказки только из реально существующих сущностей
            product_names = list(
                base.filter(name__icontains=q).order_by("-view_count").values_list("name", flat=True)[:8]
            )
            cats = list(
                ProductCategory.objects.filter(name__icontains=q, products__is_active=True)
                .annotate(cnt=Count("products", filter=Q(products__is_active=True), distinct=True))
                .filter(cnt__gt=0)
                .values("id", "name", "cnt")
                .order_by("-cnt")[:8]
            )
            popular = list(
                PopularSearchQuery.objects.filter(query__icontains=q)
                .exclude(query__iexact=q)
                .order_by("-hits")[:6]
                .values_list("query", flat=True)
            )
            seen = set()
            for name in product_names:
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                suggestions.append({"type": "product", "text": name})
            for c in cats:
                key = c["name"].lower()
                if key in seen:
                    continue
                seen.add(key)
                suggestions.append({"type": "category", "text": c["name"], "category_id": c["id"]})
            for name in popular:
                # только если есть товары/категории под этот запрос
                if not base.filter(
                    Q(name__icontains=name) | Q(category__name__icontains=name)
                ).exists():
                    continue
                key = name.lower()
                if key in seen:
                    continue
                seen.add(key)
                suggestions.append({"type": "query", "text": name})

            qs = base.filter(
                Q(name__icontains=q)
                | Q(category__name__icontains=q)
                | Q(provider__organization_name__icontains=q)
            )

            for c in cats[:5]:
                top = base.filter(category_id=c["id"]).order_by("-view_count").first()
                if not top:
                    continue
                card = product_card(top, request)
                sections.append(
                    {
                        "type": "category",
                        "id": c["id"],
                        "title": c["name"],
                        "cover_url": card.get("cover_url") or "",
                    }
                )

            for shop in UserShopHints(q):
                # только магазины с активными товарами
                if not base.filter(provider_id=shop["id"]).exists():
                    continue
                sections.append(shop)

            products = list(sort_qs(qs)[:40])
            liked = _liked_ids(request.user, [p.id for p in products])
            cards = [product_card(p, request, liked=p.id in liked) for p in products]
            filter_facets = _build_filter_facets(products)

            # фиксируем популярный запрос только если нашлись товары
            if products:
                obj, created = PopularSearchQuery.objects.get_or_create(query=q[:120], defaults={"hits": 1})
                if not created:
                    PopularSearchQuery.objects.filter(pk=obj.pk).update(hits=F("hits") + 1)

            return Response(
                {
                    "suggestions": suggestions[:12],
                    "sections": sections[:5],
                    "products": cards,
                    "filters": filter_facets,
                }
            )

        # пустой запрос — без синтетики
        popular = list(PopularSearchQuery.objects.order_by("-hits")[:10].values_list("query", flat=True))
        for name in popular:
            if base.filter(Q(name__icontains=name) | Q(category__name__icontains=name)).exists():
                suggestions.append({"type": "query", "text": name})
        cats = (
            ProductCategory.objects.filter(products__is_active=True)
            .annotate(cnt=Count("products", filter=Q(products__is_active=True), distinct=True))
            .filter(cnt__gt=0)
            .values("id", "name", "cnt")
            .order_by("-cnt")[:5]
        )
        for c in cats:
            top = base.filter(category_id=c["id"]).order_by("-view_count").first()
            if not top:
                continue
            cover = product_card(top, request).get("cover_url") or ""
            sections.append({"type": "category", "id": c["id"], "title": c["name"], "cover_url": cover})
        return Response({"suggestions": suggestions, "sections": sections, "products": [], "filters": {}})


def _build_filter_facets(products: list) -> dict:
    """Адаптивные фильтры по attrs товаров в выдаче + флаг оригиналов."""
    attr_values: dict[str, set] = {}
    has_original = False
    for p in products:
        if p.authenticity_status == Product.AuthenticityStatus.VERIFIED:
            has_original = True
        attrs = p.attrs if isinstance(p.attrs, dict) else {}
        for key, val in attrs.items():
            if val is None or val == "":
                continue
            attr_values.setdefault(str(key)[:40], set()).add(str(val)[:80])
    facets = {
        "originals_available": has_original,
        "attributes": [
            {"key": k, "values": sorted(list(vals))[:20]}
            for k, vals in sorted(attr_values.items())
            if len(vals) >= 1
        ][:12],
    }
    return facets


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
                    "selected_size": row.selected_size or "",
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
        selected_size = str(request.data.get("selected_size") or "").strip()[:32]
        item, created = CartItem.objects.get_or_create(
            user=request.user,
            product=product,
            defaults={"quantity": qty, "selected_size": selected_size},
        )
        if not created:
            item.quantity = qty
            fields = ["quantity", "updated_at"]
            if "selected_size" in request.data:
                item.selected_size = selected_size
                fields.append("selected_size")
            item.save(update_fields=fields)
        if "use_bonuses" in request.data:
            item.use_bonuses = bool(request.data.get("use_bonuses"))
            item.save(update_fields=["use_bonuses", "updated_at"])
        return Response(
            {
                "id": item.id,
                "quantity": item.quantity,
                "use_bonuses": item.use_bonuses,
                "selected_size": item.selected_size,
            },
            status=201 if created else 200,
        )

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


class ProductDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, product_id):
        product = (
            active_products_qs()
            .filter(pk=product_id)
            .prefetch_related("related_products", "related_products__photos")
            .first()
        )
        if not product:
            return Response({"detail": "Товар не найден"}, status=404)
        liked = product.id in _liked_ids(request.user, [product.id])
        return Response(product_detail(product, request, liked=liked))


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
                    "intercom": a.intercom,
                    "extra": a.extra,
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
                intercom=str(request.data.get("intercom") or "")[:64],
                extra=str(request.data.get("extra") or "")[:255],
                lat=request.data.get("lat"),
                lon=request.data.get("lon"),
                is_default=bool(request.data.get("is_default") if "is_default" in request.data else True),
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


def _luhn_ok(number: str) -> bool:
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def _detect_card_brand(number: str) -> str:
    n = "".join(c for c in number if c.isdigit())
    if n.startswith("220") or n.startswith("2200") or n.startswith("2204"):
        return "mir"
    if n.startswith("4"):
        return "visa"
    if n[:2] in {f"{i}" for i in range(51, 56)} or (2221 <= int(n[:4] or 0) <= 2720):
        return "mastercard"
    if n.startswith("34") or n.startswith("37"):
        return "amex"
    if n.startswith("62"):
        return "unionpay"
    return "card"


class PaymentCardsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = SavedPaymentCard.objects.filter(user=request.user).select_related("provider")
        provider_id = request.query_params.get("provider_id")
        if provider_id:
            try:
                rows = rows.filter(provider_id=int(provider_id))
            except (TypeError, ValueError):
                pass
        return Response(
            [
                {
                    "id": c.id,
                    "brand": c.brand,
                    "last4": c.last4,
                    "exp_month": c.exp_month,
                    "exp_year": c.exp_year,
                    "is_default": c.is_default,
                    "provider_id": c.provider_id,
                    "provider_name": (
                        (c.provider.organization_name or c.provider.username) if c.provider_id else ""
                    ),
                    "has_token": bool(c.yookassa_payment_method_id),
                }
                for c in rows
            ]
        )

    def post(self, request):
        pan = str(request.data.get("number") or request.data.get("pan") or "").replace(" ", "").strip()
        last4 = str(request.data.get("last4") or "").strip()
        brand = str(request.data.get("brand") or "").strip().lower()
        try:
            exp_month = int(request.data.get("exp_month") or 0)
            exp_year = int(request.data.get("exp_year") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "Некорректный срок действия"}, status=400)

        if pan:
            if not _luhn_ok(pan):
                return Response({"detail": "Некорректный номер карты"}, status=400)
            last4 = pan[-4:]
            brand = _detect_card_brand(pan)
        elif len(last4) == 4 and last4.isdigit():
            brand = brand or "card"
        else:
            return Response({"detail": "Укажите полный номер карты"}, status=400)

        if not (1 <= exp_month <= 12) or exp_year < 2024 or exp_year > 2100:
            return Response({"detail": "Укажите срок действия ММ/ГГГГ"}, status=400)

        with transaction.atomic():
            if request.data.get("is_default") or not SavedPaymentCard.objects.filter(user=request.user).exists():
                SavedPaymentCard.objects.filter(user=request.user).update(is_default=False)
                is_default = True
            else:
                is_default = bool(request.data.get("is_default"))
            card = SavedPaymentCard.objects.create(
                user=request.user,
                brand=(brand or "card")[:32],
                last4=last4,
                exp_month=exp_month,
                exp_year=exp_year,
                is_default=is_default,
            )
        return Response(
            {
                "id": card.id,
                "brand": card.brand,
                "last4": card.last4,
                "exp_month": card.exp_month,
                "exp_year": card.exp_year,
                "is_default": card.is_default,
            },
            status=201,
        )

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
        # товары для отзыва после покупки (исключаем уже оставленные)
        reviewed_order_ids = set()
        try:
            from reviews.models import Review

            reviewed_order_ids = set(
                Review.objects.filter(
                    client=request.user,
                    shop_order_id__in=[o.id for o in purchases],
                ).values_list("shop_order_id", flat=True)
            )
        except Exception:
            reviewed_order_ids = set()
        reviewable = []
        for o in purchases[:20]:
            if o.id in reviewed_order_ids:
                continue
            for item in o.items.all():
                if item.product_id:
                    reviewable.append(
                        {
                            "order_id": o.id,
                            "product_id": item.product_id,
                            "provider_id": o.provider_id,
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


class ReturnRequestsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        rows = (
            ReturnRequest.objects.filter(user=request.user)
            .select_related("order", "order_item", "order__provider")
            .order_by("-created_at")[:40]
        )
        return Response(
            [
                {
                    "id": r.id,
                    "status": r.status,
                    "reason": r.reason,
                    "created_at": r.created_at,
                    "order_id": r.order_id,
                    "order_item_id": r.order_item_id,
                    "product_name": r.order_item.name,
                    "provider_name": r.order.provider.organization_name or r.order.provider.username,
                    "shop_url": (
                        f"/s/{r.order.provider.organization_slug}"
                        if r.order.provider.organization_slug
                        else ""
                    ),
                    "seller_note": r.seller_note or "",
                    "refund_id": r.refund_id or "",
                }
                for r in rows
            ]
        )

    def post(self, request):
        try:
            order_id = int(request.data.get("order_id"))
            item_id = int(request.data.get("order_item_id") or request.data.get("item_id"))
        except (TypeError, ValueError):
            return Response({"detail": "Укажите order_id и order_item_id"}, status=400)
        order = (
            ShopOrder.objects.filter(pk=order_id, client=request.user)
            .exclude(status=ShopOrder.Status.CANCELLED)
            .first()
        )
        if not order:
            return Response({"detail": "Заказ не найден"}, status=404)
        if order.status not in (ShopOrder.Status.DONE, ShopOrder.Status.DELIVERING, ShopOrder.Status.READY):
            return Response({"detail": "Возврат доступен после выдачи/доставки заказа"}, status=400)
        item = order.items.filter(pk=item_id).first()
        if not item:
            return Response({"detail": "Позиция заказа не найдена"}, status=404)
        if ReturnRequest.objects.filter(user=request.user, order_item=item).exclude(
            status=ReturnRequest.Status.REJECTED
        ).exists():
            return Response({"detail": "Заявка по этой позиции уже есть"}, status=400)
        row = ReturnRequest.objects.create(
            user=request.user,
            order=order,
            order_item=item,
            reason=str(request.data.get("reason") or "").strip()[:2000],
        )
        try:
            from shop.notify import notify_new_return_request

            notify_new_return_request(row)
        except Exception:
            pass
        return Response({"id": row.id, "status": row.status}, status=201)

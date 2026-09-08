from decimal import Decimal

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from cafe.delivery_zones import find_delivery_zone, normalize_delivery_zones
from payments.gateway import create_org_payment
from payments.resolve import resolve_org_payment_setup
from users.models import User
from users.slug_utils import ensure_organization_slug

from .access import can_manage_shop, provider_sphere_allows_shop, resolve_shop_provider
from .delivery import available_delivery_methods, get_delivery_provider, resolve_order_delivery_kind
from .models import (
    Product,
    ProductCategory,
    ProductPhoto,
    ProductSubcategory,
    ServiceMaterial,
    ShopOrder,
    ShopOrderItem,
    ShopSettings,
    StockMovement,
)
from .serializers import (
    ProductCategorySerializer,
    ProductPhotoSerializer,
    ProductPublicSerializer,
    ProductSerializer,
    ProductSubcategorySerializer,
    ServiceMaterialSerializer,
    ShopOrderSerializer,
    ShopSettingsSerializer,
    StockMovementSerializer,
)
from .stock import InsufficientStock, apply_stock_change


FEATURED_LIMIT = 5


def _get_or_create_settings(provider) -> ShopSettings:
    obj, _ = ShopSettings.objects.get_or_create(provider=provider)
    return obj


def _parse_coord(value):
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _provider_origin_coords(provider):
    lat = getattr(provider, "organization_latitude", None)
    lon = getattr(provider, "organization_longitude", None)
    if lat is None or lon is None:
        return None, None
    try:
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None, None


def _delivery_options(settings_obj, provider, *, dest_lat=None, dest_lon=None):
    origin_lat, origin_lon = _provider_origin_coords(provider)
    return available_delivery_methods(
        settings_obj,
        dest_lat=dest_lat,
        dest_lon=dest_lon,
        origin_lat=origin_lat,
        origin_lon=origin_lon,
    )


def _provider_by_slug(slug: str) -> User:
    slug = (slug or "").strip().lower()
    provider = get_object_or_404(User, organization_slug__iexact=slug, role=User.Role.PROVIDER)
    ensure_organization_slug(provider)
    return provider


class ProductCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ProductCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        provider = resolve_shop_provider(self.request.user)
        if not provider:
            return ProductCategory.objects.none()
        qs = ProductCategory.objects.filter(provider=provider).prefetch_related(
            "children", "subcategories", "products"
        )
        parent = self.request.query_params.get("parent")
        roots_only = str(self.request.query_params.get("roots") or "").lower() in ("1", "true", "yes")
        if parent:
            qs = qs.filter(parent_id=parent)
        elif roots_only:
            qs = qs.filter(parent__isnull=True)
        return qs

    def perform_create(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save(provider=resolve_shop_provider(self.request.user))

    @action(detail=False, methods=["post"], url_path="from-pool")
    def from_pool(self, request):
        """Добавить категорию (и при необходимости родителей) из пула по ключу path."""
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        path = request.data.get("path") or []
        if not isinstance(path, list) or not path:
            return Response({"detail": "Нужен path: [{key,name},…]"}, status=400)
        parent = None
        created = []
        for i, node in enumerate(path[:12]):
            key = str(node.get("key") or "").strip()
            name = str(node.get("name") or "").strip()[:120]
            if not key or not name:
                continue
            obj = ProductCategory.objects.filter(provider=provider, pool_key=key).first()
            if not obj:
                obj = ProductCategory.objects.create(
                    provider=provider,
                    parent=parent,
                    name=name,
                    pool_key=key,
                    sort_order=i,
                )
            else:
                if obj.parent_id != (parent.id if parent else None):
                    obj.parent = parent
                    obj.save(update_fields=["parent"])
            parent = obj
            created.append(obj)
        if not created:
            return Response({"detail": "Пустой path"}, status=400)
        return Response(
            {
                "leaf": ProductCategorySerializer(created[-1], context={"request": request}).data,
                "path": [
                    {"id": c.id, "name": c.name, "pool_key": c.pool_key} for c in created
                ],
            },
            status=201,
        )

    def perform_update(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        instance.delete()

    @action(detail=True, methods=["post"])
    def subcategories(self, request, pk=None):
        cat = self.get_object()
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)
        ser = ProductSubcategorySerializer(data={**request.data, "category": cat.id})
        ser.is_valid(raise_exception=True)
        ser.save(category=cat)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class ProductSubcategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSubcategorySerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "put", "delete", "head", "options"]

    def get_queryset(self):
        provider = resolve_shop_provider(self.request.user)
        if not provider:
            return ProductSubcategory.objects.none()
        return ProductSubcategory.objects.filter(category__provider=provider)

    def perform_update(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        instance.delete()


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        provider = resolve_shop_provider(self.request.user)
        if not provider:
            return Product.objects.none()
        return (
            Product.objects.filter(provider=provider)
            .select_related("category", "subcategory")
            .prefetch_related("photos", "related_products")
        )

    def perform_create(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        provider = resolve_shop_provider(self.request.user)
        product = serializer.save(provider=provider)
        self._enforce_featured_limit(provider, product)

    def perform_update(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        product = serializer.save()
        self._enforce_featured_limit(product.provider, product)

    def perform_destroy(self, instance):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        instance.delete()

    def _enforce_featured_limit(self, provider, product):
        if not product.is_featured:
            return
        featured = list(
            Product.objects.filter(provider=provider, is_featured=True)
            .exclude(pk=product.pk)
            .order_by("featured_order", "id")
        )
        if len(featured) >= FEATURED_LIMIT:
            # demote oldest beyond limit-1 slots left for this product
            for old in featured[FEATURED_LIMIT - 1 :]:
                old.is_featured = False
                old.save(update_fields=["is_featured"])

    @action(detail=True, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def photos(self, request, pk=None):
        product = self.get_object()
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist("image") or request.FILES.getlist("images")
        if not files and request.FILES.get("image"):
            files = [request.FILES.get("image")]
        if not files:
            return Response({"detail": "Нужен файл image"}, status=status.HTTP_400_BAD_REQUEST)
        existing = product.photos.count()
        room = max(0, 5 - existing)
        if room <= 0:
            return Response({"detail": "Можно не больше 5 фото"}, status=400)
        created = []
        for i, image in enumerate(files[:room]):
            photo = ProductPhoto.objects.create(
                product=product, image=image, sort_order=existing + i
            )
            created.append(photo)
        return Response(
            ProductPhotoSerializer(created, many=True, context={"request": request}).data,
            status=201,
        )

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>[^/.]+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        product = self.get_object()
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)
        photo = get_object_or_404(ProductPhoto, pk=photo_id, product=product)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def stock(self, request, pk=None):
        product = self.get_object()
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=status.HTTP_403_FORBIDDEN)
        kind = str(request.data.get("kind") or "").strip()
        try:
            qty = Decimal(str(request.data.get("qty") or "0"))
        except Exception:
            return Response({"detail": "Некорректное количество"}, status=400)
        reason = str(request.data.get("reason") or "").strip()
        if kind not in (StockMovement.Kind.IN, StockMovement.Kind.OUT_MANUAL, StockMovement.Kind.ADJUST):
            return Response({"detail": "kind: in | out_manual | adjust"}, status=400)
        try:
            mv = apply_stock_change(
                product=product,
                kind=kind,
                qty=qty,
                provider=product.provider,
                reason=reason,
                created_by=request.user,
                allow_negative=kind == StockMovement.Kind.ADJUST,
            )
        except InsufficientStock as e:
            return Response({"detail": str(e)}, status=400)
        product.refresh_from_db()
        return Response(
            {
                "movement": StockMovementSerializer(mv).data if mv else None,
                "product": ProductSerializer(product, context={"request": request}).data,
            }
        )


class StockMovementViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockMovementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        provider = resolve_shop_provider(self.request.user)
        if not provider:
            return StockMovement.objects.none()
        qs = StockMovement.objects.filter(provider=provider).select_related("product")
        pid = self.request.query_params.get("product")
        if pid:
            qs = qs.filter(product_id=pid)
        return qs[:200]


class ServiceMaterialViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceMaterialSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        provider = resolve_shop_provider(self.request.user)
        if not provider:
            return ServiceMaterial.objects.none()
        qs = ServiceMaterial.objects.filter(product__provider=provider).select_related("product", "service")
        service_id = self.request.query_params.get("service")
        if service_id:
            qs = qs.filter(service_id=service_id)
        return qs

    def perform_create(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        product = serializer.validated_data["product"]
        service = serializer.validated_data["service"]
        provider = resolve_shop_provider(self.request.user)
        if product.provider_id != provider.id or service.provider_id != provider.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Товар и услуга должны принадлежать вашей организации")
        serializer.save()

    def perform_update(self, serializer):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not can_manage_shop(self.request.user):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        instance.delete()


class ShopSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider = resolve_shop_provider(request.user)
        if not provider or not provider_sphere_allows_shop(provider):
            return Response({"detail": "Магазин недоступен для этой сферы"}, status=403)
        settings_obj = _get_or_create_settings(provider)
        data = ShopSettingsSerializer(settings_obj).data
        data["has_yandex_token"] = bool(settings_obj.yandex_delivery_token)
        data["has_cdek_secret"] = bool(settings_obj.cdek_client_secret)
        data["has_russian_post"] = bool(settings_obj.russian_post_token and settings_obj.russian_post_user_key)
        data["has_dostavista_token"] = bool(settings_obj.dostavista_token)
        data["delivery_options"] = _delivery_options(settings_obj, provider)
        return Response(data)

    def patch(self, request):
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        settings_obj = _get_or_create_settings(provider)
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if "delivery_zones" in data:
            data["delivery_zones"] = normalize_delivery_zones(data.get("delivery_zones"))
        # empty secrets keep previous
        for secret_field in (
            "yandex_delivery_token",
            "cdek_client_secret",
            "russian_post_token",
            "russian_post_user_key",
            "dostavista_token",
        ):
            if secret_field in data and not str(data.get(secret_field) or "").strip():
                data.pop(secret_field)
        ser = ShopSettingsSerializer(settings_obj, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        # синхронизируем legacy delivery_provider с первым включённым методом
        settings_obj.refresh_from_db()
        methods = _delivery_options(settings_obj, provider)
        if methods:
            settings_obj.delivery_provider = methods[0]["id"]
            settings_obj.save(update_fields=["delivery_provider"])
        elif settings_obj.enable_yandex_delivery:
            settings_obj.delivery_provider = "yandex"
            settings_obj.save(update_fields=["delivery_provider"])
        elif settings_obj.enable_cdek_delivery:
            settings_obj.delivery_provider = "cdek"
            settings_obj.save(update_fields=["delivery_provider"])
        elif settings_obj.enable_russian_post:
            settings_obj.delivery_provider = "russian_post"
            settings_obj.save(update_fields=["delivery_provider"])
        elif settings_obj.enable_dostavista:
            settings_obj.delivery_provider = "dostavista"
            settings_obj.save(update_fields=["delivery_provider"])
        else:
            settings_obj.delivery_provider = "own"
            settings_obj.save(update_fields=["delivery_provider"])
        out = ShopSettingsSerializer(settings_obj).data
        out["has_yandex_token"] = bool(settings_obj.yandex_delivery_token)
        out["has_cdek_secret"] = bool(settings_obj.cdek_client_secret)
        out["has_russian_post"] = bool(settings_obj.russian_post_token and settings_obj.russian_post_user_key)
        out["has_dostavista_token"] = bool(settings_obj.dostavista_token)
        out["delivery_options"] = _delivery_options(settings_obj, provider)
        return Response(out)


class ShopOrderViewSet(viewsets.ModelViewSet):
    serializer_class = ShopOrderSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if user.role == User.Role.CLIENT:
            return ShopOrder.objects.filter(client=user).prefetch_related("items")
        provider = resolve_shop_provider(user)
        if not provider:
            return ShopOrder.objects.none()
        return (
            ShopOrder.objects.filter(provider=provider)
            .select_related("client", "courier_user")
            .prefetch_related("items")
        )

    def partial_update(self, request, *args, **kwargs):
        order = self.get_object()
        provider = resolve_shop_provider(request.user)
        if not provider or order.provider_id != provider.id:
            return Response({"detail": "Нет доступа"}, status=403)
        allowed_status = {c.value for c in ShopOrder.Status}
        new_status = request.data.get("status")
        previous_status = order.status
        if new_status and new_status in allowed_status:
            order.status = new_status
            if new_status == ShopOrder.Status.TO_COURIER and order.mode == ShopOrder.Mode.DELIVERY:
                try:
                    settings_obj = _get_or_create_settings(provider)
                    kind = resolve_order_delivery_kind(order, settings_obj)
                    dp = get_delivery_provider(settings_obj, kind)
                    result = dp.create_shipment(order)
                    order.external_delivery_provider = result.provider
                    order.external_tracking_id = result.tracking_id
                except Exception as e:
                    return Response({"detail": str(e)}, status=400)
            update_fields = ["status", "updated_at"]
            if "external_tracking_id" in [f.name for f in order._meta.fields]:
                update_fields.extend(["external_delivery_provider", "external_tracking_id"])
            order.save(update_fields=list(dict.fromkeys(update_fields)))
            if new_status == ShopOrder.Status.DONE:
                try:
                    from vmagazine.bonuses import accrue_order_bonuses

                    accrue_order_bonuses(order)
                except Exception:
                    pass
            try:
                from .notify import notify_shop_order_status

                notify_shop_order_status(order, previous_status=previous_status)
            except Exception:
                pass
        if "courier_user" in request.data:
            order.courier_user_id = request.data.get("courier_user") or None
            order.save(update_fields=["courier_user", "updated_at"])
        if "courier_lat" in request.data and "courier_lon" in request.data:
            try:
                order.courier_lat = float(request.data.get("courier_lat"))
                order.courier_lon = float(request.data.get("courier_lon"))
                order.courier_updated_at = timezone.now()
                order.save(update_fields=["courier_lat", "courier_lon", "courier_updated_at", "updated_at"])
            except (TypeError, ValueError):
                pass
        return Response(ShopOrderSerializer(order, context={"request": request}).data)


class PublicShopCatalogView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        provider = _provider_by_slug(slug)
        if not provider_sphere_allows_shop(provider):
            return Response({"detail": "Магазин недоступен"}, status=404)
        featured_only = str(request.query_params.get("featured") or "").lower() in ("1", "true", "yes")
        qs = (
            Product.objects.filter(provider=provider, is_active=True)
            .select_related("category", "subcategory")
            .prefetch_related("photos", "related_products", "related_products__photos")
        )
        if featured_only:
            qs = qs.filter(is_featured=True).order_by("featured_order", "id")[:FEATURED_LIMIT]
        else:
            qs = qs.order_by("category__sort_order", "name", "id")
        settings_obj = _get_or_create_settings(provider)
        categories = ProductCategory.objects.filter(provider=provider).prefetch_related("subcategories")
        logo_url = ""
        first_photo = (
            provider.gallery_photos.filter(image__isnull=False).exclude(image="").order_by("id").first()
        )
        if first_photo and first_photo.image:
            from common.media_urls import photo_urls

            urls = photo_urls(request, first_photo.image)
            logo_url = urls.get("thumb_url") or urls.get("url") or ""
        dest_lat = _parse_coord(request.query_params.get("lat"))
        dest_lon = _parse_coord(request.query_params.get("lon"))
        origin_lat, origin_lon = _provider_origin_coords(provider)
        return Response(
            {
                "provider": {
                    "id": provider.id,
                    "organization_name": provider.organization_name or provider.username,
                    "slug": provider.organization_slug,
                    "sphere": provider.provider_sphere,
                    "logo_url": logo_url,
                    "latitude": origin_lat,
                    "longitude": origin_lon,
                },
                "settings": {
                    "enable_pickup": settings_obj.enable_pickup,
                    "enable_delivery": settings_obj.enable_delivery,
                    "delivery_info": settings_obj.delivery_info,
                    "delivery_fee": str(settings_obj.delivery_fee),
                    "delivery_min_order": str(settings_obj.delivery_min_order),
                    "delivery_zones": settings_obj.delivery_zones or [],
                    "accept_online_payment": settings_obj.accept_online_payment,
                    "delivery_options": _delivery_options(
                        settings_obj, provider, dest_lat=dest_lat, dest_lon=dest_lon
                    ),
                },
                "categories": ProductCategorySerializer(categories, many=True).data,
                "products": ProductPublicSerializer(qs, many=True, context={"request": request}).data,
            }
        )


class PublicShopDeliveryQuoteView(APIView):
    """Пересчёт ETA доставки по координатам адреса покупателя."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        provider = _provider_by_slug(slug)
        if not provider_sphere_allows_shop(provider):
            return Response({"detail": "Магазин недоступен"}, status=404)
        settings_obj = _get_or_create_settings(provider)
        dest_lat = _parse_coord(request.query_params.get("lat"))
        dest_lon = _parse_coord(request.query_params.get("lon"))
        if dest_lat is None or dest_lon is None:
            return Response({"detail": "Укажите lat и lon адреса доставки"}, status=400)
        options = _delivery_options(settings_obj, provider, dest_lat=dest_lat, dest_lon=dest_lon)
        distance_m = next((o.get("distance_m") for o in options if o.get("distance_m") is not None), None)
        return Response(
            {
                "delivery_options": options,
                "distance_m": distance_m,
                "origin": {
                    "latitude": _provider_origin_coords(provider)[0],
                    "longitude": _provider_origin_coords(provider)[1],
                },
            }
        )


class PublicShopOrderCreateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, slug):
        provider = _provider_by_slug(slug)
        if not provider_sphere_allows_shop(provider):
            return Response({"detail": "Магазин недоступен"}, status=404)
        settings_obj = _get_or_create_settings(provider)
        mode = str(request.data.get("mode") or "pickup").strip()
        if mode == "pickup" and not settings_obj.enable_pickup:
            return Response({"detail": "Самовывоз отключён"}, status=400)
        if mode == "delivery" and not settings_obj.enable_delivery:
            return Response({"detail": "Доставка отключена"}, status=400)
        if mode not in (ShopOrder.Mode.PICKUP, ShopOrder.Mode.DELIVERY):
            return Response({"detail": "mode: pickup | delivery"}, status=400)

        raw_items = request.data.get("items") or []
        if not isinstance(raw_items, list) or not raw_items:
            return Response({"detail": "Добавьте товары"}, status=400)

        lines = []
        items_total = Decimal("0")
        for row in raw_items[:50]:
            try:
                pid = int(row.get("product_id") or row.get("product"))
                qty = int(row.get("quantity") or 1)
            except (TypeError, ValueError):
                continue
            if qty < 1:
                continue
            product = Product.objects.filter(pk=pid, provider=provider, is_active=True).first()
            if not product:
                return Response({"detail": f"Товар {pid} недоступен"}, status=400)
            if Decimal(product.stock_qty) < qty:
                return Response({"detail": f"Недостаточно «{product.name}» на складе"}, status=400)
            line_sum = Decimal(product.price) * qty
            items_total += line_sum
            selected_size = str(row.get("selected_size") or row.get("size") or "").strip()[:32]
            lines.append((product, qty, Decimal(product.price), selected_size))

        if not lines:
            return Response({"detail": "Добавьте товары"}, status=400)

        delivery_fee = Decimal("0")
        delivery_lat = delivery_lon = None
        delivery_address = str(request.data.get("delivery_address") or "").strip()
        chosen_method = str(request.data.get("delivery_method") or request.data.get("chosen_delivery_provider") or "").strip()
        eta_text = ""
        if mode == ShopOrder.Mode.DELIVERY:
            try:
                delivery_lat = float(request.data.get("delivery_lat"))
                delivery_lon = float(request.data.get("delivery_lon"))
            except (TypeError, ValueError):
                delivery_lat = delivery_lon = None
            options = _delivery_options(
                settings_obj, provider, dest_lat=delivery_lat, dest_lon=delivery_lon
            )
            if not options:
                return Response({"detail": "Нет доступных способов доставки"}, status=400)
            if not chosen_method:
                chosen_method = options[0]["id"]
            option = next((o for o in options if o["id"] == chosen_method), None)
            if not option:
                return Response({"detail": "Выбранный способ доставки недоступен"}, status=400)
            eta_text = option.get("eta") or ""
            zones = settings_obj.delivery_zones or []
            # зоны и fee курьера продавца; для внешних — базовая стоимость из настроек
            if chosen_method == "own" and zones and delivery_lat is not None and delivery_lon is not None:
                zone = find_delivery_zone(delivery_lat, delivery_lon, zones)
                if not zone:
                    return Response({"detail": "Адрес вне зоны доставки"}, status=400)
                delivery_fee = Decimal(str(zone.get("fee") or settings_obj.delivery_fee or 0))
                min_order = Decimal(str(zone.get("min_order") or settings_obj.delivery_min_order or 0))
                if items_total < min_order:
                    return Response({"detail": f"Минимальный заказ для зоны: {min_order} ₽"}, status=400)
            else:
                if chosen_method == "own" and zones and (delivery_lat is None or delivery_lon is None):
                    return Response({"detail": "Укажите точку доставки на карте"}, status=400)
                delivery_fee = Decimal(settings_obj.delivery_fee or 0)
                min_order = Decimal(settings_obj.delivery_min_order or 0)
                if items_total < min_order:
                    return Response({"detail": f"Минимальный заказ: {min_order} ₽"}, status=400)
            if not delivery_address:
                return Response({"detail": "Укажите адрес доставки"}, status=400)

        total = items_total + delivery_fee
        service_fee = Decimal("0")
        if str(request.data.get("service_fee") or "").lower() in ("1", "true", "yes"):
            service_fee = (total * Decimal("0.015")).quantize(Decimal("0.01"))
            total = total + service_fee
        client = request.user if request.user and request.user.is_authenticated else None
        payment_method = str(request.data.get("payment_method") or "online").strip().lower()
        if payment_method not in ("online", "cash", "on_receipt"):
            payment_method = "online"

        comment = str(request.data.get("comment") or "").strip()[:500]
        if service_fee > 0:
            fee_note = f"Сервисный сбор 1,5%: {service_fee} ₽"
            comment = f"{comment}\n{fee_note}".strip()[:500]

        use_bonuses = str(request.data.get("use_bonuses") or "").lower() in ("1", "true", "yes")
        try:
            bonus_requested = Decimal(str(request.data.get("bonus_amount") or "0"))
        except Exception:
            bonus_requested = Decimal("0")

        with transaction.atomic():
            order = ShopOrder.objects.create(
                provider=provider,
                client=client,
                mode=mode,
                status=ShopOrder.Status.AWAITING_PAYMENT,
                chosen_delivery_provider=chosen_method if mode == ShopOrder.Mode.DELIVERY else "",
                eta_text=eta_text if mode == ShopOrder.Mode.DELIVERY else "",
                guest_name=str(request.data.get("guest_name") or "").strip()[:120],
                guest_phone=str(request.data.get("guest_phone") or "").strip()[:32],
                guest_email=str(request.data.get("guest_email") or "").strip()[:120],
                delivery_address=delivery_address,
                apartment=str(request.data.get("apartment") or "").strip()[:32],
                entrance=str(request.data.get("entrance") or "").strip()[:32],
                intercom=str(request.data.get("intercom") or "").strip()[:32],
                private_house=bool(request.data.get("private_house")),
                delivery_lat=delivery_lat,
                delivery_lon=delivery_lon,
                delivery_fee=delivery_fee,
                items_total=items_total,
                total=total,
                comment=comment,
            )
            for product, qty, price, selected_size in lines:
                ShopOrderItem.objects.create(
                    order=order,
                    product=product,
                    name=product.name,
                    unit_price=price,
                    quantity=qty,
                    selected_size=selected_size,
                )
            if use_bonuses and client:
                try:
                    from vmagazine.bonuses import spend_order_bonuses

                    spend_order_bonuses(order, bonus_requested if bonus_requested > 0 else None)
                    order.refresh_from_db()
                    total = Decimal(order.total)
                except Exception:
                    pass

        try:
            from .notify import notify_new_shop_order

            notify_new_shop_order(order)
        except Exception:
            pass

        if payment_method in ("cash", "on_receipt"):
            previous = order.status
            order.status = ShopOrder.Status.PAID
            order.save(update_fields=["status", "updated_at"])
            try:
                from .notify import notify_shop_order_status

                notify_shop_order_status(order, previous_status=previous)
            except Exception:
                pass
            return Response(
                {
                    "order_id": order.id,
                    "total": str(order.total),
                    "status": order.status,
                    "payment_method": payment_method,
                    "service_fee": str(service_fee),
                    "bonus_spent": str(order.bonus_spent or 0),
                    "confirmation_url": "",
                },
                status=201,
            )

        if not settings_obj.accept_online_payment:
            return Response(
                {"detail": "Онлайн-оплата отключена. Свяжитесь с организацией.", "order_id": order.id},
                status=400,
            )

        payment_method_id = ""
        try:
            card_id = int(request.data.get("payment_card_id") or 0)
        except (TypeError, ValueError):
            card_id = 0
        if client and card_id:
            from vmagazine.models import SavedPaymentCard

            card = (
                SavedPaymentCard.objects.filter(pk=card_id, user=client)
                .exclude(yookassa_payment_method_id="")
                .first()
            )
            if card and (not card.provider_id or card.provider_id == provider.id):
                payment_method_id = card.yookassa_payment_method_id

        try:
            provider_code, creds = resolve_org_payment_setup(provider)
            pay = create_org_payment(
                provider_code=provider_code,
                creds=creds,
                amount=Decimal(order.total),
                description=f"Заказ магазина #{order.id} — {provider.organization_name or provider.username}",
                return_url=str(request.data.get("return_url") or "").strip()
                or f"{request.build_absolute_uri('/').rstrip('/')}/s/{slug}?order={order.id}",
                metadata={
                    "type": "shop_order",
                    "order_id": str(order.id),
                    "client_id": str(client.id) if client else "",
                },
                order_id=f"s{order.id}",
                save_payment_method=bool(client) and not payment_method_id,
                payment_method_id=payment_method_id or None,
            )
            if not pay or not pay.get("id"):
                raise RuntimeError("Платёжный провайдер не вернул id")
            order.yookassa_payment_id = pay.get("id") or ""
            order.confirmation_url = pay.get("confirmation_url") or ""
            order.save(update_fields=["yookassa_payment_id", "confirmation_url", "updated_at"])
            # Сохранённая карта без 3DS — оплата могла пройти сразу
            if not order.confirmation_url and str(pay.get("status") or "") == "succeeded":
                from shop.payments import mark_shop_order_paid
                from vmagazine.cards import upsert_saved_card_from_yookassa_payment

                mark_shop_order_paid(order)
                if client and pay.get("raw"):
                    upsert_saved_card_from_yookassa_payment(
                        user=client, provider=provider, payment_obj=pay.get("raw")
                    )
        except Exception as e:
            try:
                from vmagazine.bonuses import refund_order_bonuses

                refund_order_bonuses(order)
            except Exception:
                pass
            order.status = ShopOrder.Status.CANCELLED
            order.save(update_fields=["status", "updated_at"])
            return Response({"detail": f"Не удалось создать оплату: {e}"}, status=400)

        return Response(
            {
                "order_id": order.id,
                "total": str(order.total),
                "confirmation_url": order.confirmation_url,
                "status": order.status,
                "payment_method": "online",
                "service_fee": str(service_fee),
                "bonus_spent": str(order.bonus_spent or 0),
                "saved_card_used": bool(payment_method_id),
            },
            status=201,
        )


class PublicShopOrderStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, slug, order_id):
        provider = _provider_by_slug(slug)
        order = get_object_or_404(ShopOrder, pk=order_id, provider=provider)
        return Response(ShopOrderSerializer(order, context={"request": request}).data)


def mark_shop_order_paid(order: ShopOrder) -> None:
    from .payments import mark_shop_order_paid as _mark

    _mark(order)


class ShopReturnRequestsView(APIView):
    """Возвраты для кабинета продавца: список и решение (approve/reject/done)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        if not provider:
            return Response({"detail": "Нет доступа"}, status=403)
        from vmagazine.models import ReturnRequest

        rows = (
            ReturnRequest.objects.filter(order__provider=provider)
            .select_related("order", "order_item", "user")
            .order_by("-created_at")[:80]
        )
        return Response(
            [
                {
                    "id": r.id,
                    "status": r.status,
                    "reason": r.reason,
                    "seller_note": r.seller_note,
                    "refund_id": r.refund_id,
                    "created_at": r.created_at,
                    "order_id": r.order_id,
                    "order_item_id": r.order_item_id,
                    "product_name": r.order_item.name,
                    "quantity": r.order_item.quantity,
                    "unit_price": str(r.order_item.unit_price),
                    "line_total": str(r.order_item.line_total),
                    "selected_size": getattr(r.order_item, "selected_size", "") or "",
                    "client_name": (
                        r.order.guest_name
                        or (r.user.get_full_name() if r.user_id else "")
                        or (r.user.username if r.user_id else "")
                    ),
                    "client_phone": r.order.guest_phone or getattr(r.user, "phone", "") or "",
                }
                for r in rows
            ]
        )

    def patch(self, request):
        if not can_manage_shop(request.user):
            return Response({"detail": "Нет доступа"}, status=403)
        provider = resolve_shop_provider(request.user)
        if not provider:
            return Response({"detail": "Нет доступа"}, status=403)
        from vmagazine.models import ReturnRequest

        try:
            rid = int(request.data.get("id") or request.data.get("return_id"))
        except (TypeError, ValueError):
            return Response({"detail": "Укажите id заявки"}, status=400)
        row = (
            ReturnRequest.objects.filter(pk=rid, order__provider=provider)
            .select_related("order", "order_item", "user")
            .first()
        )
        if not row:
            return Response({"detail": "Заявка не найдена"}, status=404)
        new_status = str(request.data.get("status") or "").strip()
        allowed = {c.value for c in ReturnRequest.Status}
        if new_status not in allowed:
            return Response({"detail": "status: pending|approved|rejected|done"}, status=400)
        previous = row.status
        row.seller_note = str(request.data.get("seller_note") or row.seller_note or "").strip()[:500]
        row.status = new_status

        if new_status == ReturnRequest.Status.APPROVED and previous != ReturnRequest.Status.APPROVED:
            # Попытка вернуть деньги по онлайн-заказу
            order = row.order
            if order.yookassa_payment_id and not row.refund_id:
                try:
                    from decimal import Decimal

                    from payments.resolve import resolve_org_payment_setup
                    from subscriptions.yookassa_client import create_refund

                    amount = Decimal(row.order_item.unit_price) * Decimal(row.order_item.quantity)
                    code, creds = resolve_org_payment_setup(provider)
                    if code == "yookassa" and amount > 0:
                        refund = create_refund(
                            payment_id=order.yookassa_payment_id,
                            amount=str(amount),
                            description=f"Возврат по заявке #{row.id} заказ #{order.id}",
                            shop_id=(creds.get("shop_id") or "").strip() or None,
                            secret_key=(creds.get("secret_key") or "").strip() or None,
                        )
                        if refund and refund.get("id"):
                            row.refund_id = str(refund.get("id"))
                            if refund.get("status") in ("succeeded", "pending"):
                                row.status = ReturnRequest.Status.DONE
                except Exception:
                    pass

        row.save(update_fields=["status", "seller_note", "refund_id", "updated_at"])
        try:
            from .notify import notify_shop_users

            label = dict(ReturnRequest.Status.choices).get(row.status, row.status)
            if row.user_id:
                notify_shop_users(
                    [row.user_id],
                    title=f"Возврат по заказу #{row.order_id}",
                    body=f"{row.order_item.name}: {label}",
                    payload={"order_id": row.order_id, "return_id": row.id, "status": row.status},
                )
        except Exception:
            pass
        return Response(
            {
                "id": row.id,
                "status": row.status,
                "seller_note": row.seller_note,
                "refund_id": row.refund_id,
            }
        )

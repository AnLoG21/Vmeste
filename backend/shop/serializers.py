from rest_framework import serializers

from common.media_urls import photo_urls

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


class ProductPhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductPhoto
        fields = ["id", "image", "thumb_url", "sort_order"]

    def _urls(self, obj):
        request = self.context.get("request")
        return photo_urls(request, obj.image)

    def get_image(self, obj):
        return self._urls(obj)["url"]

    def get_thumb_url(self, obj):
        return self._urls(obj)["thumb_url"]


class ProductSubcategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductSubcategory
        fields = ["id", "name", "category", "sort_order"]


class ProductCategorySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()
    products_count = serializers.SerializerMethodField()
    subcategories = ProductSubcategorySerializer(many=True, read_only=True)

    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "name",
            "sort_order",
            "parent",
            "pool_key",
            "children",
            "products_count",
            "subcategories",
            "provider",
        ]
        read_only_fields = ["provider", "pool_key", "children", "products_count", "subcategories"]

    def get_children(self, obj):
        kids = list(obj.children.all())
        return [
            {
                "id": c.id,
                "name": c.name,
                "sort_order": c.sort_order,
                "parent": c.parent_id,
                "pool_key": c.pool_key,
            }
            for c in kids
        ]

    def get_products_count(self, obj):
        return obj.products.count()


class ProductSerializer(serializers.ModelSerializer):
    photos = ProductPhotoSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    subcategory_name = serializers.CharField(source="subcategory.name", read_only=True)
    related_product_ids = serializers.PrimaryKeyRelatedField(
        source="related_products",
        many=True,
        queryset=Product.objects.all(),
        required=False,
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "provider",
            "category",
            "subcategory",
            "category_name",
            "subcategory_name",
            "name",
            "description",
            "sku",
            "unit",
            "price",
            "stock_qty",
            "attrs",
            "sizes",
            "related_product_ids",
            "is_active",
            "is_featured",
            "featured_order",
            "view_count",
            "authenticity_status",
            "authenticity_note",
            "authenticity_requested_at",
            "authenticity_verified_at",
            "bonus_points",
            "weight_grams",
            "length_mm",
            "width_mm",
            "height_mm",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "provider",
            "stock_qty",
            "view_count",
            "authenticity_status",
            "authenticity_requested_at",
            "authenticity_verified_at",
            "created_at",
            "updated_at",
        ]

    def validate_related_product_ids(self, value):
        request = self.context.get("request")
        provider = None
        if request and getattr(request, "user", None):
            from .access import resolve_shop_provider

            provider = resolve_shop_provider(request.user)
        if provider is None and self.instance is not None:
            provider = self.instance.provider
        if provider is None:
            return value
        bad = [p for p in value if p.provider_id != provider.id]
        if bad:
            raise serializers.ValidationError("Связанные товары должны быть из вашего магазина")
        return value

    def update(self, instance, validated_data):
        related = validated_data.pop("related_products", None)
        instance = super().update(instance, validated_data)
        if related is not None:
            instance.related_products.set(related)
        return instance

    def create(self, validated_data):
        related = validated_data.pop("related_products", None)
        instance = super().create(validated_data)
        if related is not None:
            instance.related_products.set(related)
        return instance


class ProductPublicSerializer(serializers.ModelSerializer):
    photos = ProductPhotoSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    related_products = serializers.SerializerMethodField()
    is_original = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            "id",
            "name",
            "description",
            "sku",
            "unit",
            "price",
            "attrs",
            "sizes",
            "related_products",
            "is_featured",
            "featured_order",
            "category",
            "subcategory",
            "category_name",
            "photos",
            "stock_qty",
            "view_count",
            "authenticity_status",
            "is_original",
            "bonus_points",
        ]

    def get_is_original(self, obj):
        return obj.authenticity_status == Product.AuthenticityStatus.VERIFIED

    def get_related_products(self, obj):
        request = self.context.get("request")
        out = []
        for p in obj.related_products.filter(is_active=True)[:12]:
            photos = []
            for ph in p.photos.all()[:1]:
                if not ph.image:
                    continue
                urls = photo_urls(request, ph.image) if request is not None else {}
                photos.append(
                    {
                        "id": ph.id,
                        "image": urls.get("url") or (ph.image.url if ph.image else ""),
                        "thumb_url": urls.get("thumb_url") or urls.get("url") or "",
                    }
                )
            out.append(
                {
                    "id": p.id,
                    "name": p.name,
                    "price": str(p.price),
                    "cover_url": (photos[0].get("thumb_url") or photos[0].get("image")) if photos else "",
                    "photos": photos,
                    "is_original": p.authenticity_status == Product.AuthenticityStatus.VERIFIED,
                }
            )
        return out


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = StockMovement
        fields = [
            "id",
            "product",
            "product_name",
            "kind",
            "qty",
            "reason",
            "booking",
            "shop_order",
            "created_at",
        ]
        read_only_fields = fields


class ServiceMaterialSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.name", read_only=True)
    product_unit = serializers.CharField(source="product.unit", read_only=True)

    class Meta:
        model = ServiceMaterial
        fields = ["id", "service", "product", "product_name", "product_unit", "qty_per_service"]


class ShopSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopSettings
        fields = [
            "enable_pickup",
            "enable_delivery",
            "delivery_info",
            "delivery_fee",
            "delivery_min_order",
            "delivery_zones",
            "delivery_provider",
            "enable_own_courier",
            "enable_yandex_delivery",
            "enable_cdek_delivery",
            "enable_russian_post",
            "enable_dostavista",
            "own_eta_text",
            "yandex_eta_text",
            "cdek_eta_text",
            "russian_post_eta_text",
            "dostavista_eta_text",
            "yandex_delivery_token",
            "cdek_client_id",
            "cdek_client_secret",
            "russian_post_token",
            "russian_post_user_key",
            "dostavista_token",
            "accept_online_payment",
            "bonus_earn_percent",
            "bonus_max_spend_percent",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "yandex_delivery_token": {"write_only": True, "required": False},
            "cdek_client_secret": {"write_only": True, "required": False},
            "russian_post_token": {"write_only": True, "required": False},
            "russian_post_user_key": {"write_only": True, "required": False},
            "dostavista_token": {"write_only": True, "required": False},
        }


class ShopOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopOrderItem
        fields = ["id", "product", "name", "unit_price", "quantity", "selected_size"]


class ShopOrderSerializer(serializers.ModelSerializer):
    items = ShopOrderItemSerializer(many=True, read_only=True)

    class Meta:
        model = ShopOrder
        fields = [
            "id",
            "provider",
            "client",
            "mode",
            "status",
            "chosen_delivery_provider",
            "eta_text",
            "guest_name",
            "guest_phone",
            "guest_email",
            "delivery_address",
            "apartment",
            "entrance",
            "intercom",
            "private_house",
            "delivery_lat",
            "delivery_lon",
            "delivery_fee",
            "items_total",
            "bonus_spent",
            "total",
            "courier_user",
            "courier_lat",
            "courier_lon",
            "courier_updated_at",
            "external_delivery_provider",
            "external_tracking_id",
            "confirmation_url",
            "paid_at",
            "comment",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "provider",
            "client",
            "items_total",
            "bonus_spent",
            "total",
            "confirmation_url",
            "paid_at",
            "created_at",
            "updated_at",
            "external_delivery_provider",
            "external_tracking_id",
        ]

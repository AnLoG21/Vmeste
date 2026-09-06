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
    subcategories = ProductSubcategorySerializer(many=True, read_only=True)

    class Meta:
        model = ProductCategory
        fields = ["id", "name", "sort_order", "subcategories", "provider"]
        read_only_fields = ["provider"]


class ProductSerializer(serializers.ModelSerializer):
    photos = ProductPhotoSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)
    subcategory_name = serializers.CharField(source="subcategory.name", read_only=True)

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
            "is_active",
            "is_featured",
            "featured_order",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["provider", "stock_qty", "created_at", "updated_at"]


class ProductPublicSerializer(serializers.ModelSerializer):
    photos = ProductPhotoSerializer(many=True, read_only=True)
    category_name = serializers.CharField(source="category.name", read_only=True)

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
            "is_featured",
            "featured_order",
            "category",
            "subcategory",
            "category_name",
            "photos",
            "stock_qty",
        ]


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
            "yandex_delivery_token",
            "cdek_client_id",
            "cdek_client_secret",
            "accept_online_payment",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]
        extra_kwargs = {
            "yandex_delivery_token": {"write_only": True, "required": False},
            "cdek_client_secret": {"write_only": True, "required": False},
        }


class ShopOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShopOrderItem
        fields = ["id", "product", "name", "unit_price", "quantity"]


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
            "total",
            "confirmation_url",
            "paid_at",
            "created_at",
            "updated_at",
            "external_delivery_provider",
            "external_tracking_id",
        ]

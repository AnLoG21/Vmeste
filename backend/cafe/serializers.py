from rest_framework import serializers

from .models import (
    CafeFloorPlan,
    CafeMenuCategory,
    CafeMenuItem,
    CafeMenuItemPhoto,
    CafeOrder,
    CafeOrderItem,
    CafeSettings,
    CafeTable,
)


class CafeSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeSettings
        fields = [
            "enable_dine_in",
            "enable_takeaway",
            "enable_delivery",
            "delivery_info",
            "delivery_fee",
            "delivery_min_order",
            "accept_online_payment",
            "accept_cash",
            "accept_card_on_spot",
            "updated_at",
        ]
        read_only_fields = ["updated_at"]


class CafeTableSerializer(serializers.ModelSerializer):
    qr_path = serializers.SerializerMethodField()

    class Meta:
        model = CafeTable
        fields = [
            "id",
            "label",
            "x",
            "y",
            "width",
            "height",
            "rotation",
            "seats",
            "pin_code",
            "public_token",
            "is_active",
            "sort_order",
            "qr_path",
        ]
        read_only_fields = ["public_token", "qr_path"]

    def get_qr_path(self, obj):
        return f"/t/{obj.public_token}"


class CafeFloorPlanSerializer(serializers.ModelSerializer):
    tables = CafeTableSerializer(many=True, read_only=True)

    class Meta:
        model = CafeFloorPlan
        fields = ["id", "name", "width", "height", "tables", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at", "tables"]


class CafeMenuItemPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = CafeMenuItemPhoto
        fields = ["id", "url", "sort_order", "created_at"]
        read_only_fields = ["id", "url", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        return obj.image.url if obj.image else ""


class CafeMenuItemSerializer(serializers.ModelSerializer):
    photos = CafeMenuItemPhotoSerializer(many=True, read_only=True)

    class Meta:
        model = CafeMenuItem
        fields = [
            "id",
            "category",
            "name",
            "description",
            "composition",
            "weight_grams",
            "calories",
            "price",
            "is_new",
            "is_active",
            "sort_order",
            "photos",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "photos"]


class CafeMenuCategorySerializer(serializers.ModelSerializer):
    items = CafeMenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = CafeMenuCategory
        fields = ["id", "name", "sort_order", "is_novelties", "is_active", "items"]


class CafeOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeOrderItem
        fields = ["id", "menu_item", "name", "unit_price", "quantity"]


class CafeOrderSerializer(serializers.ModelSerializer):
    items = CafeOrderItemSerializer(many=True, read_only=True)
    table_label = serializers.CharField(source="table.label", read_only=True, default="")

    class Meta:
        model = CafeOrder
        fields = [
            "id",
            "mode",
            "status",
            "pay_method",
            "guest_name",
            "guest_phone",
            "delivery_address",
            "comment",
            "items_total",
            "delivery_fee",
            "total",
            "confirmation_url",
            "table",
            "table_label",
            "items",
            "created_at",
            "paid_at",
        ]
        read_only_fields = [
            "status",
            "items_total",
            "delivery_fee",
            "total",
            "confirmation_url",
            "created_at",
            "paid_at",
            "items",
            "table_label",
        ]

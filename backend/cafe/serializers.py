from rest_framework import serializers

from common.media_urls import photo_urls

from .models import (
    CafeFloorPlan,
    CafeMenuCategory,
    CafeMenuItem,
    CafeMenuItemPhoto,
    CafeMenuItemRemovableIngredient,
    CafeOrder,
    CafeOrderItem,
    CafeOrderItemRating,
    CafeSettings,
    CafeTable,
)


class CafeSettingsSerializer(serializers.ModelSerializer):
    has_yookassa = serializers.SerializerMethodField()
    has_tbank = serializers.SerializerMethodField()
    has_cloudpayments = serializers.SerializerMethodField()
    has_robokassa = serializers.SerializerMethodField()
    has_payment_keys = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    logo_thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = CafeSettings
        fields = [
            "enable_dine_in",
            "enable_takeaway",
            "enable_delivery",
            "delivery_info",
            "delivery_fee",
            "delivery_min_order",
            "delivery_zones",
            "accept_online_payment",
            "accept_cash",
            "accept_card_on_spot",
            "payout_legal_name",
            "payout_inn",
            "payout_bank_name",
            "payout_bik",
            "payout_account",
            "payout_corr_account",
            "payment_provider",
            "yookassa_shop_id",
            "yookassa_secret_key",
            "tbank_terminal_key",
            "tbank_password",
            "cloudpayments_public_id",
            "cloudpayments_api_secret",
            "robokassa_merchant_login",
            "robokassa_password1",
            "robokassa_password2",
            "logo",
            "logo_url",
            "logo_thumb_url",
            "has_yookassa",
            "has_tbank",
            "has_cloudpayments",
            "has_robokassa",
            "has_payment_keys",
            "updated_at",
        ]
        read_only_fields = [
            "updated_at",
            "has_yookassa",
            "has_tbank",
            "has_cloudpayments",
            "has_robokassa",
            "has_payment_keys",
            "logo_url",
            "logo_thumb_url",
        ]
        extra_kwargs = {
            "yookassa_secret_key": {"write_only": True},
            "tbank_password": {"write_only": True},
            "cloudpayments_api_secret": {"write_only": True},
            "robokassa_password1": {"write_only": True},
            "robokassa_password2": {"write_only": True},
            "logo": {"write_only": True, "required": False},
        }

    def get_has_yookassa(self, obj):
        return obj.has_yookassa()

    def get_has_tbank(self, obj):
        return bool((obj.tbank_terminal_key or "").strip() and (obj.tbank_password or "").strip())

    def get_has_cloudpayments(self, obj):
        return bool((obj.cloudpayments_public_id or "").strip() and (obj.cloudpayments_api_secret or "").strip())

    def get_has_robokassa(self, obj):
        return bool(
            (obj.robokassa_merchant_login or "").strip()
            and (obj.robokassa_password1 or "").strip()
            and (obj.robokassa_password2 or "").strip()
        )

    def get_has_payment_keys(self, obj):
        return obj.has_payment_keys()

    def get_logo_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get("request")
        return photo_urls(request, obj.logo)["url"]

    def get_logo_thumb_url(self, obj):
        if not obj.logo:
            return ""
        request = self.context.get("request")
        return photo_urls(request, obj.logo)["thumb_url"]

    def validate_delivery_zones(self, value):
        from .delivery_zones import normalize_delivery_zones

        return normalize_delivery_zones(value)


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
            "shape",
            "pin_code",
            "public_token",
            "is_active",
            "is_occupied",
            "guest_count",
            "waiter_called_at",
            "sort_order",
            "qr_path",
        ]
        read_only_fields = ["public_token", "qr_path", "waiter_called_at"]

    def get_qr_path(self, obj):
        return f"/t/{obj.public_token}"


class CafeFloorPlanSerializer(serializers.ModelSerializer):
    tables = CafeTableSerializer(many=True, read_only=True)

    class Meta:
        model = CafeFloorPlan
        fields = ["id", "name", "width", "height", "drawings", "tables", "created_at", "updated_at"]
        read_only_fields = ["created_at", "updated_at", "tables"]


class CafeMenuItemPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = CafeMenuItemPhoto
        fields = ["id", "url", "thumb_url", "sort_order", "created_at"]
        read_only_fields = ["id", "url", "thumb_url", "created_at"]

    def _urls(self, obj):
        request = self.context.get("request")
        return photo_urls(request, obj.image)

    def get_url(self, obj):
        return self._urls(obj)["url"]

    def get_thumb_url(self, obj):
        return self._urls(obj)["thumb_url"]


class CafeMenuItemRemovableIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeMenuItemRemovableIngredient
        fields = ["id", "name", "sort_order"]
        read_only_fields = ["id"]


class CafeMenuItemSerializer(serializers.ModelSerializer):
    photos = CafeMenuItemPhotoSerializer(many=True, read_only=True)
    removable_ingredients = CafeMenuItemRemovableIngredientSerializer(many=True, read_only=True)
    rating_avg = serializers.SerializerMethodField()

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
            "is_available",
            "is_active",
            "rating_avg",
            "rating_count",
            "sort_order",
            "photos",
            "removable_ingredients",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at", "photos", "rating_avg", "rating_count", "removable_ingredients"]

    def get_rating_avg(self, obj):
        if not obj.rating_count:
            return None
        return round(obj.rating_sum / obj.rating_count, 1)


class CafeMenuCategorySerializer(serializers.ModelSerializer):
    items = CafeMenuItemSerializer(many=True, read_only=True)

    class Meta:
        model = CafeMenuCategory
        fields = ["id", "name", "sort_order", "is_novelties", "is_active", "items"]


class CafeOrderItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeOrderItem
        fields = ["id", "menu_item", "name", "unit_price", "quantity", "removed_ingredients"]


class CafeOrderItemRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = CafeOrderItemRating
        fields = ["menu_item", "rating"]


class CafeOrderSerializer(serializers.ModelSerializer):
    items = CafeOrderItemSerializer(many=True, read_only=True)
    item_ratings = CafeOrderItemRatingSerializer(many=True, read_only=True)
    table_label = serializers.CharField(source="table.label", read_only=True, default="")
    can_rate = serializers.SerializerMethodField()

    class Meta:
        model = CafeOrder
        fields = [
            "id",
            "mode",
            "status",
            "pay_method",
            "guest_name",
            "guest_phone",
            "guest_email",
            "delivery_address",
            "comment",
            "items_total",
            "tip_percent",
            "tip_amount",
            "tip_custom",
            "include_service_charge",
            "service_charge_amount",
            "provider_payout_amount",
            "delivery_fee",
            "total",
            "confirmation_url",
            "table",
            "table_label",
            "items",
            "item_ratings",
            "can_rate",
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
            "item_ratings",
            "can_rate",
            "table_label",
            "service_charge_amount",
            "provider_payout_amount",
        ]

    def get_can_rate(self, obj):
        return obj.status in {
            CafeOrder.Status.PAID,
            CafeOrder.Status.ACCEPTED,
            CafeOrder.Status.COOKING,
            CafeOrder.Status.READY,
            CafeOrder.Status.DELIVERING,
            CafeOrder.Status.DONE,
        }

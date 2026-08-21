from decimal import Decimal

from rest_framework import serializers

from booking.booking_actions import client_display_name
from common.media_urls import photo_urls

from .models import InspectionItem, InspectionItemMedia, InspectionReport


class InspectionItemMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = InspectionItemMedia
        fields = ["id", "url", "thumb_url", "created_at"]
        read_only_fields = fields

    def _urls(self, obj):
        request = self.context.get("request")
        return photo_urls(request, obj.image)

    def get_url(self, obj):
        return self._urls(obj)["url"]

    def get_thumb_url(self, obj):
        return self._urls(obj)["thumb_url"]


class InspectionItemSerializer(serializers.ModelSerializer):
    photos = InspectionItemMediaSerializer(many=True, read_only=True)
    line_total = serializers.SerializerMethodField()
    selectable = serializers.SerializerMethodField()

    class Meta:
        model = InspectionItem
        fields = [
            "id",
            "title",
            "description",
            "severity",
            "parts_price",
            "labor_price",
            "client_selected",
            "sort_order",
            "line_total",
            "selectable",
            "photos",
        ]
        read_only_fields = ["client_selected", "photos", "line_total", "selectable"]

    def get_line_total(self, obj):
        return str(Decimal(obj.line_total).quantize(Decimal("0.01")))

    def get_selectable(self, obj):
        return obj.is_selectable()


class InspectionReportSerializer(serializers.ModelSerializer):
    items = InspectionItemSerializer(many=True, read_only=True)
    client_display_name = serializers.SerializerMethodField()
    organization_name = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()
    share_token = serializers.UUIDField(read_only=True)
    booking_summary = serializers.SerializerMethodField()

    class Meta:
        model = InspectionReport
        fields = [
            "id",
            "provider",
            "client",
            "booking",
            "booking_summary",
            "created_by",
            "vehicle_title",
            "vehicle_plate",
            "vehicle_vin",
            "notes",
            "status",
            "repair_status",
            "share_token",
            "public_url",
            "parts_total",
            "labor_total",
            "grand_total",
            "sent_at",
            "approved_at",
            "repair_status_updated_at",
            "created_at",
            "updated_at",
            "client_display_name",
            "organization_name",
            "items",
        ]
        read_only_fields = [
            "provider",
            "created_by",
            "status",
            "repair_status",
            "share_token",
            "public_url",
            "parts_total",
            "labor_total",
            "grand_total",
            "sent_at",
            "approved_at",
            "repair_status_updated_at",
            "created_at",
            "updated_at",
            "client_display_name",
            "organization_name",
            "booking_summary",
            "items",
        ]

    def get_client_display_name(self, obj):
        return client_display_name(obj.client)

    def get_organization_name(self, obj):
        prov = obj.provider
        name = (getattr(prov, "organization_name", None) or "").strip()
        return name or (prov.username if prov else "")

    def get_public_url(self, obj):
        from .services import public_url_for

        return public_url_for(obj)

    def get_booking_summary(self, obj):
        booking = getattr(obj, "booking", None)
        if not booking:
            return None
        slot = getattr(booking, "slot", None)
        starts = getattr(slot, "starts_at", None)
        return {
            "id": booking.id,
            "service_name": getattr(getattr(booking, "service", None), "name", None) or "",
            "status": booking.status,
            "starts_at": starts.isoformat() if starts else None,
        }


class InspectionReportCreateSerializer(serializers.Serializer):
    client = serializers.IntegerField()
    booking = serializers.IntegerField(required=False, allow_null=True)
    vehicle_title = serializers.CharField(required=False, allow_blank=True, max_length=200)
    vehicle_plate = serializers.CharField(required=False, allow_blank=True, max_length=32)
    vehicle_vin = serializers.CharField(required=False, allow_blank=True, max_length=64)
    notes = serializers.CharField(required=False, allow_blank=True)


class InspectionItemWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = InspectionItem
        fields = [
            "title",
            "description",
            "severity",
            "parts_price",
            "labor_price",
            "sort_order",
        ]

    def validate_severity(self, value):
        if value not in {c[0] for c in InspectionItem.Severity.choices}:
            raise serializers.ValidationError("Некорректный статус пункта.")
        return value

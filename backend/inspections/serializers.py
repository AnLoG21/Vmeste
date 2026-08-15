from decimal import Decimal

from rest_framework import serializers

from booking.booking_actions import client_display_name

from .models import InspectionItem, InspectionItemMedia, InspectionReport


class InspectionItemMediaSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = InspectionItemMedia
        fields = ["id", "url", "created_at"]
        read_only_fields = fields

    def get_url(self, obj):
        if not obj.image:
            return ""
        request = self.context.get("request")
        url = obj.image.url
        if request:
            return request.build_absolute_uri(url)
        return url


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

    class Meta:
        model = InspectionReport
        fields = [
            "id",
            "provider",
            "client",
            "booking",
            "created_by",
            "vehicle_title",
            "vehicle_plate",
            "vehicle_vin",
            "notes",
            "status",
            "share_token",
            "public_url",
            "parts_total",
            "labor_total",
            "grand_total",
            "sent_at",
            "approved_at",
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
            "share_token",
            "public_url",
            "parts_total",
            "labor_total",
            "grand_total",
            "sent_at",
            "approved_at",
            "created_at",
            "updated_at",
            "client_display_name",
            "organization_name",
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

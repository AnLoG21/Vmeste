from django.contrib.auth import get_user_model
from rest_framework import serializers

from catalog.models import Service, ServiceCategory

from .booking_actions import client_display_name
from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


class ProviderStaffSerializer(serializers.ModelSerializer):
    staff_username = serializers.CharField(source="staff.username", read_only=True)
    staff_email = serializers.EmailField(source="staff.email", read_only=True)
    staff_user = serializers.SerializerMethodField(read_only=True)
    provider_user = serializers.SerializerMethodField(read_only=True)
    assigned_service_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )
    assigned_category_ids = serializers.ListField(
        child=serializers.IntegerField(), required=False, allow_empty=True
    )

    class Meta:
        model = ProviderStaff
        fields = [
            "id",
            "provider",
            "staff",
            "staff_username",
            "staff_email",
            "display_name",
            "job_title",
            "is_active",
            "invitation_status",
            "permissions",
            "assigned_service_ids",
            "assigned_category_ids",
            "staff_user",
            "provider_user",
        ]
        read_only_fields = [
            "provider",
            "staff_username",
            "staff_email",
            "staff_user",
            "provider_user",
            "invitation_status",
        ]

    def get_provider_user(self, obj):
        p = obj.provider
        return {
            "id": p.id,
            "username": p.username,
            "first_name": p.first_name or "",
            "last_name": p.last_name or "",
            "organization_name": getattr(p, "organization_name", "") or "",
        }

    def get_staff_user(self, obj):
        return {
            "id": obj.staff_id,
            "username": obj.staff.username,
            "email": obj.staff.email,
            "first_name": obj.staff.first_name,
            "last_name": obj.staff.last_name,
            "patronymic": getattr(obj.staff, "patronymic", "") or "",
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["assigned_service_ids"] = list(instance.assigned_services.values_list("id", flat=True))
        data["assigned_category_ids"] = list(instance.assigned_categories.values_list("id", flat=True))
        return data

    def update(self, instance, validated_data):
        svc_ids = validated_data.pop("assigned_service_ids", None)
        cat_ids = validated_data.pop("assigned_category_ids", None)
        instance = super().update(instance, validated_data)
        provider_id = instance.provider_id
        if svc_ids is not None:
            instance.assigned_services.set(
                Service.objects.filter(provider_id=provider_id, pk__in=svc_ids)
            )
        if cat_ids is not None:
            instance.assigned_categories.set(
                ServiceCategory.objects.filter(provider_id=provider_id, pk__in=cat_ids)
            )
        return instance


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    booking_client_name = serializers.SerializerMethodField()
    booking_service_name = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = [
            "id",
            "provider",
            "staff",
            "starts_at",
            "ends_at",
            "is_booked",
            "recurrence_group",
            "booking_client_name",
            "booking_service_name",
        ]
        read_only_fields = ["provider", "is_booked", "booking_client_name", "booking_service_name"]

    def get_booking_client_name(self, obj):
        if not obj.is_booked:
            return ""
        try:
            booking = obj.booking
        except Booking.DoesNotExist:
            return ""
        return client_display_name(getattr(booking, "client", None))

    def get_booking_service_name(self, obj):
        if not obj.is_booked:
            return ""
        try:
            booking = obj.booking
        except Booking.DoesNotExist:
            return ""
        return (booking.service.name or "").strip()


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    client_username = serializers.CharField(source="client.username", read_only=True)
    client_display_name = serializers.SerializerMethodField()
    staff_display_name = serializers.SerializerMethodField()
    slot_starts_at = serializers.DateTimeField(source="slot.starts_at", read_only=True)
    slot_ends_at = serializers.DateTimeField(source="slot.ends_at", read_only=True)

    class Meta:
        model = Booking
        fields = [
            "id",
            "client",
            "provider",
            "service",
            "slot",
            "staff",
            "status",
            "comment",
            "created_at",
            "service_name",
            "client_username",
            "client_display_name",
            "staff_display_name",
            "slot_starts_at",
            "slot_ends_at",
        ]
        read_only_fields = [
            "client",
            "created_at",
            "service_name",
            "client_username",
            "client_display_name",
            "staff_display_name",
            "slot_starts_at",
            "slot_ends_at",
        ]

    def get_client_display_name(self, obj):
        from .booking_actions import client_display_name

        return client_display_name(getattr(obj, "client", None))

    def get_staff_display_name(self, obj):
        u = getattr(obj, "staff", None)
        if not u:
            return ""
        fn = (u.first_name or "").strip()
        ln = (u.last_name or "").strip()
        if fn and ln:
            return f"{fn} {ln[0].upper()}."
        return fn or ln or (u.username or "")

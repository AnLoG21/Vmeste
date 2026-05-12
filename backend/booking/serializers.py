from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


class ProviderStaffSerializer(serializers.ModelSerializer):
    staff_username = serializers.CharField(source="staff.username", read_only=True)
    staff_email = serializers.EmailField(source="staff.email", read_only=True)
    staff_user = serializers.SerializerMethodField(read_only=True)
    provider_user = serializers.SerializerMethodField(read_only=True)

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


class AvailabilitySlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = "__all__"
        read_only_fields = ["provider", "is_booked"]


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    client_username = serializers.CharField(source="client.username", read_only=True)
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
            "slot_starts_at",
            "slot_ends_at",
        ]
        read_only_fields = ["client", "created_at", "service_name", "client_username", "slot_starts_at", "slot_ends_at"]

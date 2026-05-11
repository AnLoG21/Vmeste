from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


class ProviderStaffSerializer(serializers.ModelSerializer):
    staff_username = serializers.CharField(source="staff.username", read_only=True)
    staff_email = serializers.EmailField(source="staff.email", read_only=True)
    staff_user = serializers.SerializerMethodField(read_only=True)

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
            "permissions",
            "staff_user",
        ]
        read_only_fields = ["provider", "staff_username", "staff_email", "staff_user"]

    def get_staff_user(self, obj):
        return {
            "id": obj.staff_id,
            "username": obj.staff.username,
            "email": obj.staff.email,
            "first_name": obj.staff.first_name,
            "last_name": obj.staff.last_name,
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

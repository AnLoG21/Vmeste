"""Waitlist API for salon / service bookings."""

from __future__ import annotations

from rest_framework import permissions, status, viewsets
from rest_framework.response import Response
from rest_framework import serializers

from .models import WaitlistEntry


class WaitlistEntrySerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    organization_name = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = WaitlistEntry
        fields = [
            "id",
            "provider",
            "client",
            "service",
            "service_name",
            "staff",
            "preferred_date",
            "comment",
            "status",
            "created_at",
            "notified_at",
            "organization_name",
            "client_name",
        ]
        read_only_fields = ["id", "client", "status", "created_at", "notified_at", "provider"]

    def get_organization_name(self, obj):
        return (getattr(obj.provider, "organization_name", None) or obj.provider.username or "").strip()

    def get_client_name(self, obj):
        parts = [obj.client.first_name or "", obj.client.last_name or ""]
        name = " ".join(p for p in parts if p).strip()
        return name or obj.client.username


class WaitlistViewSet(viewsets.ModelViewSet):
    serializer_class = WaitlistEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = WaitlistEntry.objects.select_related("provider", "client", "service").exclude(
            status=WaitlistEntry.Status.CANCELLED
        )
        if user.role == "client":
            return qs.filter(client=user)
        if user.role == "provider":
            return qs.filter(provider=user)
        # staff — org employer
        employer_id = getattr(user, "employer_id", None) or getattr(
            getattr(user, "staff_link", None), "provider_id", None
        )
        if employer_id:
            return qs.filter(provider_id=employer_id)
        from booking.models import ProviderStaff

        link = ProviderStaff.objects.filter(
            staff=user,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).first()
        if link:
            return qs.filter(provider_id=link.provider_id)
        return WaitlistEntry.objects.none()

    def create(self, request, *args, **kwargs):
        if request.user.role != "client":
            return Response({"detail": "В лист ожидания встаёт клиент."}, status=status.HTTP_403_FORBIDDEN)
        service_id = request.data.get("service_id") or request.data.get("service")
        provider_id = request.data.get("provider_id") or request.data.get("provider")
        if not service_id or not provider_id:
            return Response({"detail": "Нужны provider и service."}, status=status.HTTP_400_BAD_REQUEST)
        from catalog.models import Service

        service = Service.objects.filter(pk=service_id, provider_id=provider_id).first()
        if not service:
            return Response({"detail": "Услуга не найдена."}, status=status.HTTP_404_NOT_FOUND)
        existing = WaitlistEntry.objects.filter(
            provider_id=provider_id,
            client=request.user,
            service_id=service_id,
            status=WaitlistEntry.Status.WAITING,
        ).first()
        if existing:
            return Response(WaitlistEntrySerializer(existing).data)
        raw_staff = request.data.get("staff_id") or request.data.get("staff")
        try:
            staff_id = int(raw_staff) if raw_staff not in (None, "") else None
        except (TypeError, ValueError):
            staff_id = None
        preferred = request.data.get("preferred_date") or None
        if preferred == "":
            preferred = None
        entry = WaitlistEntry.objects.create(
            provider_id=provider_id,
            client=request.user,
            service=service,
            staff_id=staff_id,
            preferred_date=preferred,
            comment=(request.data.get("comment") or "")[:250],
        )
        return Response(WaitlistEntrySerializer(entry).data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, *args, **kwargs):
        entry = self.get_object()
        new_status = (request.data.get("status") or "").strip()
        if new_status == WaitlistEntry.Status.CANCELLED:
            if request.user.role == "client" and entry.client_id != request.user.id:
                return Response(status=status.HTTP_403_FORBIDDEN)
            entry.status = WaitlistEntry.Status.CANCELLED
            entry.save(update_fields=["status"])
            return Response(WaitlistEntrySerializer(entry).data)
        return Response({"detail": "Можно только отменить."}, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, *args, **kwargs):
        entry = self.get_object()
        if request.user.role == "client" and entry.client_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        entry.status = WaitlistEntry.Status.CANCELLED
        entry.save(update_fields=["status"])
        return Response(status=status.HTTP_204_NO_CONTENT)

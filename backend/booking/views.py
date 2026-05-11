from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from catalog.models import Service

from .models import AvailabilitySlot, Booking, ProviderStaff
from .serializers import AvailabilitySlotSerializer, BookingSerializer, ProviderStaffSerializer

User = get_user_model()


class ProviderStaffViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderStaffSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return ProviderStaff.objects.filter(provider=user).select_related("staff", "provider")
        return ProviderStaff.objects.filter(staff=user).select_related("staff", "provider")

    def create(self, request, *args, **kwargs):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        email = (request.data.get("invite_email") or "").strip()
        username = (request.data.get("invite_username") or "").strip()
        display_name = (request.data.get("display_name") or "").strip()
        if not email and not username:
            return Response(
                {"detail": "Укажи email или логин сотрудника."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        q = Q()
        if email:
            q |= Q(email__iexact=email)
        if username:
            q |= Q(username__iexact=username)
        staff_user = User.objects.filter(q).first()
        if not staff_user:
            return Response(
                {"detail": "Пользователь с таким email или логином не найден."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if staff_user.role not in ("staff", "client"):
            staff_user.role = "staff"
            staff_user.save(update_fields=["role"])
        if ProviderStaff.objects.filter(provider=request.user, staff=staff_user).exists():
            return Response({"detail": "Этот сотрудник уже привязан."}, status=status.HTTP_400_BAD_REQUEST)
        link = ProviderStaff.objects.create(
            provider=request.user,
            staff=staff_user,
            display_name=display_name,
        )
        ser = self.get_serializer(link)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AvailabilitySlot.objects.all().select_related("provider", "staff")
        provider = self.request.query_params.get("provider")
        if provider:
            qs = qs.filter(provider_id=provider)
        if self.request.user.role == "provider":
            qs = qs.filter(provider=self.request.user)
        elif self.request.user.role == "staff":
            qs = qs.filter(
                Q(provider=self.request.user) | Q(provider__staff_links__staff=self.request.user)
            ).distinct()
        return qs

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user)

    @action(detail=False, methods=["delete"], url_path="delete-series")
    def delete_series(self, request):
        group = (request.query_params.get("recurrence_group") or "").strip()
        if not group:
            return Response({"detail": "recurrence_group required"}, status=status.HTTP_400_BAD_REQUEST)
        qs = AvailabilitySlot.objects.filter(provider=request.user, recurrence_group=group, is_booked=False)
        n = qs.count()
        qs.delete()
        return Response({"deleted": n})


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return Booking.objects.filter(provider=user).select_related("client", "provider", "service", "slot")
        if user.role == "staff":
            return (
                Booking.objects.filter(Q(provider=user) | Q(provider__staff_links__staff=user))
                .select_related("client", "provider", "service", "slot")
                .distinct()
            )
        return Booking.objects.filter(client=user).select_related("client", "provider", "service", "slot")

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role != "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        slot_id = request.data.get("slot")
        service_id = request.data.get("service")
        provider_id = request.data.get("provider")
        try:
            slot = AvailabilitySlot.objects.select_for_update().get(pk=slot_id)
        except AvailabilitySlot.DoesNotExist:
            return Response({"detail": "Слот не найден."}, status=status.HTTP_400_BAD_REQUEST)
        if slot.is_booked:
            return Response({"detail": "Слот уже занят."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            service = Service.objects.get(pk=service_id)
        except Service.DoesNotExist:
            return Response({"detail": "Услуга не найдена."}, status=status.HTTP_400_BAD_REQUEST)
        if str(service.provider_id) != str(provider_id):
            return Response({"detail": "Услуга не принадлежит исполнителю."}, status=status.HTTP_400_BAD_REQUEST)
        if str(slot.provider_id) != str(provider_id):
            return Response({"detail": "Слот не принадлежит исполнителю."}, status=status.HTTP_400_BAD_REQUEST)
        slot.is_booked = True
        slot.save(update_fields=["is_booked"])
        booking = Booking.objects.create(
            client=request.user,
            provider_id=provider_id,
            service=service,
            slot=slot,
            comment=(request.data.get("comment") or "")[:250],
        )
        ser = self.get_serializer(booking)
        return Response(ser.data, status=status.HTTP_201_CREATED)

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch, Q

from reviews.models import Review
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from catalog.models import Service
from notifications.models import InAppNotification

from .booking_windows import book_time_window, list_available_windows
from .models import AvailabilitySlot, Booking, ProviderStaff
from .serializers import AvailabilitySlotSerializer, BookingSerializer, ProviderStaffSerializer

User = get_user_model()


def _staff_display_name(u: User) -> str:
    parts = [p for p in (u.first_name, u.last_name) if p]
    return " ".join(parts).strip() or u.username


class ProviderStaffViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderStaffSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return ProviderStaff.objects.filter(provider=user).select_related("staff", "provider")
        return ProviderStaff.objects.filter(staff=user).select_related("staff", "provider")

    @action(detail=True, methods=["post"], url_path="accept-invite")
    def accept_invite(self, request, pk=None):
        link = self.get_object()
        if link.staff_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if link.invitation_status != ProviderStaff.InvitationStatus.PENDING:
            return Response({"detail": "Нет ожидающего приглашения."}, status=status.HTTP_400_BAD_REQUEST)
        staff_user = link.staff
        if staff_user.role == User.Role.CLIENT:
            staff_user.role = User.Role.STAFF
            staff_user.save(update_fields=["role"])
        link.invitation_status = ProviderStaff.InvitationStatus.ACCEPTED
        link.is_active = True
        link.save(update_fields=["invitation_status", "is_active"])
        InAppNotification.objects.create(
            user=link.provider,
            kind=InAppNotification.Kind.STAFF_INVITE_ACCEPTED,
            payload={
                "staff_link_id": link.id,
                "staff_name": _staff_display_name(staff_user),
                "organization_name": getattr(link.provider, "organization_name", "") or "",
            },
        )
        ser = self.get_serializer(link)
        return Response(ser.data)

    @action(detail=True, methods=["post"], url_path="reject-invite")
    def reject_invite(self, request, pk=None):
        link = self.get_object()
        if link.staff_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if link.invitation_status != ProviderStaff.InvitationStatus.PENDING:
            return Response({"detail": "Нет ожидающего приглашения."}, status=status.HTTP_400_BAD_REQUEST)
        link.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        identifier = (request.data.get("invite_identifier") or "").strip()
        if identifier:
            if "@" in identifier:
                email, username = identifier, ""
            else:
                email, username = "", identifier
        else:
            email = (request.data.get("invite_email") or "").strip()
            username = (request.data.get("invite_username") or "").strip()
        display_name = (request.data.get("display_name") or "").strip() or ""
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
        if staff_user.role not in (User.Role.STAFF, User.Role.CLIENT):
            return Response(
                {"detail": "Можно приглашать только пользователей с ролью «клиент» или «сотрудник»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        existing = ProviderStaff.objects.filter(provider=request.user, staff=staff_user).first()
        if existing:
            if existing.invitation_status == ProviderStaff.InvitationStatus.PENDING:
                return Response({"detail": "Приглашение уже отправлено."}, status=status.HTTP_400_BAD_REQUEST)
            if (
                existing.invitation_status == ProviderStaff.InvitationStatus.ACCEPTED
                and existing.is_active
            ):
                return Response({"detail": "Этот сотрудник уже привязан."}, status=status.HTTP_400_BAD_REQUEST)
            if (
                existing.invitation_status == ProviderStaff.InvitationStatus.ACCEPTED
                and not existing.is_active
            ):
                existing.invitation_status = ProviderStaff.InvitationStatus.PENDING
                existing.is_active = False
                existing.save(update_fields=["invitation_status", "is_active"])
                ser = self.get_serializer(existing)
                return Response(ser.data, status=status.HTTP_200_OK)
        link = ProviderStaff.objects.create(
            provider=request.user,
            staff=staff_user,
            display_name=display_name,
            invitation_status=ProviderStaff.InvitationStatus.PENDING,
            is_active=False,
        )
        ser = self.get_serializer(link)
        return Response(ser.data, status=status.HTTP_201_CREATED)


class AvailabilitySlotViewSet(viewsets.ModelViewSet):
    serializer_class = AvailabilitySlotSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = AvailabilitySlot.objects.all().select_related(
            "provider", "staff", "booking__client", "booking__service"
        )
        provider = self.request.query_params.get("provider")
        if self.request.user.role == "client":
            if not provider:
                return AvailabilitySlot.objects.none()
            qs = qs.filter(provider_id=provider, is_booked=False)
            return qs
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

    @action(detail=False, methods=["get"], url_path="available-windows")
    def available_windows(self, request):
        if request.user.role != "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = (request.query_params.get("provider") or "").strip()
        service = (request.query_params.get("service") or "").strip()
        book_date_raw = (request.query_params.get("date") or "").strip()
        if not provider or not service or not book_date_raw:
            return Response(
                {"detail": "Укажите provider, service и date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        book_date = parse_date(book_date_raw)
        if not book_date:
            return Response({"detail": "Некорректная дата."}, status=status.HTTP_400_BAD_REQUEST)
        data = list_available_windows(int(provider), int(service), book_date)
        return Response(data)

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

    def _booking_for_actor(self, booking):
        user = self.request.user
        if user.role == "client" and booking.client_id == user.id:
            return True
        if user.role == "provider" and booking.provider_id == user.id:
            return True
        if user.role == "staff":
            return ProviderStaff.objects.filter(
                provider_id=booking.provider_id,
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            ).exists()
        return False

    def _staff_has_booking_perm(self, booking):
        user = self.request.user
        if user.role == "provider":
            return True
        if user.role != "staff":
            return False
        link = ProviderStaff.objects.filter(
            provider_id=booking.provider_id,
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        ).first()
        if not link:
            return False
        perms = link.permissions or {}
        return bool(perms.get("manage_bookings", True))

    def _booking_queryset(self, qs):
        review_prefetch = Prefetch(
            "reviews",
            queryset=Review.objects.select_related("reply").prefetch_related("photos").order_by("-created_at"),
        )
        return qs.select_related("client", "provider", "service", "slot", "staff").prefetch_related(
            review_prefetch
        )

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return self._booking_queryset(Booking.objects.filter(provider=user))
        if user.role == "staff":
            provider_ids = ProviderStaff.objects.filter(
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            ).values_list("provider_id", flat=True)
            return self._booking_queryset(Booking.objects.filter(provider_id__in=provider_ids))
        return self._booking_queryset(Booking.objects.filter(client=user))

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if request.user.role != "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        service_id = request.data.get("service")
        provider_id = request.data.get("provider")
        slot_id = request.data.get("slot")
        starts_raw = request.data.get("starts_at")
        ends_raw = request.data.get("ends_at")
        staff_id = request.data.get("staff")
        comment = (request.data.get("comment") or "")[:250]

        if starts_raw and ends_raw:
            starts_at = parse_datetime(str(starts_raw))
            ends_at = parse_datetime(str(ends_raw))
            if not starts_at or not ends_at or ends_at <= starts_at:
                return Response({"detail": "Некорректное время."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                booking = book_time_window(
                    int(provider_id),
                    int(service_id),
                    starts_at,
                    ends_at,
                    int(staff_id) if staff_id not in (None, "", "null") else None,
                    request.user,
                    comment,
                )
            except Service.DoesNotExist:
                return Response({"detail": "Услуга не найдена."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            ser = self.get_serializer(booking)
            return Response(ser.data, status=status.HTTP_201_CREATED)

        if not slot_id:
            return Response({"detail": "Укажите слот или время."}, status=status.HTTP_400_BAD_REQUEST)
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
            staff_id=int(staff_id) if staff_id not in (None, "", "null") else slot.staff_id,
            comment=comment,
        )
        try:
            from .booking_actions import notify_new_booking

            notify_new_booking(booking)
        except Exception:
            pass
        ser = self.get_serializer(booking)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        from .booking_actions import confirm_booking

        booking = self.get_object()
        if not self._booking_for_actor(booking) or not self._staff_has_booking_perm(booking):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if request.user.role == "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        ok, err = confirm_booking(booking, request.user)
        if not ok:
            return Response({"code": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="cancel-by-org")
    def cancel_by_org(self, request, pk=None):
        from .booking_actions import cancel_booking_by_org

        booking = self.get_object()
        if not self._booking_for_actor(booking) or not self._staff_has_booking_perm(booking):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if request.user.role == "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        ok, err = cancel_booking_by_org(booking, request.user)
        if not ok:
            return Response({"code": err}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="cancel-by-client")
    def cancel_by_client(self, request, pk=None):
        from .booking_actions import cancel_booking_by_client

        booking = self.get_object()
        if request.user.role != "client" or booking.client_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ok, _ = cancel_booking_by_client(booking)
        return Response(self.get_serializer(booking).data)

    @action(detail=True, methods=["post"], url_path="mark-done")
    def mark_done(self, request, pk=None):
        from .booking_actions import mark_booking_done

        booking = self.get_object()
        if not self._booking_for_actor(booking) or not self._staff_has_booking_perm(booking):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if request.user.role == "client":
            return Response(status=status.HTTP_403_FORBIDDEN)
        ok, err = mark_booking_done(booking, request.user)
        if not ok:
            payload = {"code": err}
            if err == "booking_not_started_yet":
                from .booking_actions import format_booking_when

                when = format_booking_when(booking)
                payload["detail"] = (
                    f"Отметить «услуга оказана» можно не раньше начала записи"
                    + (f" ({when})" if when else "")
                    + "."
                )
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(booking).data)

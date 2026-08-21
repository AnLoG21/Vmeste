from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch, Q

from reviews.models import Review
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView
from rest_framework.response import Response

from catalog.models import Service
from notifications.models import InAppNotification

from .booking_windows import (
    book_time_window,
    list_available_dates,
    list_available_windows,
    manual_hold_window,
    release_manual_hold,
    resolve_selected_options,
)
from .models import AvailabilitySlot, Booking, ProviderStaff, ProviderStaffPortfolioPhoto
from .serializers import AvailabilitySlotSerializer, BookingSerializer, ProviderStaffSerializer

User = get_user_model()


def _acts_as_client(user) -> bool:
    return getattr(user, "role", None) in ("client", "provider")


def _staff_display_name(u: User) -> str:
    parts = [p for p in (u.first_name, u.last_name) if p]
    return " ".join(parts).strip() or u.username


class ProviderStaffViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderStaffSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        provider_id = (self.request.query_params.get("provider") or "").strip()
        if provider_id:
            return (
                ProviderStaff.objects.filter(
                    provider_id=provider_id,
                    is_active=True,
                    invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
                )
                .select_related("staff", "provider")
                .prefetch_related("portfolio_photos")
            )

        user = self.request.user
        if user.role == "provider":
            return (
                ProviderStaff.objects.filter(provider=user)
                .select_related("staff", "provider")
                .prefetch_related("portfolio_photos")
            )
        return (
            ProviderStaff.objects.filter(staff=user)
            .select_related("staff", "provider")
            .prefetch_related("portfolio_photos")
        )

    def _can_edit_staff_card(self, link) -> bool:
        user = self.request.user
        if user.role == "provider" and link.provider_id == user.id:
            return True
        if user.role == "staff" and link.staff_id == user.id:
            return True
        return False

    def partial_update(self, request, *args, **kwargs):
        link = self.get_object()
        user = request.user
        if user.role == "staff":
            if link.staff_id != user.id:
                return Response(status=status.HTTP_403_FORBIDDEN)
            # Сотрудник может править только свою краткую информацию
            allowed = {}
            if "bio" in request.data:
                allowed["bio"] = request.data.get("bio")
            if not allowed:
                return Response(
                    {"detail": "Можно изменить только краткую информацию о себе."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ser = self.get_serializer(link, data=allowed, partial=True)
            ser.is_valid(raise_exception=True)
            ser.save()
            return Response(ser.data)
        if user.role != "provider" or link.provider_id != user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="card")
    def upload_card(self, request, pk=None):
        """Загрузка аватарки/портфолио и bio — сотрудник в личном кабинете или провайдер."""
        link = self.get_object()
        if not self._can_edit_staff_card(link):
            return Response(status=status.HTTP_403_FORBIDDEN)

        bio = request.data.get("bio", None)
        if bio is not None:
            link.bio = str(bio).strip()

        avatar_file = request.FILES.get("avatar", None)
        if avatar_file:
            link.avatar_image = avatar_file

        if bio is not None or avatar_file:
            update_fields = []
            if bio is not None:
                update_fields.append("bio")
            if avatar_file:
                update_fields.append("avatar_image")
            if update_fields:
                link.save(update_fields=update_fields)

        portfolio_files = request.FILES.getlist("portfolio_photos")
        created = 0
        for f in portfolio_files:
            ProviderStaffPortfolioPhoto.objects.create(staff_link=link, image=f)
            created += 1

        ser = self.get_serializer(link)
        return Response({"staff": ser.data, "created": created}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path=r"portfolio/(?P<photo_id>[^/.]+)")
    def delete_portfolio_photo(self, request, pk=None, photo_id=None):
        link = self.get_object()
        if not self._can_edit_staff_card(link):
            return Response(status=status.HTTP_403_FORBIDDEN)
        photo = link.portfolio_photos.filter(pk=photo_id).first()
        if not photo:
            return Response({"detail": "Фото не найдено."}, status=status.HTTP_404_NOT_FOUND)
        photo.delete()
        ser = self.get_serializer(link)
        return Response(ser.data)

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
        from subscriptions.access import provider_can_manage_staff

        if not provider_can_manage_staff(request.user):
            return Response(
                {
                    "detail": "Добавление сотрудников доступно на тарифе «Бизнес». Записи остаются бесплатными."
                },
                status=status.HTTP_403_FORBIDDEN,
            )
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
        if not _acts_as_client(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = (request.query_params.get("provider") or "").strip()
        service = (request.query_params.get("service") or "").strip()
        book_date_raw = (request.query_params.get("date") or "").strip()
        extra_raw = (request.query_params.get("extra_minutes") or "0").strip()
        try:
            extra_minutes = max(0, int(extra_raw or 0))
        except ValueError:
            extra_minutes = 0
        if not provider or not service or not book_date_raw:
            return Response(
                {"detail": "Укажите provider, service и date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        book_date = parse_date(book_date_raw)
        if not book_date:
            return Response({"detail": "Некорректная дата."}, status=status.HTTP_400_BAD_REQUEST)
        staff_raw = (request.query_params.get("staff") or "").strip()
        staff_id = None
        if staff_raw and staff_raw not in ("any", "null", "none", ""):
            try:
                staff_id = int(staff_raw)
            except ValueError:
                staff_id = None
        data = list_available_windows(
            int(provider), int(service), book_date, extra_minutes=extra_minutes, staff_id=staff_id
        )
        return Response(data)

    @action(detail=False, methods=["get"], url_path="available-dates")
    def available_dates(self, request):
        if not _acts_as_client(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = (request.query_params.get("provider") or "").strip()
        service = (request.query_params.get("service") or "").strip()
        date_from_raw = (request.query_params.get("from") or "").strip()
        date_to_raw = (request.query_params.get("to") or "").strip()
        extra_raw = (request.query_params.get("extra_minutes") or "0").strip()
        try:
            extra_minutes = max(0, int(extra_raw or 0))
        except ValueError:
            extra_minutes = 0
        if not provider or not service:
            return Response(
                {"detail": "Укажите provider и service."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.localdate()
        date_from = parse_date(date_from_raw) or today
        date_to = parse_date(date_to_raw) or (today + timedelta(days=60))
        staff_raw = (request.query_params.get("staff") or "").strip()
        staff_id = None
        if staff_raw and staff_raw not in ("any", "null", "none", ""):
            try:
                staff_id = int(staff_raw)
            except ValueError:
                staff_id = None
        dates = list_available_dates(
            int(provider),
            int(service),
            date_from,
            date_to,
            extra_minutes=extra_minutes,
            staff_id=staff_id,
        )
        return Response({"dates": dates})

    @action(detail=False, methods=["post"], url_path="manual-hold")
    def manual_hold(self, request):
        """Организация бронирует кусок свободного интервала (с опциональным ФИО)."""
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        starts_raw = request.data.get("starts_at")
        ends_raw = request.data.get("ends_at")
        guest_name = (request.data.get("guest_name") or request.data.get("hold_label") or "")[:120]
        if not starts_raw or not ends_raw:
            return Response(
                {"detail": "Укажите starts_at и ends_at."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        starts_at = parse_datetime(str(starts_raw))
        ends_at = parse_datetime(str(ends_raw))
        if not starts_at or not ends_at:
            return Response({"detail": "Некорректное время."}, status=status.HTTP_400_BAD_REQUEST)
        if timezone.is_naive(starts_at):
            starts_at = timezone.make_aware(starts_at, timezone.get_current_timezone())
        if timezone.is_naive(ends_at):
            ends_at = timezone.make_aware(ends_at, timezone.get_current_timezone())
        try:
            held = manual_hold_window(request.user.id, starts_at, ends_at, guest_name)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(
            AvailabilitySlotSerializer(held, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="release-hold")
    def release_hold(self, request, pk=None):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        slot = self.get_object()
        if slot.provider_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            released = release_manual_hold(slot)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if released is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        return Response(AvailabilitySlotSerializer(released, context={"request": request}).data)

    @action(detail=False, methods=["delete"], url_path="delete-series")
    def delete_series(self, request):
        group = (request.query_params.get("recurrence_group") or "").strip()
        if not group:
            return Response({"detail": "recurrence_group required"}, status=status.HTTP_400_BAD_REQUEST)
        qs = AvailabilitySlot.objects.filter(provider=self.request.user, recurrence_group=group, is_booked=False)
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
            review_prefetch, "provider__gallery_photos", "inspection_reports"
        )

    def get_queryset(self):
        from .acquiring import expire_unpaid_bookings

        expire_unpaid_bookings()
        user = self.request.user
        as_client = (self.request.query_params.get("as_client") or "").strip() in ("1", "true", "yes")
        if user.role == "provider" and as_client:
            return self._booking_queryset(Booking.objects.filter(client=user))
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

    def _respond_created_booking(self, booking):
        from django.db import transaction as db_transaction

        from .acquiring import attach_prepay_if_needed
        from .booking_actions import notify_new_booking

        try:
            extra = attach_prepay_if_needed(booking)
        except ValueError as e:
            db_transaction.set_rollback(True)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        booking.refresh_from_db()
        if not extra:
            try:
                notify_new_booking(booking)
            except Exception:
                pass
        ser = self.get_serializer(booking)
        data = ser.data
        if extra:
            data["confirmation_url"] = extra.get("confirmation_url") or ""
            data["prepay_amount"] = extra.get("prepay_amount")
        return Response(data, status=status.HTTP_201_CREATED)

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not _acts_as_client(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        service_id = request.data.get("service")
        provider_id = request.data.get("provider")
        slot_id = request.data.get("slot")
        starts_raw = request.data.get("starts_at")
        ends_raw = request.data.get("ends_at")
        staff_id = request.data.get("staff")
        comment = (request.data.get("comment") or "")[:250]
        option_ids = request.data.get("option_ids") or request.data.get("options") or []

        if provider_id and str(provider_id) == str(request.user.id):
            return Response({"detail": "Нельзя записаться к своей организации."}, status=status.HTTP_400_BAD_REQUEST)

        if starts_raw and ends_raw:
            starts_at = parse_datetime(str(starts_raw))
            ends_at = parse_datetime(str(ends_raw))
            if not starts_at or not ends_at or ends_at <= starts_at:
                return Response({"detail": "Некорректное время."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                service = Service.objects.get(pk=int(service_id), provider_id=int(provider_id), is_active=True)
                snapshots = resolve_selected_options(service, option_ids)
                booking = book_time_window(
                    int(provider_id),
                    int(service_id),
                    starts_at,
                    ends_at,
                    int(staff_id) if staff_id not in (None, "", "null") else None,
                    request.user,
                    comment,
                    selected_options=snapshots,
                    notify=False,
                )
            except Service.DoesNotExist:
                return Response({"detail": "Услуга не найдена."}, status=status.HTTP_400_BAD_REQUEST)
            except ValueError as e:
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            try:
                self._apply_loyalty_redeem(booking, request.data)
            except ValueError as e:
                transaction.set_rollback(True)
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            return self._respond_created_booking(booking)

        if not slot_id:
            return Response({"detail": "Укажите слот или время."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            slot = AvailabilitySlot.objects.select_for_update().get(pk=slot_id)
        except AvailabilitySlot.DoesNotExist:
            return Response({"detail": "Слот не найден."}, status=status.HTTP_404_NOT_FOUND)
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
            self._apply_loyalty_redeem(booking, request.data)
        except ValueError as e:
            transaction.set_rollback(True)
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return self._respond_created_booking(booking)

    def _apply_loyalty_redeem(self, booking, data):
        from .loyalty import loyalty_discount_rub, redeem_loyalty_points

        try:
            points = int(data.get("loyalty_points") or 0)
        except (TypeError, ValueError):
            points = 0
        if points <= 0:
            return
        redeemed = redeem_loyalty_points(
            provider=booking.provider,
            client=booking.client,
            points=points,
            booking=booking,
            note="Списание при записи",
        )
        if redeemed:
            discount = loyalty_discount_rub(booking.provider, redeemed)
            note = f"[баллы −{redeemed}, скидка ≈ {discount} ₽]"
            booking.comment = f"{(booking.comment or '').strip()} {note}".strip()[:250]
            booking.save(update_fields=["comment"])

    @action(detail=True, methods=["post"], url_path="pay")
    def pay(self, request, pk=None):
        from .acquiring import attach_prepay_if_needed, sync_booking_from_yookassa

        booking = Booking.objects.filter(pk=pk).first()
        if not booking or booking.client_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if booking.status == Booking.Status.CANCELLED:
            return Response({"detail": "Запись отменена."}, status=status.HTTP_400_BAD_REQUEST)
        sync_booking_from_yookassa(booking)
        booking.refresh_from_db()
        if booking.payment_status == "paid":
            return Response(self.get_serializer(booking).data)
        if booking.payment_status == "pending" and booking.payment_url:
            data = self.get_serializer(booking).data
            data["confirmation_url"] = booking.payment_url
            return Response(data)
        try:
            extra = attach_prepay_if_needed(booking)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        data = self.get_serializer(booking).data
        if extra:
            data["confirmation_url"] = extra.get("confirmation_url") or ""
        return Response(data)

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
            payload = {"code": err}
            if err == "prepay_required":
                payload["detail"] = "Клиент ещё не внёс предоплату — подтвердить запись нельзя."
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)
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

        booking = Booking.objects.filter(pk=pk).first()
        if not booking or booking.client_id != request.user.id:
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


class AcquiringSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _payload(self, request, acq):
        from .acquiring import resolve_payment_setup
        from payments.gateway import PROVIDERS, provider_ready

        code, creds = resolve_payment_setup(request.user)
        return {
            "payment_provider": acq.payment_provider or "yookassa",
            "prepay_mode": acq.prepay_mode,
            "prepay_percent": acq.prepay_percent,
            "yookassa_shop_id": acq.yookassa_shop_id or "",
            "has_yookassa": bool((acq.yookassa_shop_id or "").strip() and (acq.yookassa_secret_key or "").strip()),
            "tbank_terminal_key": acq.tbank_terminal_key or "",
            "has_tbank": bool((acq.tbank_terminal_key or "").strip() and (acq.tbank_password or "").strip()),
            "cloudpayments_public_id": acq.cloudpayments_public_id or "",
            "has_cloudpayments": bool(
                (acq.cloudpayments_public_id or "").strip() and (acq.cloudpayments_api_secret or "").strip()
            ),
            "robokassa_merchant_login": acq.robokassa_merchant_login or "",
            "has_robokassa": bool(
                (acq.robokassa_merchant_login or "").strip()
                and (acq.robokassa_password1 or "").strip()
                and (acq.robokassa_password2 or "").strip()
            ),
            "has_payment_keys": provider_ready(code, creds),
            "providers": [{"key": k, "label": v} for k, v in PROVIDERS],
        }

    def get(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from .acquiring import get_or_create_acquiring

        acq = get_or_create_acquiring(request.user)
        return Response(self._payload(request, acq))

    def patch(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from .acquiring import get_or_create_acquiring
        from .models import ProviderAcquiring

        acq = get_or_create_acquiring(request.user)
        data = request.data or {}
        if "payment_provider" in data:
            code = str(data.get("payment_provider") or "").strip()
            if code not in {c[0] for c in ProviderAcquiring._meta.get_field("payment_provider").choices}:
                return Response({"payment_provider": ["Некорректный эквайер."]}, status=status.HTTP_400_BAD_REQUEST)
            acq.payment_provider = code
        if "prepay_mode" in data:
            mode = str(data.get("prepay_mode") or "").strip()
            if mode not in {c[0] for c in ProviderAcquiring.PrepayMode.choices}:
                return Response({"prepay_mode": ["Некорректный режим."]}, status=status.HTTP_400_BAD_REQUEST)
            acq.prepay_mode = mode
        if "prepay_percent" in data:
            try:
                pct = int(data.get("prepay_percent"))
            except (TypeError, ValueError):
                return Response({"prepay_percent": ["Укажите число 1–100."]}, status=status.HTTP_400_BAD_REQUEST)
            acq.prepay_percent = min(100, max(1, pct))
        str_fields = [
            "yookassa_shop_id",
            "tbank_terminal_key",
            "cloudpayments_public_id",
            "robokassa_merchant_login",
        ]
        for f in str_fields:
            if f in data:
                setattr(acq, f, str(data.get(f) or "").strip())
        secret_fields = [
            "yookassa_secret_key",
            "tbank_password",
            "cloudpayments_api_secret",
            "robokassa_password1",
            "robokassa_password2",
        ]
        for f in secret_fields:
            if f in data and str(data.get(f) or "").strip():
                setattr(acq, f, str(data.get(f)).strip())
        acq.save()
        return Response(self._payload(request, acq))



class MessagingSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _payload(self, msg):
        from django.conf import settings as dj_settings

        platform_tg = bool((getattr(dj_settings, "TELEGRAM_BOT_TOKEN", None) or "").strip())
        return {
            "remind_clients": msg.remind_clients,
            "remind_org": msg.remind_org,
            "notify_org_on_new": msg.notify_org_on_new,
            "winback_enabled": msg.winback_enabled,
            "winback_weeks": msg.winback_weeks,
            "winback_template": msg.winback_template or "",
            "enable_telegram": msg.enable_telegram,
            "enable_max": msg.enable_max,
            "enable_whatsapp": msg.enable_whatsapp,
            "enable_sms": msg.enable_sms,
            "telegram_notify_chat_id": msg.telegram_notify_chat_id or "",
            "has_telegram": msg.has_telegram(),
            "has_platform_telegram": platform_tg,
            "has_org_telegram_token": bool((msg.telegram_bot_token or "").strip()),
            "max_notify_chat_id": msg.max_notify_chat_id or "",
            "has_max": msg.has_max(),
            "wa_api_url": msg.wa_api_url or "https://api.green-api.com",
            "wa_id_instance": msg.wa_id_instance or "",
            "has_whatsapp": msg.has_whatsapp(),
            "has_sms_org": msg.has_sms_org(),
            "reminder_template": msg.reminder_template or "",
            "new_booking_template": msg.new_booking_template or "",
        }

    def get(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from notifications.delivery import get_or_create_messaging

        msg = get_or_create_messaging(request.user)
        return Response(self._payload(msg))

    def patch(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from notifications.delivery import get_or_create_messaging

        msg = get_or_create_messaging(request.user)
        data = request.data or {}
        bool_fields = [
            "remind_clients",
            "remind_org",
            "notify_org_on_new",
            "winback_enabled",
            "enable_telegram",
            "enable_max",
            "enable_whatsapp",
            "enable_sms",
        ]
        for f in bool_fields:
            if f in data:
                setattr(msg, f, bool(data.get(f)))
        if "winback_weeks" in data:
            try:
                msg.winback_weeks = max(1, min(52, int(data.get("winback_weeks"))))
            except (TypeError, ValueError):
                pass
        str_fields = [
            "telegram_notify_chat_id",
            "max_notify_chat_id",
            "wa_api_url",
            "wa_id_instance",
            "reminder_template",
            "new_booking_template",
            "winback_template",
        ]
        for f in str_fields:
            if f in data:
                setattr(msg, f, str(data.get(f) or "").strip())
        secrets = [
            "telegram_bot_token",
            "max_bot_token",
            "wa_api_token",
            "sms_api_id",
        ]
        for f in secrets:
            if f in data and str(data.get(f) or "").strip():
                setattr(msg, f, str(data.get(f)).strip())
        msg.save()
        return Response(self._payload(msg))


class TelegramOrgLinkView(APIView):
    """Provider: deep-link to bind org notify chat via platform bot."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        import secrets

        from notifications.delivery import get_or_create_messaging
        from notifications.telegram_bot import org_deep_link, org_start_param, platform_bot_username

        msg = get_or_create_messaging(request.user)
        if not (msg.telegram_org_link_token or "").strip():
            msg.telegram_org_link_token = secrets.token_urlsafe(12)
            msg.save(update_fields=["telegram_org_link_token"])
        bot_username = platform_bot_username()
        return Response(
            {
                "link_token": msg.telegram_org_link_token,
                "start_param": org_start_param(msg.telegram_org_link_token),
                "telegram_notify_chat_id": msg.telegram_notify_chat_id or "",
                "linked": bool((msg.telegram_notify_chat_id or "").strip()),
                "deep_link": org_deep_link(msg.telegram_org_link_token),
                "bot_username": bot_username,
                "hint": (
                    f"Откройте @{bot_username} по ссылке и нажмите Start — Chat ID подставится сам. "
                    "Или отправьте боту /start или /chatid — он пришлёт Chat ID для ручного ввода."
                )
                if bot_username
                else "Укажите TELEGRAM_BOT_USERNAME на платформе.",
            }
        )

    def delete(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        from notifications.delivery import get_or_create_messaging

        msg = get_or_create_messaging(request.user)
        msg.telegram_notify_chat_id = ""
        msg.save(update_fields=["telegram_notify_chat_id"])
        return Response({"ok": True, "linked": False, "telegram_notify_chat_id": ""})

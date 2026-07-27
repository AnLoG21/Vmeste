from django.contrib.auth import get_user_model
from django.db.models import Avg, Q
from rest_framework import serializers

from catalog.models import Service, ServiceCategory

from .booking_actions import client_display_name
from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


def staff_review_stats(link: ProviderStaff) -> tuple[float | None, int]:
    """Средний рейтинг сотрудника (по staff_rating) и число отзывов (услуга мастера + оценка мастера)."""
    from reviews.models import Review

    qs = Review.objects.filter(
        Q(staff_id=link.id) | Q(booking__staff_id=link.staff_id, booking__isnull=False)
    ).filter(provider_id=link.provider_id)
    count = qs.count()
    if not count:
        return None, 0
    agg = qs.filter(staff_rating__isnull=False).aggregate(avg=Avg("staff_rating"))
    avg = agg.get("avg")
    return (round(float(avg), 2) if avg is not None else None), count


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
    portfolio_photos = serializers.SerializerMethodField(read_only=True)
    average_rating = serializers.SerializerMethodField(read_only=True)
    reviews_count = serializers.SerializerMethodField(read_only=True)

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
            "bio",
            "avatar_image",
            "is_active",
            "invitation_status",
            "permissions",
            "assigned_service_ids",
            "assigned_category_ids",
            "staff_user",
            "provider_user",
            "portfolio_photos",
            "average_rating",
            "reviews_count",
        ]
        read_only_fields = [
            "provider",
            "staff_username",
            "staff_email",
            "staff_user",
            "provider_user",
            "invitation_status",
            "average_rating",
            "reviews_count",
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

    def get_portfolio_photos(self, obj):
        photos = getattr(obj, "portfolio_photos", None)
        if photos is None:
            return []
        request = self.context.get("request")
        rows = photos.all().order_by("id")
        out = []
        for row in rows:
            if not row.image:
                continue
            url = row.image.url
            if request:
                url = request.build_absolute_uri(url)
            out.append({"id": row.id, "image": url})
        return out

    def get_average_rating(self, obj):
        if hasattr(obj, "_average_rating"):
            return obj._average_rating
        avg, _ = staff_review_stats(obj)
        return avg

    def get_reviews_count(self, obj):
        if hasattr(obj, "_reviews_count"):
            return obj._reviews_count
        _, count = staff_review_stats(obj)
        return count

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
    is_manual_hold = serializers.SerializerMethodField()

    class Meta:
        model = AvailabilitySlot
        fields = [
            "id",
            "provider",
            "staff",
            "starts_at",
            "ends_at",
            "is_booked",
            "hold_label",
            "anonymous_index",
            "service_ids",
            "is_manual_hold",
            "recurrence_group",
            "booking_client_name",
            "booking_service_name",
        ]
        read_only_fields = [
            "provider",
            "is_booked",
            "hold_label",
            "is_manual_hold",
            "booking_client_name",
            "booking_service_name",
        ]

    def get_is_manual_hold(self, obj):
        if not obj.is_booked:
            return False
        try:
            _ = obj.booking
            return False
        except Booking.DoesNotExist:
            return True

    def get_booking_client_name(self, obj):
        if not obj.is_booked:
            return ""
        label = (obj.hold_label or "").strip()
        try:
            booking = obj.booking
        except Booking.DoesNotExist:
            return label
        name = client_display_name(getattr(booking, "client", None))
        return name or label

    def get_booking_service_name(self, obj):
        if not obj.is_booked:
            return ""
        try:
            booking = obj.booking
        except Booking.DoesNotExist:
            return "Ручная бронь"
        return (booking.service.name or "").strip()


class BookingSerializer(serializers.ModelSerializer):
    service_name = serializers.CharField(source="service.name", read_only=True)
    service_price = serializers.DecimalField(
        source="service.price", max_digits=10, decimal_places=2, read_only=True
    )
    organization_name = serializers.SerializerMethodField()
    client_username = serializers.CharField(source="client.username", read_only=True)
    client_display_name = serializers.SerializerMethodField()
    staff_display_name = serializers.SerializerMethodField()
    staff_job_title = serializers.SerializerMethodField()
    slot_starts_at = serializers.SerializerMethodField()
    slot_ends_at = serializers.SerializerMethodField()
    review = serializers.SerializerMethodField()

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
            "service_price",
            "organization_name",
            "client_username",
            "client_display_name",
            "staff_display_name",
            "staff_job_title",
            "slot_starts_at",
            "slot_ends_at",
            "review",
        ]
        read_only_fields = [
            "client",
            "created_at",
            "service_name",
            "service_price",
            "organization_name",
            "client_username",
            "client_display_name",
            "staff_display_name",
            "staff_job_title",
            "slot_starts_at",
            "slot_ends_at",
            "review",
        ]

    def get_organization_name(self, obj):
        prov = getattr(obj, "provider", None)
        if not prov:
            return ""
        name = (getattr(prov, "organization_name", None) or "").strip()
        return name or (prov.username or "")

    def get_review(self, obj):
        from reviews.models import Review

        request = self.context.get("request")
        prefetched = getattr(obj, "_prefetched_objects_cache", None)
        if prefetched is not None and "reviews" in prefetched:
            review = obj.reviews.all().first()
        else:
            review = (
                Review.objects.filter(booking_id=obj.id)
                .select_related("reply")
                .prefetch_related("photos")
                .order_by("-created_at")
                .first()
            )
        if not review:
            return None
        photos = []
        for row in review.photos.all():
            if not row.image:
                continue
            url = row.image.url
            if request:
                url = request.build_absolute_uri(url)
            photos.append({"id": row.id, "url": url})
        reply = getattr(review, "reply", None)
        reply_data = None
        if reply:
            reply_data = {
                "id": reply.id,
                "text": reply.text,
                "sent_via_chat": reply.sent_via_chat,
                "created_at": reply.created_at,
            }
        return {
            "id": review.id,
            "rating": review.rating,
            "staff_rating": review.staff_rating,
            "text": review.text,
            "created_at": review.created_at,
            "supplemented_at": review.supplemented_at,
            "photos": photos,
            "reply": reply_data,
        }

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

    def get_staff_job_title(self, obj):
        staff_user = getattr(obj, "staff", None)
        if not staff_user:
            return ""
        provider_id = getattr(obj, "provider_id", None)
        if provider_id is None:
            return ""
        link = (
            ProviderStaff.objects.filter(
                provider_id=provider_id,
                staff=staff_user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            )
            .select_related("staff")
            .first()
        )
        return (getattr(link, "job_title", "") or "").strip()

    def get_slot_starts_at(self, obj):
        slot = getattr(obj, "slot", None)
        return getattr(slot, "starts_at", None)

    def get_slot_ends_at(self, obj):
        slot = getattr(obj, "slot", None)
        return getattr(slot, "ends_at", None)

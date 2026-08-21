from django.db.models import Avg, Count
from rest_framework import serializers

from booking.booking_actions import client_display_name
from booking.models import Booking, ProviderStaff
from common.media_urls import photo_urls

from .models import Review, ReviewLike, ReviewPhoto, ReviewReply


class ReviewPhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = ReviewPhoto
        fields = ["id", "image", "thumb_url"]

    def _urls(self, obj):
        request = self.context.get("request")
        return photo_urls(request, obj.image)

    def get_image(self, obj):
        return self._urls(obj)["url"]

    def get_thumb_url(self, obj):
        return self._urls(obj)["thumb_url"]


class ReviewReplySerializer(serializers.ModelSerializer):
    class Meta:
        model = ReviewReply
        fields = ["id", "text", "sent_via_chat", "created_at"]


class ReviewSerializer(serializers.ModelSerializer):
    client_name = serializers.SerializerMethodField()
    staff_name = serializers.SerializerMethodField()
    photos = ReviewPhotoSerializer(many=True, read_only=True)
    reply = ReviewReplySerializer(read_only=True)
    likes_count = serializers.SerializerMethodField()
    liked_by_me = serializers.SerializerMethodField()
    is_new = serializers.SerializerMethodField()

    class Meta:
        model = Review
        fields = [
            "id",
            "provider",
            "client",
            "booking",
            "cafe_order",
            "staff",
            "rating",
            "staff_rating",
            "text",
            "staff_text",
            "supplemented_at",
            "created_at",
            "client_name",
            "staff_name",
            "photos",
            "reply",
            "likes_count",
            "liked_by_me",
            "is_new",
        ]
        read_only_fields = [
            "client",
            "created_at",
            "supplemented_at",
            "client_name",
            "staff_name",
            "photos",
            "reply",
            "likes_count",
            "liked_by_me",
            "is_new",
        ]

    def get_client_name(self, obj):
        return client_display_name(getattr(obj, "client", None))

    def get_staff_name(self, obj):
        st = getattr(obj, "staff", None)
        if not st:
            return ""
        u = getattr(st, "staff", None)
        if not u:
            return ""
        return client_display_name(u)

    def get_likes_count(self, obj):
        if hasattr(obj, "_likes_count"):
            return obj._likes_count
        return obj.likes.count()

    def get_liked_by_me(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        if hasattr(obj, "_liked_by_me"):
            return obj._liked_by_me
        return obj.likes.filter(user=request.user).exists()

    def get_is_new(self, obj):
        request = self.context.get("request")
        user = getattr(request, "user", None) if request else None
        if not user or user.role not in ("provider", "staff"):
            return False
        return obj.provider_seen_at is None


class ReviewCreateSerializer(serializers.ModelSerializer):
    staff_user = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    class Meta:
        model = Review
        fields = [
            "provider",
            "booking",
            "cafe_order",
            "staff",
            "staff_user",
            "rating",
            "staff_rating",
            "text",
            "staff_text",
        ]
        extra_kwargs = {
            "staff": {"required": False, "allow_null": True},
            "booking": {"required": False, "allow_null": True},
            "cafe_order": {"required": False, "allow_null": True},
            "staff_rating": {"required": False, "allow_null": True},
            "staff_text": {"required": False, "allow_blank": True},
        }

    def validate_rating(self, value):
        if value < 1 or value > 5:
            raise serializers.ValidationError("Оценка от 1 до 5.")
        return value

    def validate_staff_rating(self, value):
        if value is None:
            return value
        if value < 1 or value > 5:
            raise serializers.ValidationError("Оценка сотрудника от 1 до 5.")
        return value

    def validate(self, attrs):
        from cafe.models import CafeOrder

        booking = attrs.get("booking")
        cafe_order = attrs.get("cafe_order")
        user = self.context["request"].user

        if booking and booking.status != Booking.Status.DONE:
            raise serializers.ValidationError({"booking": "Отзыв можно оставить только после оказания услуги."})
        if booking and booking.client_id != user.id:
            raise serializers.ValidationError({"booking": "Это не ваша запись."})

        if cafe_order:
            if cafe_order.status != CafeOrder.Status.DONE:
                raise serializers.ValidationError(
                    {"cafe_order": "Отзыв можно оставить только после завершения заказа."}
                )
            owns = cafe_order.client_id == user.id
            if not owns:
                def _digits(raw):
                    return "".join(ch for ch in str(raw or "") if ch.isdigit())[-10:]

                up = _digits(getattr(user, "phone", "") or "")
                op = _digits(cafe_order.guest_phone or "")
                owns = bool(up and up == op)
            if not owns:
                raise serializers.ValidationError({"cafe_order": "Это не ваш заказ."})
            if Review.objects.filter(cafe_order=cafe_order, client=user).exists():
                raise serializers.ValidationError({"cafe_order": "Вы уже оставили отзыв на этот заказ."})
            attrs["provider"] = cafe_order.provider
            if not cafe_order.client_id:
                cafe_order.client = user
                cafe_order.save(update_fields=["client", "updated_at"])

        staff_user_id = attrs.pop("staff_user", None)
        provider = attrs["provider"]
        provider_id = provider.id if hasattr(provider, "id") else provider

        if not attrs.get("staff") and staff_user_id:
            link = ProviderStaff.objects.filter(
                provider_id=provider_id,
                staff_id=staff_user_id,
                is_active=True,
            ).first()
            if link:
                attrs["staff"] = link

        if not attrs.get("staff") and booking and booking.staff_id:
            link = ProviderStaff.objects.filter(
                provider_id=provider_id,
                staff_id=booking.staff_id,
                is_active=True,
            ).first()
            if link:
                attrs["staff"] = link

        if attrs.get("staff") and attrs.get("staff_rating") is None and not booking and not cafe_order:
            attrs["staff_rating"] = attrs.get("rating")

        return attrs


class ProviderReviewSummarySerializer(serializers.Serializer):
    provider = serializers.IntegerField()
    average_rating = serializers.DecimalField(max_digits=4, decimal_places=2, allow_null=True)
    reviews_count = serializers.IntegerField()
    photo_urls = serializers.ListField(child=serializers.URLField(), allow_empty=True)

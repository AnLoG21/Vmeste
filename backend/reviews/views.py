from django.db.models import Avg, Count, Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking, ProviderStaff
from users.models import User

from .models import Review, ReviewLike, ReviewPhoto, ReviewReply
from .serializers import (
    ProviderReviewSummarySerializer,
    ReviewCreateSerializer,
    ReviewSerializer,
)


class ReviewViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    http_method_names = ["get", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return ReviewCreateSerializer
        return ReviewSerializer

    def _org_reviews_queryset(self, user):
        if user.role == User.Role.PROVIDER:
            return Review.objects.filter(provider=user)
        if user.role == User.Role.STAFF:
            ids = ProviderStaff.objects.filter(
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            ).values_list("provider_id", flat=True)
            return Review.objects.filter(provider_id__in=ids)
        return Review.objects.none()

    def get_queryset(self):
        user = self.request.user
        provider_id = (self.request.query_params.get("provider") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "-created_at").strip()
        if ordering not in ("-created_at", "created_at", "-rating", "rating"):
            ordering = "-created_at"

        qs = Review.objects.select_related("client", "staff", "staff__staff", "provider", "reply").prefetch_related(
            "photos"
        ).annotate(_likes_count=Count("likes"))

        if provider_id:
            qs = qs.filter(provider_id=provider_id)
        elif user.role == User.Role.PROVIDER:
            qs = qs.filter(provider=user)
        elif user.role == User.Role.STAFF:
            ids = ProviderStaff.objects.filter(staff=user, is_active=True).values_list("provider_id", flat=True)
            qs = qs.filter(provider_id__in=ids)
        elif user.role == User.Role.CLIENT:
            qs = qs.filter(client=user)
        else:
            qs = qs.none()

        if user.is_authenticated:
            qs = qs.annotate(
                _liked_by_me=Exists(
                    ReviewLike.objects.filter(review_id=OuterRef("pk"), user_id=user.id)
                )
            )

        return qs.order_by(ordering)

    def create(self, request, *args, **kwargs):
        if request.user.role != User.Role.CLIENT:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = ReviewCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        booking = ser.validated_data.get("booking")
        if booking and booking.client_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        review = ser.save(client=request.user)
        for f in request.FILES.getlist("photos"):
            ReviewPhoto.objects.create(review=review, image=f)
        return Response(
            ReviewSerializer(review, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"])
    def like(self, request, pk=None):
        review = self.get_object()
        ReviewLike.objects.get_or_create(review=review, user=request.user)
        return Response({"likes_count": review.likes.count()})

    @action(detail=True, methods=["post"], url_path="unlike")
    def unlike(self, request, pk=None):
        review = self.get_object()
        ReviewLike.objects.filter(review=review, user=request.user).delete()
        return Response({"likes_count": review.likes.count()})

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        review = self.get_object()
        user = request.user
        if user.role == User.Role.PROVIDER and review.provider_id != user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.role == User.Role.STAFF:
            if not ProviderStaff.objects.filter(
                provider_id=review.provider_id, staff=user, is_active=True
            ).exists():
                return Response(status=status.HTTP_403_FORBIDDEN)
        text = (request.data.get("text") or "").strip()
        if not text:
            return Response({"detail": "Введите текст ответа."}, status=status.HTTP_400_BAD_REQUEST)

        raw_publish = request.data.get("publish_reply")
        if raw_publish is None:
            publish_reply = True
        else:
            publish_reply = str(raw_publish).lower() in ("1", "true", "yes", "on")
        via_chat = str(request.data.get("via_chat", "")).lower() in ("1", "true", "yes", "on")

        if not publish_reply and not via_chat:
            return Response(
                {"detail": "Отметьте «Ответ на отзыв» и/или «Отправить в чат клиенту»."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if publish_reply:
            ReviewReply.objects.update_or_create(
                review=review,
                defaults={"author": user, "text": text, "sent_via_chat": via_chat},
            )
        else:
            ReviewReply.objects.filter(review=review).delete()

        if via_chat:
            from chat.services import post_review_reply_in_chat

            post_review_reply_in_chat(review.provider, review.client, review, text, sender=user)

        review = Review.objects.select_related("client", "staff", "staff__staff", "provider", "reply").prefetch_related(
            "photos"
        ).get(pk=review.pk)
        return Response(ReviewSerializer(review, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        user = request.user
        if user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return Response({"count": 0})
        count = self._org_reviews_queryset(user).filter(provider_seen_at__isnull=True).count()
        return Response({"count": count})

    @action(detail=False, methods=["post"], url_path="mark-seen")
    def mark_seen(self, request):
        user = request.user
        if user.role not in (User.Role.PROVIDER, User.Role.STAFF):
            return Response(status=status.HTTP_403_FORBIDDEN)
        now = timezone.now()
        updated = (
            self._org_reviews_queryset(user)
            .filter(provider_seen_at__isnull=True)
            .update(provider_seen_at=now)
        )
        return Response({"marked": updated})


class ProviderReviewSummaryView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider_id = (request.query_params.get("provider") or "").strip()
        if not provider_id:
            return Response({"detail": "provider required"}, status=status.HTTP_400_BAD_REQUEST)
        agg = Review.objects.filter(provider_id=provider_id).aggregate(
            avg=Avg("rating"), cnt=Count("id")
        )
        photo_rows = (
            ReviewPhoto.objects.filter(review__provider_id=provider_id)
            .order_by("-id")[:12]
            .select_related("review")
        )
        photo_urls = []
        for row in photo_rows:
            if row.image:
                photo_urls.append(request.build_absolute_uri(row.image.url))
        data = {
            "provider": int(provider_id),
            "average_rating": round(agg["avg"], 2) if agg["avg"] is not None else None,
            "reviews_count": agg["cnt"] or 0,
            "photo_urls": photo_urls,
        }
        return Response(ProviderReviewSummarySerializer(data).data)

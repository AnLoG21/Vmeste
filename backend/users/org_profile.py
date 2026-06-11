from django.db.models import Avg, Count
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.booking_actions import client_display_name
from reviews.models import Review, ReviewPhoto

from .models import ProviderGalleryPhoto, User
from .serializers import ProviderGalleryPhotoSerializer, UserSerializer

ORG_GALLERY_MAX_PHOTOS = 5


def default_working_hours():
    base = {"open": "09:00", "close": "18:00", "closed": False}
    return {key: dict(base) for key in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}


class OrganizationClientProfileView(APIView):
    """Публичная карточка организации для клиента (карта, запись)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider_id = (request.query_params.get("provider") or "").strip()
        if not provider_id:
            return Response({"detail": "provider required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            provider = User.objects.get(pk=provider_id, role=User.Role.PROVIDER)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        agg = Review.objects.filter(provider_id=provider.id).aggregate(
            avg=Avg("rating"), cnt=Count("id")
        )
        hours = provider.organization_working_hours or {}
        if not hours:
            hours = default_working_hours()

        gallery = []
        for row in provider.gallery_photos.all():
            if row.image:
                gallery.append(
                    {
                        "id": row.id,
                        "url": request.build_absolute_uri(row.image.url),
                        "source": "org",
                    }
                )

        review_photos = []
        photo_rows = (
            ReviewPhoto.objects.filter(review__provider_id=provider.id)
            .select_related("review", "review__client")
            .order_by("-id")[:40]
        )
        for row in photo_rows:
            if not row.image:
                continue
            rev = row.review
            review_photos.append(
                {
                    "id": row.id,
                    "url": request.build_absolute_uri(row.image.url),
                    "source": "review",
                    "review_id": rev.id,
                    "client_name": client_display_name(rev.client),
                    "rating": rev.rating,
                    "text": (rev.text or "").strip(),
                }
            )

        phones = provider.organization_phones if isinstance(provider.organization_phones, list) else []
        phones = [str(p).strip() for p in phones if str(p).strip()]
        websites = provider.organization_websites if isinstance(provider.organization_websites, list) else []
        websites = [str(w).strip() for w in websites if str(w).strip()]

        return Response(
            {
                "provider": provider.id,
                "organization_name": provider.organization_name or provider.username,
                "provider_sphere": provider.provider_sphere or "",
                "sphere_label": dict(User.ProviderSphere.choices).get(provider.provider_sphere or "", ""),
                "organization_address": provider.organization_address or "",
                "working_hours": hours,
                "phones": phones,
                "websites": websites,
                "card_note": provider.organization_card_note or "",
                "average_rating": round(agg["avg"], 2) if agg["avg"] is not None else None,
                "reviews_count": agg["cnt"] or 0,
                "gallery_photos": gallery,
                "review_photos": review_photos,
            }
        )


class ProviderGalleryView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def _provider_user(self, request):
        if request.user.role != User.Role.PROVIDER:
            return None
        return request.user

    def get(self, request):
        user = self._provider_user(request)
        if not user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = user.gallery_photos.all()
        return Response(
            {
                "photos": ProviderGalleryPhotoSerializer(qs, many=True, context={"request": request}).data,
                "max_photos": ORG_GALLERY_MAX_PHOTOS,
                "count": qs.count(),
            }
        )

    def post(self, request):
        user = self._provider_user(request)
        if not user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if user.gallery_photos.count() >= ORG_GALLERY_MAX_PHOTOS:
            return Response(
                {
                    "detail": f"Можно загрузить не более {ORG_GALLERY_MAX_PHOTOS} фото организации.",
                    "code": "gallery_limit_reached",
                    "max_photos": ORG_GALLERY_MAX_PHOTOS,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        image = request.FILES.get("image")
        if not image:
            return Response({"detail": "image required"}, status=status.HTTP_400_BAD_REQUEST)
        max_order = user.gallery_photos.order_by("-sort_order").values_list("sort_order", flat=True).first() or 0
        row = ProviderGalleryPhoto.objects.create(
            provider=user, image=image, sort_order=max_order + 1
        )
        return Response(
            ProviderGalleryPhotoSerializer(row, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request):
        user = self._provider_user(request)
        if not user:
            return Response(status=status.HTTP_403_FORBIDDEN)
        photo_id = (request.query_params.get("id") or request.data.get("id") or "").strip()
        if not photo_id:
            return Response({"detail": "id required"}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = user.gallery_photos.filter(pk=photo_id).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProviderOrganizationInfoView(APIView):
    """Сохранение расписания, телефонов и доп. поля организации."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = {}
        if "organization_working_hours" in request.data:
            data["organization_working_hours"] = request.data["organization_working_hours"]
        if "organization_phones" in request.data:
            phones = request.data["organization_phones"]
            if isinstance(phones, list):
                data["organization_phones"] = [str(p).strip() for p in phones if str(p).strip()]
        if "organization_websites" in request.data:
            websites = request.data["organization_websites"]
            if isinstance(websites, list):
                data["organization_websites"] = [str(w).strip() for w in websites if str(w).strip()]
        if "organization_card_note" in request.data:
            data["organization_card_note"] = str(request.data["organization_card_note"] or "")
        if not data:
            return Response({"detail": "nothing to update"}, status=status.HTTP_400_BAD_REQUEST)
        ser = UserSerializer(request.user, data=data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

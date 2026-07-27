from django.db.models import Avg, Count
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.booking_actions import client_display_name
from reviews.models import Review, ReviewPhoto

from .models import User
from .org_profile import default_working_hours
from .slug_utils import ensure_organization_slug


def build_public_org_payload(provider, request):
    ensure_organization_slug(provider)
    agg = Review.objects.filter(provider_id=provider.id).aggregate(avg=Avg("rating"), cnt=Count("id"))
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
        .order_by("-id")[:24]
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

    return {
        "provider": provider.id,
        "slug": provider.organization_slug or "",
        "organization_name": provider.organization_name or provider.username,
        "provider_sphere": provider.provider_sphere or "",
        "sphere_label": dict(User.ProviderSphere.choices).get(provider.provider_sphere or "", ""),
        "organization_address": provider.organization_address or "",
        "organization_latitude": provider.organization_latitude,
        "organization_longitude": provider.organization_longitude,
        "working_hours": hours,
        "phones": phones,
        "websites": websites,
        "card_note": provider.organization_card_note or "",
        "average_rating": round(agg["avg"], 2) if agg["avg"] is not None else None,
        "reviews_count": agg["cnt"] or 0,
        "gallery_photos": gallery,
        "review_photos": review_photos,
        "public_url": f"/o/{provider.organization_slug}" if provider.organization_slug else "",
        "is_cafe": provider.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT,
    }


class PublicOrganizationBySlugView(APIView):
    """Публичная SEO-карточка организации без авторизации."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        slug = (slug or "").strip().lower()
        if not slug:
            return Response({"detail": "not found"}, status=status.HTTP_404_NOT_FOUND)
        try:
            provider = User.objects.get(
                organization_slug__iexact=slug,
                role=User.Role.PROVIDER,
                is_active=True,
            )
        except User.DoesNotExist:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_public_org_payload(provider, request))


class PublicOrganizationSitemapView(APIView):
    """Список slug для sitemap (только активные провайдеры с адресом/именем)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        qs = (
            User.objects.filter(role=User.Role.PROVIDER, is_active=True)
            .exclude(organization_name="")
            .order_by("id")[:500]
        )
        items = []
        for u in qs:
            slug = ensure_organization_slug(u)
            items.append(
                {
                    "slug": slug,
                    "name": u.organization_name or u.username,
                    "sphere": u.provider_sphere or "",
                    "url": f"/o/{slug}",
                }
            )
        return Response({"organizations": items})

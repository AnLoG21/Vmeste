from django.db.models import Avg, Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.booking_actions import client_display_name
from reviews.models import Review, ReviewPhoto

from .models import User
from .org_profile import default_working_hours
from .slug_utils import ensure_organization_slug

SITE_ORIGIN = "https://vsevmeste.space"
CITY_SITEMAP = (
    ("moscow", "Москва"),
    ("spb", "Санкт-Петербург"),
)


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
                    "address": u.organization_address or "",
                    "url": f"/o/{slug}",
                    "menu_url": f"/m/{slug}" if u.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT else "",
                }
            )
        return Response({"organizations": items})


class SitemapXmlView(APIView):
    """Динамический sitemap.xml для Яндекса/Google: главные + города + /o/ и /m/."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        today = timezone.localdate().isoformat()
        urls = [
            ("/", "1.0", "weekly", today),
            ("/businesses", "0.95", "weekly", today),
            ("/contacts", "0.9", "monthly", today),
            ("/offer", "0.8", "monthly", today),
            ("/privacy", "0.6", "monthly", today),
        ]
        for key, _title in CITY_SITEMAP:
            urls.append((f"/city/{key}", "0.85", "weekly", today))

        qs = (
            User.objects.filter(role=User.Role.PROVIDER, is_active=True)
            .exclude(organization_name="")
            .exclude(organization_slug="")
            .order_by("id")[:1000]
        )
        for u in qs:
            slug = ensure_organization_slug(u)
            if not slug:
                continue
            lastmod = today
            for attr in ("date_joined", "last_login"):
                val = getattr(u, attr, None)
                if val:
                    try:
                        lastmod = timezone.localdate(val).isoformat()
                    except Exception:
                        lastmod = val.date().isoformat() if hasattr(val, "date") else today
            urls.append((f"/o/{slug}", "0.8", "weekly", lastmod))
            if u.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT:
                urls.append((f"/m/{slug}", "0.7", "weekly", lastmod))

        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ]
        for path, priority, freq, lastmod in urls:
            lines.append("  <url>")
            lines.append(f"    <loc>{SITE_ORIGIN}{path}</loc>")
            lines.append(f"    <lastmod>{lastmod}</lastmod>")
            lines.append(f"    <changefreq>{freq}</changefreq>")
            lines.append(f"    <priority>{priority}</priority>")
            lines.append("  </url>")
        lines.append("</urlset>")
        xml = "\n".join(lines) + "\n"
        return HttpResponse(xml, content_type="application/xml; charset=utf-8")

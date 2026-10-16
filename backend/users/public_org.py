import logging

from django.db.models import Avg, Count
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.booking_actions import client_display_name
from reviews.models import Review, ReviewPhoto

from common.media_urls import photo_urls

from .city_seo import CITY_SEO, get_city_seo
from .map_visibility import providers_visible_on_map
from .models import User
from .org_profile import default_working_hours
from .slug_utils import ensure_organization_slug

logger = logging.getLogger(__name__)

SITE_ORIGIN = "https://vsevmeste.space"
CITY_SITEMAP = (
    ("moscow", "Москва"),
    ("spb", "Санкт-Петербург"),
    ("ekaterinburg", "Екатеринбург"),
    ("kazan", "Казань"),
    ("novosibirsk", "Новосибирск"),
    ("nizhny", "Нижний Новгород"),
    ("rostov", "Ростов-на-Дону"),
    ("krasnodar", "Краснодар"),
    ("samara", "Самара"),
    ("chelyabinsk", "Челябинск"),
)

# Статический каркас sitemap — всегда отдаём хотя бы его (никогда не 500).
SITEMAP_STATIC_URLS = (
    ("/", "1.0", "weekly"),
    ("/businesses", "0.95", "weekly"),
    ("/salon", "0.9", "weekly"),
    ("/avtoservis", "0.9", "weekly"),
    ("/kafe", "0.9", "weekly"),
    ("/blog", "0.85", "weekly"),
    ("/blog/kak-nastroit-online-zapis-v-salone", "0.8", "monthly"),
    ("/blog/programma-dlya-avtoservisa-chto-vybrat", "0.8", "monthly"),
    ("/blog/qr-menyu-dlya-kafe-kak-zapustit", "0.8", "monthly"),
    ("/blog/chem-vmeste-otlichaetsya-ot-aggregatorov", "0.8", "monthly"),
    ("/blog/kak-privlech-klientov-cherez-kartu", "0.8", "monthly"),
    ("/blog/kak-zapustit-vitrinu-magazina", "0.8", "monthly"),
    ("/blog/kak-nastroit-zapis-neskolkih-masterov", "0.8", "monthly"),
    ("/apps", "0.85", "weekly"),
    ("/android", "0.8", "weekly"),
    ("/contacts", "0.9", "monthly"),
    ("/offer", "0.8", "monthly"),
    ("/privacy", "0.6", "monthly"),
)


def _sitemap_lastmod(value, fallback: str) -> str:
    if not value:
        return fallback
    try:
        from datetime import date, datetime

        if isinstance(value, datetime):
            return timezone.localdate(value).isoformat()
        if isinstance(value, date):
            return value.isoformat()
    except Exception:
        pass
    return fallback


def _render_sitemap_xml(urls) -> str:
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
    return "\n".join(lines) + "\n"


def build_public_org_payload(provider, request):
    ensure_organization_slug(provider)
    agg = Review.objects.filter(provider_id=provider.id).aggregate(avg=Avg("rating"), cnt=Count("id"))
    hours = provider.organization_working_hours or {}
    if not hours:
        hours = default_working_hours()

    gallery = []
    for row in provider.gallery_photos.all():
        if row.image:
            urls = photo_urls(request, row.image)
            gallery.append(
                {
                    "id": row.id,
                    "url": urls["url"],
                    "thumb_url": urls["thumb_url"],
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
        urls = photo_urls(request, row.image)
        review_photos.append(
            {
                "id": row.id,
                "url": urls["url"],
                "thumb_url": urls["thumb_url"],
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

    services = []
    try:
        from catalog.models import Service

        for svc in (
            Service.objects.filter(provider_id=provider.id, is_active=True)
            .order_by("category_id", "id")[:12]
            .only("id", "name", "price", "duration_minutes")
        ):
            services.append(
                {
                    "id": svc.id,
                    "name": svc.name,
                    "price": str(svc.price),
                    "duration_minutes": svc.duration_minutes,
                }
            )
    except Exception:
        services = []

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
        "services": services,
        "public_url": f"/o/{provider.organization_slug}" if provider.organization_slug else "",
        "is_cafe": provider.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT,
        "is_shop": provider.provider_sphere
        in (
            User.ProviderSphere.SHOPS,
            User.ProviderSphere.HAIR_SALON,
            User.ProviderSphere.SERVICE_CENTER,
        ),
        "shop_url": (
            f"/s/{provider.organization_slug}"
            if provider.organization_slug
            and provider.provider_sphere
            in (
                User.ProviderSphere.SHOPS,
                User.ProviderSphere.HAIR_SALON,
                User.ProviderSphere.SERVICE_CENTER,
            )
            else ""
        ),
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
                is_demo=False,
                map_hidden=False,
            )
        except User.DoesNotExist:
            return Response({"detail": "Организация не найдена."}, status=status.HTTP_404_NOT_FOUND)
        return Response(build_public_org_payload(provider, request))


class CitySeoJsonView(APIView):
    """Единый источник city SEO для SPA (backend/users/city_seo.py)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, city_key=None):
        if city_key:
            raw = get_city_seo(city_key)
            if not raw:
                return Response({"detail": "Город не найден."}, status=status.HTTP_404_NOT_FOUND)
            return Response({"key": city_key.strip().lower(), **_city_seo_public(raw)})
        items = []
        for key, raw in CITY_SEO.items():
            items.append({"key": key, **_city_seo_public(raw)})
        return Response({"cities": items})


def _city_seo_public(raw: dict) -> dict:
    """snake_case API → поля, удобные и для SPA (camel + snake)."""
    return {
        "title": raw.get("title") or "",
        "aliases": list(raw.get("aliases") or []),
        "meta_title": raw.get("meta_title") or "",
        "meta_description": raw.get("meta_description") or "",
        "metaTitle": raw.get("meta_title") or "",
        "metaDescription": raw.get("meta_description") or "",
        "intro": raw.get("intro") or "",
        "bullets": list(raw.get("bullets") or []),
        "faqs": list(raw.get("faqs") or []),
    }


class PublicOrganizationSitemapView(APIView):
    """Список slug для sitemap (только активные провайдеры с адресом/именем)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        # Нельзя slice до providers_visible_on_map — Django запрещает filter после [:N].
        try:
            qs = providers_visible_on_map(
                User.objects.filter(role=User.Role.PROVIDER, is_active=True, is_demo=False)
                .exclude(organization_name="")
                .exclude(provider_sphere=User.ProviderSphere.MARKETPLACES)
                .order_by("id")
            )[:500]
        except Exception:
            logger.exception("public-orgs: query failed")
            return Response({"organizations": []})
        items = []
        for u in qs:
            try:
                slug = (u.organization_slug or "").strip() or ensure_organization_slug(u)
            except Exception:
                logger.exception("public-orgs: slug failed for user_id=%s", getattr(u, "pk", None))
                continue
            if not slug:
                continue
            items.append(
                {
                    "slug": slug,
                    "name": u.organization_name or u.username,
                    "sphere": u.provider_sphere or "",
                    "address": u.organization_address or "",
                    "url": f"/o/{slug}",
                    "menu_url": f"/m/{slug}" if u.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT else "",
                    "shop_url": f"/s/{slug}"
                    if u.provider_sphere
                    in (
                        User.ProviderSphere.SHOPS,
                        User.ProviderSphere.HAIR_SALON,
                        User.ProviderSphere.SERVICE_CENTER,
                    )
                    else "",
                }
            )
        return Response({"organizations": items})


class SitemapXmlView(APIView):
    """Динамический sitemap.xml для Яндекса/Google: главные + города + /o/, /m/, /s/."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        today = timezone.localdate().isoformat()
        urls = [(path, pri, freq, today) for path, pri, freq in SITEMAP_STATIC_URLS]
        for key, _title in CITY_SITEMAP:
            urls.append((f"/city/{key}", "0.85", "weekly", today))

        try:
            # Не исключаем пустой slug — ensure_organization_slug заполнит его
            # (раньше .exclude(organization_slug="") выкидывал все орг. без slug).
            qs = providers_visible_on_map(
                User.objects.filter(role=User.Role.PROVIDER, is_active=True, is_demo=False)
                .exclude(organization_name="")
                .exclude(provider_sphere=User.ProviderSphere.MARKETPLACES)
                .order_by("id")
            )[:1000]
            for u in qs:
                try:
                    slug = (u.organization_slug or "").strip() or ensure_organization_slug(u)
                except Exception:
                    logger.exception("sitemap: slug failed for user_id=%s", getattr(u, "pk", None))
                    continue
                if not slug:
                    continue
                lastmod = _sitemap_lastmod(getattr(u, "date_joined", None), today)
                lastmod = _sitemap_lastmod(getattr(u, "last_login", None), lastmod)
                urls.append((f"/o/{slug}", "0.8", "weekly", lastmod))
                if u.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT:
                    urls.append((f"/m/{slug}", "0.7", "weekly", lastmod))
                try:
                    from shop.access import provider_sphere_allows_shop

                    if provider_sphere_allows_shop(u):
                        urls.append((f"/s/{slug}", "0.7", "weekly", lastmod))
                except Exception:
                    pass
        except Exception:
            logger.exception("sitemap: provider listing failed; returning static URLs only")

        try:
            xml = _render_sitemap_xml(urls)
        except Exception:
            logger.exception("sitemap: render failed; minimal fallback")
            xml = _render_sitemap_xml([(path, pri, freq, today) for path, pri, freq in SITEMAP_STATIC_URLS[:3]])
        return HttpResponse(xml, content_type="application/xml; charset=utf-8")

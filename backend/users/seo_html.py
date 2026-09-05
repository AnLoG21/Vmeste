"""Server-rendered HTML for search/social bots (Caddy routes User-Agent → these views)."""

from __future__ import annotations

import html
import json
import re

from django.shortcuts import render
from django.utils import timezone
from django.views import View

from .city_seo import get_city_seo
from .city_seo import get_city_seo
from .map_visibility import providers_visible_on_map
from .models import User
from .org_profile import default_working_hours
from .public_org import CITY_SITEMAP, SITE_ORIGIN, build_public_org_payload
from .slug_utils import ensure_organization_slug

DAY_SCHEMA = {
    "mon": "Monday",
    "tue": "Tuesday",
    "wed": "Wednesday",
    "thu": "Thursday",
    "fri": "Friday",
    "sat": "Saturday",
    "sun": "Sunday",
}
DAY_RU = {
    "mon": "Пн",
    "tue": "Вт",
    "wed": "Ср",
    "thu": "Чт",
    "fri": "Пт",
    "sat": "Сб",
    "sun": "Вс",
}
CITY_ALIASES = {
    "moscow": ["москва", "moscow"],
    "spb": ["санкт-петербург", "петербург", "спб", "saint petersburg"],
}


def _esc(value) -> str:
    return html.escape(str(value or ""), quote=True)


def _hours_spec(hours: dict) -> list:
    out = []
    for key, schema_day in DAY_SCHEMA.items():
        row = (hours or {}).get(key) or {}
        if row.get("closed"):
            continue
        open_t = (row.get("open") or "").strip()
        close_t = (row.get("close") or "").strip()
        if open_t and close_t:
            out.append(
                {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": schema_day,
                    "opens": open_t,
                    "closes": close_t,
                }
            )
    return out


def _hours_lines(hours: dict) -> list[str]:
    lines = []
    for key in DAY_SCHEMA:
        row = (hours or {}).get(key) or {}
        label = DAY_RU[key]
        if row.get("closed"):
            lines.append(f"{label}: выходной")
        else:
            lines.append(f"{label}: {row.get('open', '—')}–{row.get('close', '—')}")
    return lines


def _schema_type(sphere: str) -> str:
    if sphere == User.ProviderSphere.CAFE_RESTAURANT:
        return "Restaurant"
    if sphere == "hair_salon":
        return "BeautySalon"
    if sphere == "marketplaces":
        return "OnlineStore"
    return "LocalBusiness"


def _org_json_ld(payload: dict) -> list:
    hours = payload.get("working_hours") or {}
    images = [p["url"] for p in (payload.get("gallery_photos") or []) if p.get("url")]
    entity = {
        "@context": "https://schema.org",
        "@type": _schema_type(payload.get("provider_sphere") or ""),
        "name": payload.get("organization_name"),
        "url": f"{SITE_ORIGIN}/o/{payload.get('slug')}",
        "description": payload.get("card_note")
        or f"{payload.get('organization_name')} — {payload.get('sphere_label') or 'организация'} на Вместе",
        "telephone": (payload.get("phones") or [None])[0],
        "image": images or f"{SITE_ORIGIN}/og-cover.png",
        "sameAs": payload.get("websites") or None,
        "openingHoursSpecification": _hours_spec(hours) or None,
    }
    if payload.get("organization_address"):
        entity["address"] = {
            "@type": "PostalAddress",
            "streetAddress": payload.get("organization_address") or "",
            "addressCountry": "RU",
        }
    if payload.get("organization_latitude") is not None and payload.get("organization_longitude") is not None:
        entity["geo"] = {
            "@type": "GeoCoordinates",
            "latitude": payload["organization_latitude"],
            "longitude": payload["organization_longitude"],
        }
    if payload.get("average_rating") and payload.get("reviews_count"):
        entity["aggregateRating"] = {
            "@type": "AggregateRating",
            "ratingValue": payload["average_rating"],
            "reviewCount": payload["reviews_count"],
        }
    crumbs = {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{SITE_ORIGIN}/"},
            {"@type": "ListItem", "position": 2, "name": "Для бизнеса", "item": f"{SITE_ORIGIN}/businesses"},
            {
                "@type": "ListItem",
                "position": 3,
                "name": payload.get("organization_name"),
                "item": f"{SITE_ORIGIN}/o/{payload.get('slug')}",
            },
        ],
    }
    return [{k: v for k, v in entity.items() if v is not None}, crumbs]


def _base_ctx(**kwargs):
    ctx = {
        "site_origin": SITE_ORIGIN,
        "og_image": f"{SITE_ORIGIN}/og-cover.png",
        "year": timezone.localdate().year,
    }
    ctx.update(kwargs)
    return ctx


class SeoOrgHtmlView(View):
    def get(self, request, slug):
        slug = (slug or "").strip().lower()
        provider = (
            User.objects.filter(
                role=User.Role.PROVIDER,
                is_active=True,
                map_hidden=False,
                organization_slug__iexact=slug,
            ).first()
            if slug
            else None
        )
        if not provider:
            return render(
                request,
                "seo/not_found.html",
                _base_ctx(
                    title="Организация не найдена — Вместе",
                    description="Такой организации нет на платформе Вместе.",
                    canonical=f"{SITE_ORIGIN}/o/{_esc(slug)}",
                    robots="noindex,nofollow",
                    heading="Организация не найдена",
                ),
                status=404,
            )
        payload = build_public_org_payload(provider, request)
        desc = (
            payload.get("card_note")
            or f"{payload['organization_name']}"
            f"{', ' + payload['organization_address'] if payload.get('organization_address') else ''}. "
            f"Онлайн на Вместе."
        )
        og = (payload.get("gallery_photos") or [{}])[0].get("url") or f"{SITE_ORIGIN}/og-cover.png"
        json_ld = _org_json_ld(payload)
        return render(
            request,
            "seo/org.html",
            _base_ctx(
                title=f"{payload['organization_name']} — {payload.get('sphere_label') or 'Вместе'}",
                description=desc[:320],
                canonical=f"{SITE_ORIGIN}/o/{payload['slug']}",
                robots="index,follow",
                og_image=og,
                org=payload,
                hours_lines=_hours_lines(payload.get("working_hours") or default_working_hours()),
                json_ld=json.dumps(json_ld, ensure_ascii=False),
            ),
        )


class SeoMenuHtmlView(View):
    def get(self, request, slug):
        from cafe.models import CafeMenuCategory

        slug = (slug or "").strip().lower()
        provider = (
            User.objects.filter(
                role=User.Role.PROVIDER,
                is_active=True,
                map_hidden=False,
                provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
                organization_slug__iexact=slug,
            ).first()
            if slug
            else None
        )
        if not provider:
            return render(
                request,
                "seo/not_found.html",
                _base_ctx(
                    title="Меню не найдено — Вместе",
                    description="Такого меню нет на платформе Вместе.",
                    canonical=f"{SITE_ORIGIN}/m/{_esc(slug)}",
                    robots="noindex,nofollow",
                    heading="Меню не найдено",
                ),
                status=404,
            )
        ensure_organization_slug(provider)
        cats = (
            CafeMenuCategory.objects.filter(provider=provider, is_active=True)
            .prefetch_related("items__photos")
            .order_by("sort_order", "id")
        )
        menu = []
        for cat in cats:
            items = []
            for item in cat.items.all():
                if not item.is_active or not getattr(item, "is_available", True):
                    continue
                photo = item.photos.first()
                photo_url = request.build_absolute_uri(photo.image.url) if photo and photo.image else ""
                items.append(
                    {
                        "name": item.name,
                        "description": (item.description or "").strip(),
                        "price": str(item.price),
                        "photo_url": photo_url,
                    }
                )
            if items:
                menu.append({"name": cat.name, "items": items})

        name = provider.organization_name or provider.username
        addr = provider.organization_address or ""
        desc = f"Меню «{name}»{': ' + addr if addr else ''}. Заказ онлайн через Вместе."
        has_offer = any(i for c in menu for i in c["items"])
        menu_ld = {
            "@context": "https://schema.org",
            "@type": "Restaurant",
            "name": name,
            "url": f"{SITE_ORIGIN}/m/{provider.organization_slug}",
            "menu": f"{SITE_ORIGIN}/m/{provider.organization_slug}",
            "address": {"@type": "PostalAddress", "streetAddress": addr, "addressCountry": "RU"}
            if addr
            else None,
            "hasMenu": {
                "@type": "Menu",
                "hasMenuSection": [
                    {
                        "@type": "MenuSection",
                        "name": c["name"],
                        "hasMenuItem": [
                            {
                                "@type": "MenuItem",
                                "name": i["name"],
                                "description": i["description"] or i["name"],
                                "offers": {
                                    "@type": "Offer",
                                    "price": i["price"],
                                    "priceCurrency": "RUB",
                                },
                            }
                            for i in c["items"][:40]
                        ],
                    }
                    for c in menu
                ],
            }
            if has_offer
            else None,
        }
        crumbs = {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{SITE_ORIGIN}/"},
                {
                    "@type": "ListItem",
                    "position": 2,
                    "name": name,
                    "item": f"{SITE_ORIGIN}/o/{provider.organization_slug}",
                },
                {
                    "@type": "ListItem",
                    "position": 3,
                    "name": "Меню",
                    "item": f"{SITE_ORIGIN}/m/{provider.organization_slug}",
                },
            ],
        }
        first_photo = next((i["photo_url"] for c in menu for i in c["items"] if i.get("photo_url")), None)
        return render(
            request,
            "seo/menu.html",
            _base_ctx(
                title=f"{name} — меню онлайн | Вместе",
                description=desc[:320],
                canonical=f"{SITE_ORIGIN}/m/{provider.organization_slug}",
                robots="index,follow",
                og_image=first_photo or f"{SITE_ORIGIN}/og-cover.png",
                org_name=name,
                org_slug=provider.organization_slug,
                address=addr,
                menu=menu,
                json_ld=json.dumps([menu_ld, crumbs], ensure_ascii=False),
            ),
        )


class SeoCityHtmlView(View):
    def get(self, request, city_key):
        city_key = (city_key or "").strip().lower()
        title_map = dict(CITY_SITEMAP)
        city_title = title_map.get(city_key)
        if not city_title:
            return render(
                request,
                "seo/not_found.html",
                _base_ctx(
                    title="Город не найден — Вместе",
                    description="Такой городной страницы нет.",
                    canonical=f"{SITE_ORIGIN}/city/{_esc(city_key)}",
                    robots="noindex,nofollow",
                    heading="Страница не найдена",
                ),
                status=404,
            )
        city_seo = get_city_seo(city_key) or {}
        aliases = city_seo.get("aliases") or CITY_ALIASES.get(city_key, [city_title.lower()])
        qs = providers_visible_on_map(
            User.objects.filter(role=User.Role.PROVIDER, is_active=True, is_demo=False)
            .exclude(organization_name="")
            .order_by("id")[:800]
        )
        orgs = []
        for u in qs:
            addr = (u.organization_address or "").lower()
            if not any(a in addr for a in aliases):
                continue
            slug = ensure_organization_slug(u)
            orgs.append(
                {
                    "name": u.organization_name or u.username,
                    "slug": slug,
                    "sphere": dict(User.ProviderSphere.choices).get(u.provider_sphere or "", ""),
                    "address": u.organization_address or "",
                    "is_cafe": u.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT,
                }
            )
        meta_title = city_seo.get("meta_title") or f"Вместе в городе {city_title} — онлайн-запись и кафе"
        meta_description = city_seo.get("meta_description") or (
            f"Организации на платформе Вместе в городе {city_title}: запись, меню, контакты."
        )
        city_faqs = city_seo.get("faqs") or []
        json_ld = [
            {
                "@context": "https://schema.org",
                "@type": "CollectionPage",
                "name": f"Вместе · {city_title}",
                "description": meta_description,
                "url": f"{SITE_ORIGIN}/city/{city_key}",
                "about": city_title,
            },
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                "itemListElement": [
                    {"@type": "ListItem", "position": 1, "name": "Главная", "item": f"{SITE_ORIGIN}/"},
                    {"@type": "ListItem", "position": 2, "name": "Для бизнеса", "item": f"{SITE_ORIGIN}/businesses"},
                    {
                        "@type": "ListItem",
                        "position": 3,
                        "name": city_title,
                        "item": f"{SITE_ORIGIN}/city/{city_key}",
                    },
                ],
            },
        ]
        if city_faqs:
            json_ld.append(
                {
                    "@context": "https://schema.org",
                    "@type": "FAQPage",
                    "mainEntity": [
                        {
                            "@type": "Question",
                            "name": f["q"],
                            "acceptedAnswer": {"@type": "Answer", "text": f["a"]},
                        }
                        for f in city_faqs
                        if f.get("q") and f.get("a")
                    ],
                }
            )
        return render(
            request,
            "seo/city.html",
            _base_ctx(
                title=meta_title,
                description=meta_description,
                canonical=f"{SITE_ORIGIN}/city/{city_key}",
                robots="index,follow",
                city_key=city_key,
                city_title=city_title,
                city_intro=city_seo.get("intro") or "",
                city_bullets=city_seo.get("bullets") or [],
                city_faqs=city_faqs,
                orgs=orgs,
                json_ld=json.dumps(json_ld, ensure_ascii=False),
            ),
        )

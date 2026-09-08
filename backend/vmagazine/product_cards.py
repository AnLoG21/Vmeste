from __future__ import annotations

from django.db.models import F

from common.media_urls import photo_urls
from shop.models import Product
from users.models import User

from .models import ProductViewHistory


VIEW_HISTORY_LIMIT = 80


def product_card(product: Product, request=None, *, liked: bool | None = None) -> dict:
    photos = []
    for ph in product.photos.all()[:5]:
        if not ph.image:
            continue
        if request is not None:
            urls = photo_urls(request, ph.image)
            photos.append(
                {
                    "id": ph.id,
                    "image": urls.get("url") or "",
                    "thumb_url": urls.get("thumb_url") or urls.get("url") or "",
                }
            )
        else:
            photos.append({"id": ph.id, "image": ph.image.url, "thumb_url": ph.image.url})

    provider = product.provider
    slug = (provider.organization_slug if provider else "") or ""
    is_original = product.authenticity_status == Product.AuthenticityStatus.VERIFIED
    return {
        "id": product.id,
        "name": product.name,
        "price": str(product.price),
        "unit": product.unit,
        "category": product.category_id,
        "category_name": product.category.name if product.category_id else "",
        "provider_id": product.provider_id,
        "provider_name": (provider.organization_name or provider.username) if provider else "",
        "shop_url": f"/s/{slug}?product={product.id}" if slug else "",
        "shop_slug": slug,
        "photos": photos,
        "cover_url": (photos[0].get("thumb_url") or photos[0].get("image")) if photos else "",
        "view_count": product.view_count or 0,
        "is_original": is_original,
        "authenticity_status": product.authenticity_status,
        "bonus_points": product.bonus_points or 0,
        "liked": bool(liked) if liked is not None else False,
        "stock_qty": str(product.stock_qty),
        "attrs": product.attrs if isinstance(product.attrs, dict) else {},
        "sizes": list(product.sizes or []) if isinstance(product.sizes, list) else [],
        "description": product.description or "",
    }


def product_detail(product: Product, request=None, *, liked: bool | None = None) -> dict:
    """Полная карточка для экрана товара во Вмагазине."""
    from django.db.models import Avg, Count

    from reviews.models import Review
    from shop.models import ShopSettings

    card = product_card(product, request, liked=liked)
    related = []
    for p in product.related_products.filter(is_active=True).prefetch_related("photos")[:12]:
        related.append(product_card(p, request))
    card["related_products"] = related
    logo_url = ""
    provider = product.provider
    if provider:
        first_photo = (
            provider.gallery_photos.filter(image__isnull=False).exclude(image="").order_by("id").first()
        )
        if first_photo and first_photo.image:
            if request is not None:
                urls = photo_urls(request, first_photo.image)
                logo_url = urls.get("thumb_url") or urls.get("url") or ""
            else:
                logo_url = first_photo.image.url
    card["shop_logo_url"] = logo_url
    card["authenticity_note"] = (product.authenticity_note or "") if product.authenticity_status != "none" else ""

    avg = None
    count = 0
    if product.provider_id:
        agg = Review.objects.filter(provider_id=product.provider_id).aggregate(
            avg=Avg("rating"),
            cnt=Count("id"),
        )
        avg = agg.get("avg")
        count = int(agg.get("cnt") or 0)
    card["provider_average_rating"] = round(float(avg), 2) if avg is not None else None
    card["provider_reviews_count"] = count

    earn_hint = ""
    if product.bonus_points and product.bonus_points > 0:
        earn_hint = f"+{product.bonus_points} Вбонусов за шт."
    elif product.provider_id:
        settings_obj = ShopSettings.objects.filter(provider_id=product.provider_id).first()
        percent = float(getattr(settings_obj, "bonus_earn_percent", 0) or 0)
        if percent > 0:
            pts = round(float(product.price or 0) * percent / 100, 2)
            if pts > 0:
                earn_hint = f"+≈{pts:g} Вбонусов ({percent:g}% от цены)"
    card["bonus_earn_hint"] = earn_hint
    return card


def record_product_view(user, product: Product) -> None:
    Product.objects.filter(pk=product.pk).update(view_count=F("view_count") + 1)
    ProductViewHistory.objects.update_or_create(user=user, product=product)
    # Trim to last 80
    ids = list(
        ProductViewHistory.objects.filter(user=user).order_by("-viewed_at").values_list("id", flat=True)[
            VIEW_HISTORY_LIMIT:
        ]
    )
    if ids:
        ProductViewHistory.objects.filter(id__in=ids).delete()


def active_products_qs():
    """Товары витрин сфер магазинов/салона/автосервиса (в т.ч. демо-аккаунты для отладки)."""
    from shop.access import SHOP_SPHERES

    return (
        Product.objects.filter(
            is_active=True,
            provider__is_active=True,
            provider__role=User.Role.PROVIDER,
            provider__provider_sphere__in=SHOP_SPHERES,
        )
        .select_related("provider", "category")
        .prefetch_related("photos")
    )

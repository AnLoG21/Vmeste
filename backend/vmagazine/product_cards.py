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
    }


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
    return (
        Product.objects.filter(is_active=True, provider__is_active=True, provider__is_demo=False)
        .exclude(provider__map_hidden=True)
        .select_related("provider", "category")
        .prefetch_related("photos")
    )

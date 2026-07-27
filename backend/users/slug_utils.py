"""Slug helpers for public organization pages."""

from django.utils.text import slugify


def unique_organization_slug(base: str, *, exclude_pk=None) -> str:
    raw = slugify(base, allow_unicode=False) or "org"
    raw = raw[:70].strip("-") or "org"
    from .models import User

    candidate = raw
    n = 2
    while True:
        qs = User.objects.filter(organization_slug=candidate)
        if exclude_pk:
            qs = qs.exclude(pk=exclude_pk)
        if not qs.exists():
            return candidate
        suffix = f"-{n}"
        candidate = f"{raw[: 70 - len(suffix)]}{suffix}"
        n += 1


def ensure_organization_slug(user) -> str:
    if user.organization_slug:
        return user.organization_slug
    base = user.organization_name or user.username or f"org-{user.pk}"
    slug = unique_organization_slug(base, exclude_pk=user.pk)
    user.organization_slug = slug
    user.save(update_fields=["organization_slug"])
    return slug

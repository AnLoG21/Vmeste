"""Helpers to hide test provider accounts from the client map and public SEO."""

from __future__ import annotations

from django.db.models import QuerySet

from .models import User

MAP_HIDDEN_USERNAMES = (
    "a.loginov149",
    "a.loginov150",
    "a.loginov154",
    "a.loginov22",
    "арина",
)

# Эти пользователи видят на карте и скрытые тестовые организации.
MAP_DEBUG_VIEWER_USERNAMES = (
    "a.loginov151",
)


def viewer_can_see_hidden_map(user) -> bool:
    if not user or not getattr(user, "is_authenticated", False):
        return False
    uname = (getattr(user, "username", None) or "").strip().lower()
    if not uname:
        return False
    return uname in {u.lower() for u in MAP_DEBUG_VIEWER_USERNAMES}


def providers_visible_on_map(qs: QuerySet[User], viewer=None) -> QuerySet[User]:
    if viewer_can_see_hidden_map(viewer):
        return qs
    return qs.filter(map_hidden=False)


def provider_locations_visible_on_map(qs, *, provider_prefix: str = "provider__", viewer=None):
    if viewer_can_see_hidden_map(viewer):
        return qs
    return qs.filter(**{f"{provider_prefix}map_hidden": False})

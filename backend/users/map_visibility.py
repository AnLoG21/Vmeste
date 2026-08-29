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


def providers_visible_on_map(qs: QuerySet[User]) -> QuerySet[User]:
    return qs.filter(map_hidden=False)


def provider_locations_visible_on_map(qs, *, provider_prefix: str = "provider__"):
    return qs.filter(**{f"{provider_prefix}map_hidden": False})

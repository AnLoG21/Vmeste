"""Interest-based feed scoring for Вменю."""

from __future__ import annotations

from collections import Counter

from .models import VmenuRecipe, VmenuSave


def user_interest_category_ids(user) -> set[int]:
    tags = set()
    profile = getattr(user, "vmenu_profile", None)
    if profile and profile.interest_tags:
        for t in profile.interest_tags:
            if isinstance(t, int):
                tags.add(t)
    saved_cats = (
        VmenuSave.objects.filter(user=user, recipe__category_id__isnull=False)
        .values_list("recipe__category_id", flat=True)
        .distinct()[:20]
    )
    tags.update(saved_cats)
    authored = (
        VmenuRecipe.objects.filter(author=user, category_id__isnull=False)
        .values_list("category_id", flat=True)
        .distinct()[:10]
    )
    tags.update(authored)
    return tags


def score_recipe_for_user(recipe, interest_cats: set[int]) -> float:
    score = float(recipe.like_count or 0) * 0.3 + float(recipe.save_count or 0) * 0.5
    if recipe.avg_rating:
        score += float(recipe.avg_rating) * 2
    if recipe.category_id and recipe.category_id in interest_cats:
        score += 15
    if recipe.published_at:
        score += 1
    return score


def rank_recommended(recipes, user, limit: int = 30):
    interest = user_interest_category_ids(user)
    scored = [(score_recipe_for_user(r, interest), r) for r in recipes]
    scored.sort(key=lambda x: (-x[0], -(x[1].published_at.timestamp() if x[1].published_at else 0)))
    return [r for _, r in scored[:limit]]

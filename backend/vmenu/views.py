from __future__ import annotations

from decimal import Decimal

from django.db.models import Avg, Count, F, Q
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from common.media_urls import photo_urls
from users.models import User

from .models import (
    VmenuCategory,
    VmenuComment,
    VmenuCommentPhoto,
    VmenuFollow,
    VmenuIngredient,
    VmenuLike,
    VmenuProfile,
    VmenuRecipe,
    VmenuRecipePhoto,
    VmenuSave,
    VmenuStep,
    VmenuRecipeView,
)
from .feed_rank import rank_recommended
from .privacy import can_message_user
from .recipe_parser import download_image, parse_recipe_url as fetch_recipe_from_url
from .units import scale_ingredients
from .serializers import (
    VmenuCategorySerializer,
    VmenuCommentSerializer,
    VmenuProfileSerializer,
    VmenuRecipeDetailSerializer,
    VmenuRecipeListSerializer,
    VmenuUserPublicSerializer,
)


def _profile(user) -> VmenuProfile:
    profile, _ = VmenuProfile.objects.get_or_create(user=user)
    return profile


def _display_name(user) -> str:
    parts = [user.first_name, user.last_name]
    name = " ".join(p for p in parts if p).strip()
    return name or user.username


def _can_message(viewer, target: User) -> bool:
    return can_message_user(viewer, target)

def _recipe_list_qs(user):
    return (
        VmenuRecipe.objects.filter(status=VmenuRecipe.Status.PUBLISHED)
        .select_related("author", "category")
        .prefetch_related("extra_photos")
    )


def _annotate_recipe_flags(qs, user):
    if not user or not user.is_authenticated:
        return qs
    return qs.annotate(
        liked=Count("likes", filter=Q(likes__user_id=user.id)),
        saved=Count("saves", filter=Q(saves__user_id=user.id)),
    )


class VmenuCategoryListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        cats = VmenuCategory.objects.all()
        return Response(VmenuCategorySerializer(cats, many=True).data)


class VmenuFeedView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        following_ids = list(
            VmenuFollow.objects.filter(follower=user).values_list("following_id", flat=True)
        )
        base = _annotate_recipe_flags(_recipe_list_qs(user), user)

        following = list(base.filter(author_id__in=following_ids)[:40])
        following_ids_set = {r.id for r in following}
        pool = list(
            base.exclude(author_id__in=following_ids)
            .exclude(id__in=following_ids_set)
            .order_by("-like_count", "-save_count", "-published_at")[:80]
        )
        recommended = rank_recommended(pool, user, limit=30)
        items = following + recommended
        return Response(
            {
                "items": VmenuRecipeListSerializer(items, many=True, context={"request": request}).data,
            }
        )


class VmenuSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        category = (request.query_params.get("category") or "").strip()
        sort = (request.query_params.get("sort") or "rating").strip()
        min_rating = request.query_params.get("min_rating")

        qs = _annotate_recipe_flags(_recipe_list_qs(request.user), request.user)
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q))
        if category:
            qs = qs.filter(category__slug=category)
        if min_rating:
            try:
                qs = qs.filter(avg_rating__gte=Decimal(min_rating))
            except Exception:
                pass
        if sort == "new":
            qs = qs.order_by("-published_at")
        elif sort == "popular":
            qs = qs.order_by("-save_count", "-like_count")
        else:
            qs = qs.order_by("-avg_rating", "-like_count")

        items = qs[:60]
        return Response(
            {"items": VmenuRecipeListSerializer(items, many=True, context={"request": request}).data}
        )


class VmenuMyBookView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        own = VmenuRecipe.objects.filter(
            author=request.user,
            status__in=[VmenuRecipe.Status.BOOK_ONLY, VmenuRecipe.Status.DRAFT],
        )
        saved_ids = VmenuSave.objects.filter(user=request.user).values_list("recipe_id", flat=True)
        saved = VmenuRecipe.objects.filter(id__in=saved_ids)
        qs = _annotate_recipe_flags(
            (own | saved).distinct().select_related("category", "author"),
            request.user,
        ).order_by("-updated_at")
        return Response(
            {"items": VmenuRecipeListSerializer(qs, many=True, context={"request": request}).data}
        )


class VmenuRecipeDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, recipe_id):
        try:
            recipe = VmenuRecipe.objects.select_related("author", "category").prefetch_related(
                "extra_photos", "ingredients", "steps", "comments__user", "comments__photos"
            ).get(pk=recipe_id)
        except VmenuRecipe.DoesNotExist:
            return Response({"detail": "Рецепт не найден."}, status=status.HTTP_404_NOT_FOUND)
        if recipe.status != VmenuRecipe.Status.PUBLISHED and recipe.author_id != request.user.id:
            if not VmenuSave.objects.filter(user=request.user, recipe=recipe).exists():
                return Response(status=status.HTTP_404_NOT_FOUND)
        VmenuRecipeView.objects.create(recipe=recipe, user=request.user)
        VmenuRecipe.objects.filter(pk=recipe.pk).update(view_count=F("view_count") + 1)
        recipe.refresh_from_db()
        data = VmenuRecipeDetailSerializer(recipe, context={"request": request}).data
        data["liked"] = VmenuLike.objects.filter(user=request.user, recipe=recipe).exists()
        data["saved"] = VmenuSave.objects.filter(user=request.user, recipe=recipe).exists()
        servings = request.query_params.get("servings")
        if servings:
            try:
                target = max(1, min(99, int(servings)))
                unit = (request.query_params.get("unit") or "").strip() or None
                data["scaled_servings"] = target
                data["scaled_ingredients"] = scale_ingredients(
                    recipe.ingredients.all(), recipe.servings, target, unit
                )
            except (TypeError, ValueError):
                pass
        return Response(data)

    def patch(self, request, recipe_id):
        try:
            recipe = VmenuRecipe.objects.get(pk=recipe_id, author=request.user)
        except VmenuRecipe.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        for field in ("title", "description", "source_url", "status", "servings"):
            if field in request.data:
                setattr(recipe, field, request.data.get(field))
        if "category_id" in request.data:
            cid = request.data.get("category_id")
            recipe.category_id = cid or None
        if request.data.get("publish") in (True, "true", "1", 1):
            recipe.publish()
        elif request.data.get("book_only") in (True, "true", "1", 1):
            recipe.status = VmenuRecipe.Status.BOOK_ONLY
        if "cover_image" in request.FILES:
            recipe.cover_image = request.FILES["cover_image"]
        if "video" in request.FILES:
            recipe.video = request.FILES["video"]
        recipe.save()
        return Response(VmenuRecipeDetailSerializer(recipe, context={"request": request}).data)

    def delete(self, request, recipe_id):
        deleted, _ = VmenuRecipe.objects.filter(pk=recipe_id, author=request.user).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True})


class VmenuRecipeCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request):
        title = (request.data.get("title") or "Новый рецепт").strip()[:200]
        recipe = VmenuRecipe.objects.create(
            author=request.user,
            title=title,
            description=(request.data.get("description") or "").strip(),
            source_url=(request.data.get("source_url") or "").strip(),
            status=VmenuRecipe.Status.DRAFT,
            category_id=request.data.get("category_id") or None,
            servings=int(request.data.get("servings") or 4),
        )
        if "cover_image" in request.FILES:
            recipe.cover_image = request.FILES["cover_image"]
            recipe.save(update_fields=["cover_image"])
        return Response(
            VmenuRecipeDetailSerializer(recipe, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VmenuRecipeLikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(pk=recipe_id, status=VmenuRecipe.Status.PUBLISHED).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _, created = VmenuLike.objects.get_or_create(user=request.user, recipe=recipe)
        if created:
            VmenuRecipe.objects.filter(pk=recipe.pk).update(like_count=recipe.like_count + 1)
        recipe.refresh_from_db()
        return Response({"liked": True, "like_count": recipe.like_count})

    def delete(self, request, recipe_id):
        deleted, _ = VmenuLike.objects.filter(user=request.user, recipe_id=recipe_id).delete()
        if deleted:
            r = VmenuRecipe.objects.filter(pk=recipe_id).first()
            if r and r.like_count > 0:
                VmenuRecipe.objects.filter(pk=recipe_id).update(like_count=r.like_count - 1)
        r = VmenuRecipe.objects.filter(pk=recipe_id).first()
        return Response({"liked": False, "like_count": r.like_count if r else 0})


class VmenuRecipeSaveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(
            pk=recipe_id,
            status=VmenuRecipe.Status.PUBLISHED,
        ).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        _, created = VmenuSave.objects.get_or_create(user=request.user, recipe=recipe)
        if created:
            VmenuRecipe.objects.filter(pk=recipe.pk).update(save_count=recipe.save_count + 1)
        recipe.refresh_from_db()
        return Response({"saved": True, "save_count": recipe.save_count})

    def delete(self, request, recipe_id):
        deleted, _ = VmenuSave.objects.filter(user=request.user, recipe_id=recipe_id).delete()
        if deleted:
            r = VmenuRecipe.objects.filter(pk=recipe_id).first()
            if r and r.save_count > 0:
                VmenuRecipe.objects.filter(pk=recipe_id).update(save_count=r.save_count - 1)
        r = VmenuRecipe.objects.filter(pk=recipe_id).first()
        return Response({"saved": False, "save_count": r.save_count if r else 0})


class VmenuRecipeCommentView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(pk=recipe_id, status=VmenuRecipe.Status.PUBLISHED).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        rating = int(request.data.get("rating") or 0)
        text = (request.data.get("text") or "").strip()
        parent_id = request.data.get("parent_id")
        parent = None
        if parent_id:
            parent = VmenuComment.objects.filter(pk=parent_id, recipe=recipe).first()
        reply_to = None
        reply_username = (request.data.get("reply_to_username") or "").strip().lstrip("@")
        if reply_username:
            reply_to = User.objects.filter(username__iexact=reply_username, is_active=True).first()
        import re

        comment = VmenuComment.objects.create(
            user=request.user,
            recipe=recipe,
            parent=parent,
            reply_to_user=reply_to,
            text=text,
            rating=max(0, min(5, rating)),
        )
        for f in request.FILES.getlist("photos"):
            VmenuCommentPhoto.objects.create(comment=comment, image=f)
        mentioned = set(re.findall(r"@([a-zA-Z0-9_]+)", text))
        if reply_to:
            mentioned.add(reply_to.username)
        from notifications.models import InAppNotification

        for uname in mentioned:
            target = User.objects.filter(username__iexact=uname, is_active=True).exclude(pk=request.user.id).first()
            if not target:
                continue
            InAppNotification.objects.create(
                user=target,
                kind=InAppNotification.Kind.VMENU,
                payload={
                    "recipe_id": recipe.id,
                    "recipe_title": recipe.title,
                    "comment_id": comment.id,
                    "from_user": request.user.username,
                    "text_preview": text[:120],
                },
            )
        agg = VmenuComment.objects.filter(recipe=recipe, rating__gt=0).aggregate(avg=Avg("rating"))
        VmenuRecipe.objects.filter(pk=recipe.pk).update(
            comment_count=recipe.comment_count + 1,
            avg_rating=agg["avg"] or 0,
        )
        recipe.refresh_from_db()
        return Response(VmenuCommentSerializer(comment, context={"request": request}).data)


class VmenuFollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, user_id):
        if int(user_id) == request.user.id:
            return Response({"detail": "Нельзя подписаться на себя."}, status=status.HTTP_400_BAD_REQUEST)
        target = User.objects.filter(pk=user_id, is_active=True).first()
        if not target:
            return Response(status=status.HTTP_404_NOT_FOUND)
        VmenuFollow.objects.get_or_create(follower=request.user, following=target)
        return Response({"following": True})

    def delete(self, request, user_id):
        VmenuFollow.objects.filter(follower=request.user, following_id=user_id).delete()
        return Response({"following": False})


class VmenuUserSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get("q") or "").strip()
        if len(q) < 2:
            return Response({"items": []})
        qs = User.objects.filter(is_active=True).filter(
            Q(username__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
        ).exclude(pk=request.user.id)[:30]
        return Response(
            {"items": VmenuUserPublicSerializer(qs, many=True, context={"request": request}).data}
        )


class VmenuUserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, user_id):
        user = User.objects.filter(pk=user_id, is_active=True).first()
        if not user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        recipes = _annotate_recipe_flags(
            VmenuRecipe.objects.filter(author=user, status=VmenuRecipe.Status.PUBLISHED).select_related("category"),
            request.user,
        )[:50]
        followers = VmenuFollow.objects.filter(following=user).count()
        following = VmenuFollow.objects.filter(follower=user).count()
        is_following = VmenuFollow.objects.filter(follower=request.user, following=user).exists()
        return Response(
            {
                "user": VmenuUserPublicSerializer(user, context={"request": request}).data,
                "followers_count": followers,
                "following_count": following,
                "is_following": is_following,
                "can_message": _can_message(request.user, user),
                "recipes": VmenuRecipeListSerializer(recipes, many=True, context={"request": request}).data,
            }
        )


class VmenuMyProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        profile = _profile(request.user)
        followers = VmenuFollow.objects.filter(following=request.user).count()
        following = VmenuFollow.objects.filter(follower=request.user).count()
        recent_followers = (
            VmenuFollow.objects.filter(following=request.user)
            .select_related("follower")
            .order_by("-created_at")[:8]
        )
        recipes = _annotate_recipe_flags(
            VmenuRecipe.objects.filter(author=request.user, status=VmenuRecipe.Status.PUBLISHED).select_related(
                "category"
            ),
            request.user,
        )[:50]
        return Response(
            {
                "profile": VmenuProfileSerializer(profile, context={"request": request}).data,
                "followers_count": followers,
                "following_count": following,
                "recent_followers": VmenuUserPublicSerializer(
                    [f.follower for f in recent_followers],
                    many=True,
                    context={"request": request},
                ).data,
                "recipes": VmenuRecipeListSerializer(recipes, many=True, context={"request": request}).data,
            }
        )

    def patch(self, request):
        profile = _profile(request.user)
        if "bio" in request.data:
            profile.bio = (request.data.get("bio") or "").strip()
        if "allow_messages" in request.data:
            profile.allow_messages = request.data.get("allow_messages")
        if "avatar" in request.FILES:
            profile.avatar = request.FILES["avatar"]
        if "interest_tags" in request.data:
            raw = request.data.get("interest_tags")
            if isinstance(raw, str):
                import json

                try:
                    raw = json.loads(raw)
                except Exception:
                    raw = []
            if isinstance(raw, list):
                profile.interest_tags = [int(x) for x in raw if str(x).isdigit()][:20]
        profile.save()
        return Response(VmenuProfileSerializer(profile, context={"request": request}).data)


class VmenuFollowListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        kind = (request.query_params.get("kind") or "following").strip()
        if kind == "followers":
            qs = VmenuFollow.objects.filter(following=request.user).select_related("follower")
            users = [row.follower for row in qs]
        else:
            qs = VmenuFollow.objects.filter(follower=request.user).select_related("following")
            users = [row.following for row in qs]
        return Response(
            {"items": VmenuUserPublicSerializer(users, many=True, context={"request": request}).data}
        )


class VmenuParseUrlView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        url = (request.data.get("url") or "").strip()
        if not url:
            return Response({"detail": "Укажите ссылку."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            parsed = fetch_recipe_from_url(url)
        except Exception as exc:
            return Response({"detail": str(exc) or "Не удалось загрузить страницу."}, status=status.HTTP_400_BAD_REQUEST)
        recipe = VmenuRecipe.objects.create(
            author=request.user,
            title=parsed["title"],
            description=parsed["description"],
            source_url=parsed["source_url"],
            status=VmenuRecipe.Status.DRAFT,
            servings=parsed.get("servings") or 4,
        )
        for i, row in enumerate(parsed.get("ingredients") or []):
            VmenuIngredient.objects.create(
                recipe=recipe,
                name=row.get("name", ""),
                amount=row.get("amount") or 0,
                unit=row.get("unit") or "г",
                sort_order=i,
            )
        for i, row in enumerate(parsed.get("steps") or []):
            VmenuStep.objects.create(recipe=recipe, text=row.get("text", ""), sort_order=i)
        from django.core.files.base import ContentFile

        for idx, img_url in enumerate(parsed.get("image_urls") or []):
            try:
                data, fname = download_image(img_url)
                cf = ContentFile(data, name=fname)
                if idx == 0:
                    recipe.cover_image.save(fname, cf, save=True)
                elif recipe.extra_photos.count() < 4:
                    VmenuRecipePhoto.objects.create(recipe=recipe, image=cf, sort_order=idx)
            except Exception:
                continue
        recipe.refresh_from_db()
        return Response(
            VmenuRecipeDetailSerializer(recipe, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class VmenuRecipeIngredientsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def put(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(pk=recipe_id, author=request.user).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        items = request.data.get("ingredients") or []
        VmenuIngredient.objects.filter(recipe=recipe).delete()
        for i, row in enumerate(items):
            VmenuIngredient.objects.create(
                recipe=recipe,
                name=(row.get("name") or "").strip()[:200],
                amount=row.get("amount") or 0,
                unit=(row.get("unit") or "").strip()[:40],
                sort_order=i,
            )
        recipe.refresh_from_db()
        return Response(VmenuRecipeDetailSerializer(recipe, context={"request": request}).data)


class VmenuRecipeStepsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def put(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(pk=recipe_id, author=request.user).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        items = request.data.get("steps") or []
        if isinstance(items, str):
            import json

            try:
                items = json.loads(items)
            except Exception:
                items = []
        VmenuStep.objects.filter(recipe=recipe).delete()
        for i, row in enumerate(items):
            step = VmenuStep.objects.create(
                recipe=recipe,
                text=(row.get("text") or "").strip(),
                sort_order=i,
            )
            file_key = f"step_image_{i}"
            if file_key in request.FILES:
                step.image = request.FILES[file_key]
                step.save(update_fields=["image"])
        recipe.refresh_from_db()
        return Response(VmenuRecipeDetailSerializer(recipe, context={"request": request}).data)


class VmenuRecipeExtraPhotosView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, recipe_id):
        recipe = VmenuRecipe.objects.filter(pk=recipe_id, author=request.user).first()
        if not recipe:
            return Response(status=status.HTTP_404_NOT_FOUND)
        existing = recipe.extra_photos.count()
        files = request.FILES.getlist("photos") or list(request.FILES.values())
        if not files:
            return Response({"detail": "Нет файлов."}, status=status.HTTP_400_BAD_REQUEST)
        added = 0
        for f in files:
            if existing + added >= 4:
                break
            VmenuRecipePhoto.objects.create(recipe=recipe, image=f, sort_order=existing + added)
            added += 1
        recipe.refresh_from_db()
        return Response(VmenuRecipeDetailSerializer(recipe, context={"request": request}).data)

    def delete(self, request, recipe_id, photo_id):
        deleted, _ = VmenuRecipePhoto.objects.filter(pk=photo_id, recipe_id=recipe_id, recipe__author=request.user).delete()
        if not deleted:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({"ok": True})

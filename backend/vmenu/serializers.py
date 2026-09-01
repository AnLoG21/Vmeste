from rest_framework import serializers

from common.media_urls import photo_urls

from .models import (
    VmenuCategory,
    VmenuComment,
    VmenuCommentLike,
    VmenuCuisine,
    VmenuIngredient,
    VmenuLike,
    VmenuProfile,
    VmenuRecipe,
    VmenuStep,
    VmenuRecipePhoto,
    VmenuSave,
)


def _user_public(user, request):
    profile = getattr(user, "vmenu_profile", None)
    avatar_url = ""
    if profile and profile.avatar:
        avatar_url = photo_urls(request, profile.avatar).get("thumb_url") or ""
    name = " ".join(p for p in [user.first_name, user.last_name] if p).strip() or user.username
    return {
        "id": user.id,
        "username": user.username,
        "display_name": name,
        "avatar_url": avatar_url,
    }


class VmenuCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = VmenuCategory
        fields = ("id", "name", "slug")


class VmenuCuisineSerializer(serializers.ModelSerializer):
    class Meta:
        model = VmenuCuisine
        fields = ("id", "name", "slug")


class VmenuUserPublicSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    display_name = serializers.CharField()
    avatar_url = serializers.CharField()

    def to_representation(self, user):
        return _user_public(user, self.context.get("request"))


class VmenuProfileSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    username = serializers.CharField(source="user.username", read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = VmenuProfile
        fields = (
            "username",
            "display_name",
            "bio",
            "allow_messages",
            "interest_tags",
            "avatar_url",
        )

    def get_display_name(self, obj):
        return _user_public(obj.user, self.context.get("request"))["display_name"]

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return ""
        return photo_urls(self.context.get("request"), obj.avatar).get("thumb_url") or ""


class VmenuRecipeListSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    category = VmenuCategorySerializer(read_only=True)
    cuisine = VmenuCuisineSerializer(read_only=True)
    cover_url = serializers.SerializerMethodField()
    extra_photo_urls = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()
    saved = serializers.SerializerMethodField()

    class Meta:
        model = VmenuRecipe
        fields = (
            "id",
            "title",
            "description",
            "author",
            "category",
            "cuisine",
            "cover_url",
            "extra_photo_urls",
            "view_count",
            "like_count",
            "save_count",
            "comment_count",
            "avg_rating",
            "published_at",
            "liked",
            "saved",
        )

    def get_author(self, obj):
        return _user_public(obj.author, self.context.get("request"))

    def get_cover_url(self, obj):
        if not obj.cover_image:
            return ""
        return photo_urls(self.context.get("request"), obj.cover_image).get("url") or ""

    def get_extra_photo_urls(self, obj):
        request = self.context.get("request")
        urls = []
        for ph in obj.extra_photos.all()[:4]:
            if ph.image:
                urls.append(photo_urls(request, ph.image).get("url") or "")
        return urls

    def get_liked(self, obj):
        if hasattr(obj, "liked"):
            return bool(obj.liked)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return VmenuLike.objects.filter(user=request.user, recipe=obj).exists()
        return False

    def get_saved(self, obj):
        if hasattr(obj, "saved"):
            return bool(obj.saved)
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return VmenuSave.objects.filter(user=request.user, recipe=obj).exists()
        return False


class VmenuBookRecipeSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    category = VmenuCategorySerializer(read_only=True)
    cuisine = VmenuCuisineSerializer(read_only=True)
    cover_url = serializers.SerializerMethodField()

    class Meta:
        model = VmenuRecipe
        fields = ("id", "title", "author", "category", "cuisine", "cover_url")

    def get_author(self, obj):
        return _user_public(obj.author, self.context.get("request"))

    def get_cover_url(self, obj):
        if not obj.cover_image:
            return ""
        return photo_urls(self.context.get("request"), obj.cover_image).get("thumb_url") or photo_urls(
            self.context.get("request"), obj.cover_image
        ).get("url") or ""


class VmenuIngredientSerializer(serializers.ModelSerializer):
    amount = serializers.SerializerMethodField()
    unit = serializers.SerializerMethodField()

    class Meta:
        model = VmenuIngredient
        fields = ("id", "name", "amount", "unit", "sort_order")

    def get_amount(self, obj):
        if obj.amount is None or obj.amount == 0:
            return ""
        s = format(obj.amount, "f").rstrip("0").rstrip(".")
        return s or "0"

    def get_unit(self, obj):
        if obj.amount is None or obj.amount == 0:
            return (obj.unit or "").strip() if (obj.unit or "").strip() in ("щепотка", "по вкусу", "зубчик") else ""
        return obj.unit or ""


class VmenuStepSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = VmenuStep
        fields = ("id", "text", "image_url", "sort_order")

    def get_image_url(self, obj):
        if not obj.image:
            return ""
        return photo_urls(self.context.get("request"), obj.image).get("url") or ""


class VmenuCommentSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    photos = serializers.SerializerMethodField()
    reply_to_user = serializers.SerializerMethodField()
    like_count = serializers.SerializerMethodField()
    liked = serializers.SerializerMethodField()

    class Meta:
        model = VmenuComment
        fields = (
            "id",
            "user",
            "text",
            "rating",
            "photos",
            "parent_id",
            "reply_to_user",
            "like_count",
            "liked",
            "created_at",
        )

    def get_like_count(self, obj):
        if hasattr(obj, "like_count") and obj.like_count is not None:
            return obj.like_count
        return obj.likes.count()

    def get_liked(self, obj):
        if hasattr(obj, "liked"):
            return bool(obj.liked)
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return False
        return VmenuCommentLike.objects.filter(user=request.user, comment=obj).exists()

    def get_user(self, obj):
        return _user_public(obj.user, self.context.get("request"))

    def get_reply_to_user(self, obj):
        if not obj.reply_to_user_id:
            return None
        return _user_public(obj.reply_to_user, self.context.get("request"))

    def get_photos(self, obj):
        request = self.context.get("request")
        out = []
        for ph in obj.photos.all():
            if ph.image:
                out.append(photo_urls(request, ph.image).get("url") or "")
        return out


class VmenuRecipeDetailSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    category = VmenuCategorySerializer(read_only=True)
    cuisine = VmenuCuisineSerializer(read_only=True)
    cover_url = serializers.SerializerMethodField()
    extra_photo_urls = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    ingredients = VmenuIngredientSerializer(many=True, read_only=True)
    steps = VmenuStepSerializer(many=True, read_only=True)
    comments = VmenuCommentSerializer(many=True, read_only=True)
    my_rating = serializers.SerializerMethodField()

    class Meta:
        model = VmenuRecipe
        fields = (
            "id",
            "title",
            "description",
            "source_url",
            "status",
            "servings",
            "author",
            "category",
            "cuisine",
            "cover_url",
            "extra_photo_urls",
            "video_url",
            "view_count",
            "like_count",
            "save_count",
            "comment_count",
            "avg_rating",
            "my_rating",
            "published_at",
            "ingredients",
            "steps",
            "comments",
        )

    def get_author(self, obj):
        return _user_public(obj.author, self.context.get("request"))

    def get_cover_url(self, obj):
        if not obj.cover_image:
            return ""
        return photo_urls(self.context.get("request"), obj.cover_image).get("url") or ""

    def get_extra_photo_urls(self, obj):
        request = self.context.get("request")
        urls = []
        for ph in obj.extra_photos.all()[:4]:
            if ph.image:
                urls.append(photo_urls(request, ph.image).get("url") or "")
        return urls

    def get_video_url(self, obj):
        if not obj.video:
            return ""
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.video.url)
        return obj.video.url

    def get_my_rating(self, obj):
        request = self.context.get("request")
        if not request or not request.user.is_authenticated:
            return 0
        row = obj.comments.filter(user=request.user, rating__gt=0, parent__isnull=True).first()
        return row.rating if row else 0

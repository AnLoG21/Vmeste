from rest_framework import serializers

from common.media_urls import photo_urls

from .models import (
    VmenuCategory,
    VmenuComment,
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


class VmenuIngredientSerializer(serializers.ModelSerializer):
    class Meta:
        model = VmenuIngredient
        fields = ("id", "name", "amount", "unit", "sort_order")


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

    class Meta:
        model = VmenuComment
        fields = ("id", "user", "text", "rating", "photos", "parent_id", "reply_to_user", "created_at")

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
    cover_url = serializers.SerializerMethodField()
    extra_photo_urls = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    ingredients = VmenuIngredientSerializer(many=True, read_only=True)
    steps = VmenuStepSerializer(many=True, read_only=True)
    comments = VmenuCommentSerializer(many=True, read_only=True)

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
            "cover_url",
            "extra_photo_urls",
            "video_url",
            "view_count",
            "like_count",
            "save_count",
            "comment_count",
            "avg_rating",
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

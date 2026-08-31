from django.conf import settings
from django.db import models
from django.utils import timezone


class VmenuProfile(models.Model):
    class MessagePolicy(models.TextChoices):
        EVERYONE = "everyone", "Все"
        FOLLOWERS = "followers", "Только подписчики"
        NOBODY = "nobody", "Никто"

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmenu_profile",
    )
    avatar = models.ImageField(upload_to="vmenu/avatars/%Y/%m/", blank=True, null=True)
    bio = models.TextField(blank=True, default="")
    allow_messages = models.CharField(
        max_length=20,
        choices=MessagePolicy.choices,
        default=MessagePolicy.FOLLOWERS,
    )
    interest_tags = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"VmenuProfile({self.user_id})"


class VmenuCategory(models.Model):
    name = models.CharField(max_length=80)
    slug = models.SlugField(max_length=80, unique=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self) -> str:
        return self.name


class VmenuRecipe(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        PUBLISHED = "published", "Опубликован"
        BOOK_ONLY = "book_only", "Только в книге"

    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmenu_recipes",
    )
    category = models.ForeignKey(
        VmenuCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recipes",
    )
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default="")
    source_url = models.URLField(blank=True, default="")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DRAFT)
    cover_image = models.ImageField(upload_to="vmenu/recipes/%Y/%m/", blank=True, null=True)
    video = models.FileField(upload_to="vmenu/videos/%Y/%m/", blank=True, null=True)
    servings = models.PositiveSmallIntegerField(default=4)
    view_count = models.PositiveIntegerField(default=0)
    like_count = models.PositiveIntegerField(default=0)
    save_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)
    avg_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-published_at", "-created_at"]

    def publish(self):
        self.status = self.Status.PUBLISHED
        if not self.published_at:
            self.published_at = timezone.now()

    def __str__(self) -> str:
        return self.title


class VmenuRecipePhoto(models.Model):
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="extra_photos")
    image = models.ImageField(upload_to="vmenu/recipes/%Y/%m/")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class VmenuIngredient(models.Model):
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="ingredients")
    name = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=10, decimal_places=3, default=0)
    unit = models.CharField(max_length=40, blank=True, default="")
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class VmenuStep(models.Model):
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="steps")
    text = models.TextField()
    image = models.ImageField(upload_to="vmenu/steps/%Y/%m/", blank=True, null=True)
    sort_order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "id"]


class VmenuLike(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vmenu_likes")
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "recipe")]


class VmenuSave(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vmenu_saves")
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="saves")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("user", "recipe")]


class VmenuComment(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="vmenu_comments")
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="comments")
    text = models.TextField(blank=True, default="")
    rating = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class VmenuCommentPhoto(models.Model):
    comment = models.ForeignKey(VmenuComment, on_delete=models.CASCADE, related_name="photos")
    image = models.ImageField(upload_to="vmenu/comments/%Y/%m/")


class VmenuFollow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmenu_following",
    )
    following = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vmenu_followers",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("follower", "following")]


class VmenuRecipeView(models.Model):
    recipe = models.ForeignKey(VmenuRecipe, on_delete=models.CASCADE, related_name="views")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

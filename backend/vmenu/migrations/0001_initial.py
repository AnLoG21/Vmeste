# Generated manually for Вменю recipe social network

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


DEFAULT_CATEGORIES = [
    ("breakfast", "Завтраки", 1),
    ("lunch", "Обеды", 2),
    ("dinner", "Ужины", 3),
    ("desserts", "Десерты", 4),
    ("bakery", "Выпечка", 5),
    ("soups", "Супы", 6),
    ("salads", "Салаты", 7),
    ("drinks", "Напитки", 8),
    ("prep", "Заготовки", 9),
]


def seed_categories(apps, schema_editor):
    VmenuCategory = apps.get_model("vmenu", "VmenuCategory")
    for slug, name, order in DEFAULT_CATEGORIES:
        VmenuCategory.objects.get_or_create(slug=slug, defaults={"name": name, "sort_order": order})


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="VmenuCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=80)),
                ("slug", models.SlugField(max_length=80, unique=True)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
            ],
            options={"ordering": ["sort_order", "name"]},
        ),
        migrations.CreateModel(
            name="VmenuProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("avatar", models.ImageField(blank=True, null=True, upload_to="vmenu/avatars/%Y/%m/")),
                ("bio", models.TextField(blank=True, default="")),
                (
                    "allow_messages",
                    models.CharField(
                        choices=[("everyone", "Все"), ("followers", "Только подписчики"), ("nobody", "Никто")],
                        default="followers",
                        max_length=20,
                    ),
                ),
                ("interest_tags", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vmenu_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="VmenuRecipe",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("source_url", models.URLField(blank=True, default="")),
                (
                    "status",
                    models.CharField(
                        choices=[("draft", "Черновик"), ("published", "Опубликован"), ("book_only", "Только в книге")],
                        default="draft",
                        max_length=20,
                    ),
                ),
                ("cover_image", models.ImageField(blank=True, null=True, upload_to="vmenu/recipes/%Y/%m/")),
                ("video", models.FileField(blank=True, null=True, upload_to="vmenu/videos/%Y/%m/")),
                ("servings", models.PositiveSmallIntegerField(default=4)),
                ("view_count", models.PositiveIntegerField(default=0)),
                ("like_count", models.PositiveIntegerField(default=0)),
                ("save_count", models.PositiveIntegerField(default=0)),
                ("comment_count", models.PositiveIntegerField(default=0)),
                ("avg_rating", models.DecimalField(decimal_places=2, default=0, max_digits=3)),
                ("published_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "author",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vmenu_recipes",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "category",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recipes",
                        to="vmenu.vmenucategory",
                    ),
                ),
            ],
            options={"ordering": ["-published_at", "-created_at"]},
        ),
        migrations.CreateModel(
            name="VmenuStep",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField()),
                ("image", models.ImageField(blank=True, null=True, upload_to="vmenu/steps/%Y/%m/")),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "recipe",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="steps", to="vmenu.vmenurecipe"),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="VmenuRecipePhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="vmenu/recipes/%Y/%m/")),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "recipe",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="extra_photos", to="vmenu.vmenurecipe"
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="VmenuIngredient",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("amount", models.DecimalField(decimal_places=3, default=0, max_digits=10)),
                ("unit", models.CharField(blank=True, default="", max_length=40)),
                ("sort_order", models.PositiveSmallIntegerField(default=0)),
                (
                    "recipe",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="ingredients", to="vmenu.vmenurecipe"
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="VmenuComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(blank=True, default="")),
                ("rating", models.PositiveSmallIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "recipe",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="vmenu.vmenurecipe"
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vmenu_comments",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="VmenuCommentPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="vmenu/comments/%Y/%m/")),
                (
                    "comment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="photos", to="vmenu.vmenucomment"
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="VmenuLike",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "recipe",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="likes", to="vmenu.vmenurecipe"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="vmenu_likes", to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"unique_together": {("user", "recipe")}},
        ),
        migrations.CreateModel(
            name="VmenuSave",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "recipe",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saves", to="vmenu.vmenurecipe"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE, related_name="vmenu_saves", to=settings.AUTH_USER_MODEL
                    ),
                ),
            ],
            options={"unique_together": {("user", "recipe")}},
        ),
        migrations.CreateModel(
            name="VmenuFollow",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "follower",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vmenu_following",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "following",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="vmenu_followers",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"unique_together": {("follower", "following")}},
        ),
        migrations.CreateModel(
            name="VmenuRecipeView",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "recipe",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="views", to="vmenu.vmenurecipe"),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
    ]

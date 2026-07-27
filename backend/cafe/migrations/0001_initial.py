# Generated manually for cafe app
import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CafeSettings",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("enable_dine_in", models.BooleanField(default=True)),
                ("enable_takeaway", models.BooleanField(default=True)),
                ("enable_delivery", models.BooleanField(default=False)),
                ("delivery_info", models.TextField(blank=True, default="")),
                ("delivery_fee", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("delivery_min_order", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("accept_online_payment", models.BooleanField(default=True)),
                ("accept_cash", models.BooleanField(default=True)),
                ("accept_card_on_spot", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cafe_settings",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="CafeFloorPlan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(default="Основной зал", max_length=120)),
                ("width", models.PositiveIntegerField(default=800)),
                ("height", models.PositiveIntegerField(default=600)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cafe_floor_plans",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["id"]},
        ),
        migrations.CreateModel(
            name="CafeTable",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("label", models.CharField(default="Стол", max_length=64)),
                ("x", models.FloatField(default=40)),
                ("y", models.FloatField(default=40)),
                ("width", models.FloatField(default=80)),
                ("height", models.FloatField(default=80)),
                ("rotation", models.FloatField(default=0)),
                (
                    "seats",
                    models.PositiveSmallIntegerField(
                        default=2,
                        validators=[
                            django.core.validators.MinValueValidator(1),
                            django.core.validators.MaxValueValidator(30),
                        ],
                    ),
                ),
                (
                    "pin_code",
                    models.CharField(
                        default="000000",
                        max_length=6,
                        validators=[
                            django.core.validators.RegexValidator("^\\d{6}$", "Пароль стола — ровно 6 цифр.")
                        ],
                    ),
                ),
                ("public_token", models.CharField(blank=True, db_index=True, max_length=32, unique=True)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "floor_plan",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="tables",
                        to="cafe.cafefloorplan",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="CafeMenuCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                (
                    "is_novelties",
                    models.BooleanField(default=False, help_text="Категория «Новинки» — показывается первой."),
                ),
                ("is_active", models.BooleanField(default=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cafe_menu_categories",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-is_novelties", "sort_order", "id"], "verbose_name_plural": "cafe menu categories"},
        ),
        migrations.CreateModel(
            name="CafeMenuItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("description", models.TextField(blank=True, default="")),
                ("composition", models.TextField(blank=True, default="", help_text="Состав")),
                ("weight_grams", models.PositiveIntegerField(blank=True, null=True)),
                ("calories", models.PositiveIntegerField(blank=True, null=True)),
                ("price", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("is_new", models.BooleanField(default=False)),
                ("is_active", models.BooleanField(default=True)),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "category",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="cafe.cafemenucategory",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="CafeMenuItemPhoto",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("image", models.ImageField(upload_to="cafe_menu/%Y/%m/")),
                ("sort_order", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "item",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="photos",
                        to="cafe.cafemenuitem",
                    ),
                ),
            ],
            options={"ordering": ["sort_order", "id"]},
        ),
        migrations.CreateModel(
            name="CafeGuestSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token", models.CharField(db_index=True, max_length=64, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                (
                    "table",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="sessions",
                        to="cafe.cafetable",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="CafeOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "mode",
                    models.CharField(
                        choices=[
                            ("dine_in", "За столом"),
                            ("takeaway", "Самовывоз"),
                            ("delivery", "Доставка"),
                        ],
                        default="dine_in",
                        max_length=20,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Черновик"),
                            ("awaiting_payment", "Ожидает оплаты"),
                            ("paid", "Оплачен"),
                            ("accepted", "Принят"),
                            ("cooking", "Готовится"),
                            ("ready", "Готов"),
                            ("delivering", "Доставляется"),
                            ("done", "Завершён"),
                            ("cancelled", "Отменён"),
                        ],
                        default="draft",
                        max_length=30,
                    ),
                ),
                (
                    "pay_method",
                    models.CharField(
                        choices=[
                            ("online", "Онлайн"),
                            ("cash", "Наличные"),
                            ("card_on_spot", "Картой на месте"),
                        ],
                        default="online",
                        max_length=20,
                    ),
                ),
                ("guest_name", models.CharField(blank=True, default="", max_length=120)),
                ("guest_phone", models.CharField(blank=True, default="", max_length=30)),
                ("delivery_address", models.TextField(blank=True, default="")),
                ("comment", models.TextField(blank=True, default="")),
                ("items_total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("delivery_fee", models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ("total", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ("yookassa_payment_id", models.CharField(blank=True, db_index=True, default="", max_length=64)),
                ("confirmation_url", models.URLField(blank=True, default="")),
                ("guest_session_token", models.CharField(blank=True, default="", max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("paid_at", models.DateTimeField(blank=True, null=True)),
                (
                    "provider",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="cafe_orders",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "table",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="orders",
                        to="cafe.cafetable",
                    ),
                ),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="CafeOrderItem",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=180)),
                ("unit_price", models.DecimalField(decimal_places=2, max_digits=10)),
                (
                    "quantity",
                    models.PositiveSmallIntegerField(
                        default=1, validators=[django.core.validators.MinValueValidator(1)]
                    ),
                ),
                (
                    "menu_item",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="order_lines",
                        to="cafe.cafemenuitem",
                    ),
                ),
                (
                    "order",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="items",
                        to="cafe.cafeorder",
                    ),
                ),
            ],
        ),
    ]

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Brand(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140, unique=True)
    notes = models.TextField(blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name, allow_unicode=False) or "brand"
            slug = base[:120]
            n = 1
            while Brand.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base[:100]}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)


class CarModel(models.Model):
    brand = models.ForeignKey(Brand, on_delete=models.CASCADE, related_name="models")
    name = models.CharField(max_length=160)
    slug = models.SlugField(max_length=180)
    years = models.CharField(max_length=64, blank=True, default="")
    head_unit = models.CharField(max_length=200, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "name"]
        unique_together = [("brand", "slug")]

    def __str__(self):
        return f"{self.brand.name} {self.name}"

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name, allow_unicode=False) or "model"
            slug = base[:160]
            n = 1
            while CarModel.objects.filter(brand=self.brand, slug=slug).exclude(pk=self.pk).exists():
                n += 1
                slug = f"{base[:140]}-{n}"
            self.slug = slug
        super().save(*args, **kwargs)


class Guide(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        PUBLISHED = "published", "Опубликован"

    class Category(models.TextChoices):
        IDENTIFY = "identify", "Определение версии / платформы"
        PREP = "prep", "Подготовка и бэкап"
        FIRMWARE = "firmware", "Сток / обновление прошивки"
        COMMUNITY = "community", "Community / кастом-пакет"
        RUSSIFY = "russify", "Русификация"
        CARPLAY = "carplay", "Apple CarPlay"
        ANDROID_AUTO = "android_auto", "Android Auto"
        APPS = "apps", "Приложения и допы"
        ROLLBACK = "rollback", "Откат в сток"
        OTHER = "other", "Другое"

    class RiskLevel(models.TextChoices):
        LOW = "low", "Низкий"
        MEDIUM = "medium", "Средний"
        HIGH = "high", "Высокий"
        CRITICAL = "critical", "Критический (риск кирпича)"

    class Verified(models.TextChoices):
        UNVERIFIED = "unverified", "Не проверено"
        COMMUNITY = "community", "По отчётам сообщества"
        CROSSCHECKED = "crosschecked", "Сверено по 2+ источникам"
        BLOCKED = "blocked", "Заблокировано (опасно / неясно)"

    car_model = models.ForeignKey(CarModel, on_delete=models.CASCADE, related_name="guides")
    title = models.CharField(max_length=240)
    summary = models.TextField(blank=True, default="")
    category = models.CharField(
        max_length=32,
        choices=Category.choices,
        default=Category.OTHER,
        db_index=True,
    )
    risk_level = models.CharField(
        max_length=16,
        choices=RiskLevel.choices,
        default=RiskLevel.MEDIUM,
        db_index=True,
    )
    verified = models.CharField(
        max_length=16,
        choices=Verified.choices,
        default=Verified.UNVERIFIED,
        db_index=True,
    )
    brick_warning = models.TextField(
        blank=True,
        default="",
        help_text="Явные стоп-условия, при которых нельзя продолжать (кирпич).",
    )
    file_manifest = models.TextField(
        blank=True,
        default="",
        help_text="Список файлов, которые должны быть приложены к гайду.",
    )
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    source_url = models.URLField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="vmagnitol_guides",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["sort_order", "category", "title"]

    def __str__(self):
        return self.title


class GuideStep(models.Model):
    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="steps")
    order = models.PositiveIntegerField(default=1, db_index=True)
    title = models.CharField(max_length=240)
    body = models.TextField(blank=True, default="")
    warning = models.TextField(blank=True, default="")
    stop_if = models.TextField(
        blank=True,
        default="",
        help_text="Условие STOP: если истинно — не переходить к следующему шагу.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.order}. {self.title}"


class GuideFile(models.Model):
    class Role(models.TextChoices):
        MANIFEST = "manifest", "Манифест / чеклист"
        TOOL = "tool", "Инструмент"
        FIRMWARE = "firmware", "Прошивка / образ"
        PACKAGE = "package", "Пакет установки"
        APK = "apk", "APK"
        DOC = "doc", "Документация"
        OTHER = "other", "Другое"

    guide = models.ForeignKey(Guide, on_delete=models.CASCADE, related_name="files")
    step = models.ForeignKey(
        GuideStep,
        on_delete=models.CASCADE,
        related_name="files",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=200, blank=True, default="")
    file = models.FileField(upload_to="vmagnitol/files/%Y/%m/", blank=True, default="")
    external_url = models.URLField(
        blank=True,
        default="",
        help_text="Ссылка на файл, если бинарник нельзя хранить у нас (бот/облако автора).",
    )
    role = models.CharField(
        max_length=16,
        choices=Role.choices,
        default=Role.OTHER,
        db_index=True,
    )
    is_required = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default="")
    original_name = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-is_required", "role", "-created_at"]

    def __str__(self):
        return self.title or self.original_name or f"file-{self.pk}"

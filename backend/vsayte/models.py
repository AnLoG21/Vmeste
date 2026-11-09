from django.conf import settings
from django.db import models
from django.utils.text import slugify


class Site(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Черновик"
        PUBLISHED = "published", "Опубликован"
        UNPUBLISHED = "unpublished", "Снят с публикации"

    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="vsayte_sites",
    )
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=80, unique=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    document = models.JSONField(default=dict, blank=True)
    template_id = models.CharField(max_length=64, blank=True, default="")
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.title} ({self.slug})"

    def ensure_slug(self):
        if self.slug:
            return
        base = slugify(self.title, allow_unicode=False) or "site"
        base = base[:60]
        candidate = base
        n = 1
        while Site.objects.filter(slug=candidate).exclude(pk=self.pk).exists():
            n += 1
            candidate = f"{base}-{n}"
        self.slug = candidate


class SiteAsset(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="assets")
    file = models.FileField(upload_to="vsayte/assets/%Y/%m/")
    original_name = models.CharField(max_length=255, blank=True, default="")
    content_type = models.CharField(max_length=120, blank=True, default="")
    size_bytes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]


class SiteDomain(models.Model):
    class Kind(models.TextChoices):
        SUBDOMAIN = "subdomain", "Поддомен"
        CUSTOM = "custom", "Свой домен"

    class Status(models.TextChoices):
        PENDING = "pending", "Ожидает"
        ACTIVE = "active", "Активен"
        ERROR = "error", "Ошибка"

    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="domains")
    kind = models.CharField(max_length=16, choices=Kind.choices)
    hostname = models.CharField(max_length=253, unique=True)
    status = models.CharField(
        max_length=16,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )
    regru_order_id = models.CharField(max_length=64, blank=True, default="")
    regru_service_id = models.CharField(max_length=64, blank=True, default="")
    last_error = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.hostname


class SitePublish(models.Model):
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name="publishes")
    version = models.PositiveIntegerField(default=1)
    storage_path = models.CharField(max_length=500)
    checksum = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        unique_together = [("site", "version")]

from rest_framework import serializers

from .models import Site, SiteAsset, SiteDomain, SitePublish


class SiteDomainSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteDomain
        fields = [
            "id",
            "kind",
            "hostname",
            "status",
            "regru_order_id",
            "regru_service_id",
            "last_error",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class SitePublishSerializer(serializers.ModelSerializer):
    class Meta:
        model = SitePublish
        fields = ["id", "version", "storage_path", "checksum", "created_at"]
        read_only_fields = fields


class SiteAssetSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = SiteAsset
        fields = [
            "id",
            "original_name",
            "content_type",
            "size_bytes",
            "url",
            "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return ""
        url = obj.file.url
        if request:
            return request.build_absolute_uri(url)
        return url


class SiteListSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()
    domains = SiteDomainSerializer(many=True, read_only=True)

    class Meta:
        model = Site
        fields = [
            "id",
            "title",
            "slug",
            "status",
            "template_id",
            "published_at",
            "created_at",
            "updated_at",
            "public_url",
            "domains",
        ]
        read_only_fields = fields

    def get_public_url(self, obj):
        from django.conf import settings

        if obj.status != Site.Status.PUBLISHED:
            return ""
        base = getattr(settings, "VSAYTE_BASE_DOMAIN", "vsayte.vsevmeste.space")
        custom = obj.domains.filter(kind=SiteDomain.Kind.CUSTOM, status=SiteDomain.Status.ACTIVE).first()
        if custom:
            return f"https://{custom.hostname}"
        return f"https://{obj.slug}.{base}"


class SiteDetailSerializer(SiteListSerializer):
    document = serializers.JSONField()
    latest_publish = serializers.SerializerMethodField()

    class Meta(SiteListSerializer.Meta):
        fields = SiteListSerializer.Meta.fields + ["document", "latest_publish"]

    def get_latest_publish(self, obj):
        pub = obj.publishes.order_by("-version").first()
        if not pub:
            return None
        return SitePublishSerializer(pub).data


class SiteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = ["title", "slug", "document", "template_id"]

    def validate_slug(self, value):
        value = (value or "").strip().lower()
        if not value:
            return value
        qs = Site.objects.filter(slug=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Этот адрес уже занят.")
        return value

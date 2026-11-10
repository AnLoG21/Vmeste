from rest_framework import serializers

from .models import Site, SiteAsset, SiteDomain, SiteLead, SitePublish


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
    unread_leads = serializers.SerializerMethodField()

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
            "unread_leads",
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

    def get_unread_leads(self, obj):
        # annotate if present, else query
        if hasattr(obj, "unread_leads_count"):
            return int(obj.unread_leads_count or 0)
        return obj.leads.filter(is_read=False).count()


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


class SiteLeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteLead
        fields = [
            "id",
            "name",
            "contact",
            "message",
            "payload",
            "page_url",
            "is_read",
            "created_at",
        ]
        read_only_fields = fields


class SiteLeadCreateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False, allow_blank=True, max_length=200)
    contact = serializers.CharField(required=False, allow_blank=True, max_length=200)
    message = serializers.CharField(required=False, allow_blank=True, max_length=4000)
    page_url = serializers.CharField(required=False, allow_blank=True, max_length=500)
    payload = serializers.DictField(required=False)

    def validate(self, attrs):
        contact = (attrs.get("contact") or "").strip()
        name = (attrs.get("name") or "").strip()
        message = (attrs.get("message") or "").strip()
        payload = attrs.get("payload") or {}
        if not contact and not name and not message and not payload:
            raise serializers.ValidationError("Пустая заявка.")
        attrs["contact"] = contact
        attrs["name"] = name
        attrs["message"] = message
        return attrs

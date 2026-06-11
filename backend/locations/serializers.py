from rest_framework import serializers

from users.models import User

from .models import ProviderLocation


class ProviderLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderLocation
        fields = "__all__"
        read_only_fields = ["provider"]


class ProviderLocationClientSerializer(serializers.ModelSerializer):
    """Точки на карте для клиента: организация, сфера, диапазон цен услуг."""

    organization_name = serializers.CharField(source="provider.organization_name", read_only=True)
    provider_sphere = serializers.CharField(source="provider.provider_sphere", read_only=True)
    sphere_label = serializers.SerializerMethodField()
    min_service_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)
    max_service_price = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True, allow_null=True)

    is_main_office = serializers.BooleanField(read_only=True, default=False)
    provider_average_rating = serializers.FloatField(read_only=True, allow_null=True)
    provider_reviews_count = serializers.IntegerField(read_only=True, allow_null=True)
    provider_working_hours = serializers.JSONField(
        source="provider.organization_working_hours", read_only=True
    )
    provider_cover_url = serializers.SerializerMethodField()

    class Meta:
        model = ProviderLocation
        fields = [
            "id",
            "provider",
            "title",
            "address",
            "latitude",
            "longitude",
            "entrance",
            "floor",
            "apartment",
            "intercom",
            "address_details",
            "organization_name",
            "provider_sphere",
            "sphere_label",
            "provider_cover_url",
            "min_service_price",
            "max_service_price",
            "is_main_office",
            "provider_average_rating",
            "provider_reviews_count",
            "provider_working_hours",
        ]

    def get_provider_cover_url(self, obj):
        request = self.context.get("request")
        prov = getattr(obj, "provider", None)
        if not prov:
            return None
        cover_list = getattr(prov, "_gallery_cover_list", None)
        if cover_list is not None:
            photo = cover_list[0] if cover_list else None
        else:
            photo = prov.gallery_photos.order_by("sort_order", "id").first()
        if not photo or not photo.image:
            return None
        url = photo.image.url
        return request.build_absolute_uri(url) if request else url

    def get_sphere_label(self, obj):
        prov = getattr(obj, "provider", None)
        if not prov:
            return ""
        val = getattr(prov, "provider_sphere", None) or ""
        if not val:
            return ""
        return dict(User.ProviderSphere.choices).get(val, val)

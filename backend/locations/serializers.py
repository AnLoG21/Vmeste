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
            "min_service_price",
            "max_service_price",
            "is_main_office",
        ]

    def get_sphere_label(self, obj):
        prov = getattr(obj, "provider", None)
        if not prov:
            return ""
        val = getattr(prov, "provider_sphere", None) or ""
        if not val:
            return ""
        return dict(User.ProviderSphere.choices).get(val, val)

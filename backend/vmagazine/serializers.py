from rest_framework import serializers

from shop.serializers import ShopOrderSerializer

from .pickup_points import pickup_points_for_provider


class VmagazineOrderSerializer(ShopOrderSerializer):
    provider_name = serializers.SerializerMethodField()
    organization_slug = serializers.SerializerMethodField()
    shop_url = serializers.SerializerMethodField()
    pickup_address = serializers.SerializerMethodField()
    pickup_lat = serializers.SerializerMethodField()
    pickup_lon = serializers.SerializerMethodField()
    pickup_points = serializers.SerializerMethodField()

    class Meta(ShopOrderSerializer.Meta):
        fields = list(ShopOrderSerializer.Meta.fields) + [
            "provider_name",
            "organization_slug",
            "shop_url",
            "pickup_address",
            "pickup_lat",
            "pickup_lon",
            "pickup_points",
        ]

    def get_provider_name(self, obj):
        p = obj.provider
        if not p:
            return ""
        return p.organization_name or p.username

    def get_organization_slug(self, obj):
        p = obj.provider
        return (p.organization_slug or "") if p else ""

    def get_shop_url(self, obj):
        slug = self.get_organization_slug(obj)
        return f"/s/{slug}" if slug else ""

    def get_pickup_points(self, obj):
        return pickup_points_for_provider(obj.provider)

    def get_pickup_address(self, obj):
        points = self.get_pickup_points(obj)
        if not points:
            return ""
        main = next((p for p in points if p.get("is_main")), points[0])
        return main.get("address") or ""

    def get_pickup_lat(self, obj):
        points = self.get_pickup_points(obj)
        if not points:
            return None
        main = next((p for p in points if p.get("is_main")), points[0])
        return main.get("lat")

    def get_pickup_lon(self, obj):
        points = self.get_pickup_points(obj)
        if not points:
            return None
        main = next((p for p in points if p.get("is_main")), points[0])
        return main.get("lon")


def shop_card_from_provider(provider, *, is_favorite: bool, distance_m=None, avg=None, reviews_count=0):
    from users.models import User

    slug = provider.organization_slug or ""
    return {
        "id": provider.id,
        "organization_name": provider.organization_name or provider.username,
        "organization_slug": slug,
        "organization_address": provider.organization_address or "",
        "provider_sphere": provider.provider_sphere or "",
        "sphere_label": dict(User.ProviderSphere.choices).get(provider.provider_sphere or "", ""),
        "latitude": float(provider.organization_latitude) if provider.organization_latitude is not None else None,
        "longitude": float(provider.organization_longitude) if provider.organization_longitude is not None else None,
        "distance_m": distance_m,
        "shop_url": f"/s/{slug}" if slug else "",
        "is_favorite": bool(is_favorite),
        "average_rating": round(avg, 2) if avg is not None else None,
        "reviews_count": reviews_count or 0,
        "pickup_points": pickup_points_for_provider(provider),
    }

from rest_framework import serializers

from .models import Favorite, Listing, ListingPhoto, SavedSearch


class ListingPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ListingPhoto
        fields = ("id", "url", "sort_order")

    def get_url(self, obj: ListingPhoto) -> str:
        return obj.display_url or ""


class ListingListSerializer(serializers.ModelSerializer):
    photos = ListingPhotoSerializer(many=True, read_only=True)
    cover_url = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()
    rooms_label = serializers.SerializerMethodField()
    price_label = serializers.SerializerMethodField()
    can_chat = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = (
            "id",
            "deal_type",
            "rooms",
            "rooms_label",
            "price",
            "price_label",
            "currency",
            "area_m2",
            "floor",
            "floors_total",
            "address",
            "lat",
            "lon",
            "metro_name",
            "metro_walk_min",
            "source",
            "external_url",
            "is_agent",
            "realtor_id",
            "realtor_name",
            "realtor_phone",
            "can_chat",
            "cover_url",
            "photos",
            "is_favorite",
            "updated_at",
        )

    def get_cover_url(self, obj: Listing) -> str:
        photos = list(obj.photos.all()[:1])
        photo = photos[0] if photos else None
        return photo.display_url if photo else ""

    def get_is_favorite(self, obj: Listing) -> bool:
        fav_ids = self.context.get("favorite_ids")
        if fav_ids is None:
            return False
        return obj.id in fav_ids

    def get_rooms_label(self, obj: Listing) -> str:
        if obj.rooms == 0:
            return "Студия"
        if obj.rooms >= 5:
            return "5+"
        return f"{obj.rooms}-комн."

    def get_price_label(self, obj: Listing) -> str:
        n = int(obj.price or 0)
        formatted = f"{n:,}".replace(",", " ")
        if obj.deal_type == Listing.DealType.RENT:
            return f"{formatted} ₽/мес"
        return f"{formatted} ₽"

    def get_can_chat(self, obj: Listing) -> bool:
        return bool(obj.realtor_id)


class ListingDetailSerializer(ListingListSerializer):
    class Meta(ListingListSerializer.Meta):
        fields = ListingListSerializer.Meta.fields + (
            "description",
            "external_id",
            "fingerprint",
            "created_at",
            "realtor_email",
        )


class MapPinSerializer(serializers.ModelSerializer):
    cover_thumb = serializers.SerializerMethodField()
    price_short = serializers.SerializerMethodField()

    class Meta:
        model = Listing
        fields = ("id", "deal_type", "rooms", "price", "price_short", "lat", "lon", "cover_thumb")

    def get_cover_thumb(self, obj: Listing) -> str:
        photo = obj.photos.order_by("sort_order", "id").first()
        return photo.display_url if photo else ""

    def get_price_short(self, obj: Listing) -> str:
        n = int(obj.price or 0)
        if n >= 1_000_000:
            return f"{n / 1_000_000:.1f}".rstrip("0").rstrip(".") + " млн"
        if n >= 1000:
            return f"{n // 1000} тыс"
        return str(n)


class FavoriteSerializer(serializers.ModelSerializer):
    listing = ListingListSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ("id", "listing", "created_at")


class SavedSearchSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedSearch
        fields = ("id", "name", "filters", "notify", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

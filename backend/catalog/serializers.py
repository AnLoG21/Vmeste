from rest_framework import serializers

from common.media_urls import photo_urls
from reviews.models import ReviewPhoto

from .models import Service, ServiceCategory, ServiceOption, ServicePhoto, ServiceSubcategory


class ServicePhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    thumb_url = serializers.SerializerMethodField()

    class Meta:
        model = ServicePhoto
        fields = ["id", "image", "thumb_url", "sort_order"]

    def _urls(self, obj):
        request = self.context.get("request")
        return photo_urls(request, obj.image)

    def get_image(self, obj):
        return self._urls(obj)["url"]

    def get_thumb_url(self, obj):
        return self._urls(obj)["thumb_url"]


class ServiceOptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceOption
        fields = ["id", "service", "name", "price", "extra_minutes", "is_active", "sort_order", "template_slug"]
        read_only_fields = ["template_slug"]


class ServiceSubcategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceSubcategory
        fields = ["id", "name", "category", "template_slug"]
        read_only_fields = ["template_slug"]


class ServiceCategorySerializer(serializers.ModelSerializer):
    subcategories = ServiceSubcategorySerializer(many=True, read_only=True)

    class Meta:
        model = ServiceCategory
        fields = ["id", "name", "allow_subcategory_booking", "subcategories", "provider", "template_slug"]
        read_only_fields = ["provider", "template_slug"]


class ServiceSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    subcategory_name = serializers.CharField(source="subcategory.name", read_only=True)
    photos = ServicePhotoSerializer(many=True, read_only=True)
    options = ServiceOptionSerializer(many=True, read_only=True)
    review_photos = serializers.SerializerMethodField()
    gallery = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            "id",
            "provider",
            "category",
            "subcategory",
            "category_name",
            "subcategory_name",
            "name",
            "price",
            "duration_minutes",
            "is_active",
            "template_slug",
            "photos",
            "options",
            "review_photos",
            "gallery",
        ]
        read_only_fields = [
            "provider",
            "template_slug",
            "category_name",
            "subcategory_name",
            "photos",
            "options",
            "review_photos",
            "gallery",
        ]

    def get_review_photos(self, obj):
        request = self.context.get("request")
        qs = (
            ReviewPhoto.objects.filter(review__booking__service_id=obj.id)
            .select_related("review")
            .order_by("-id")[:24]
        )
        out = []
        for ph in qs:
            urls = photo_urls(request, ph.image)
            if urls["url"]:
                out.append(
                    {
                        "id": f"review-{ph.id}",
                        "image": urls["url"],
                        "thumb_url": urls["thumb_url"],
                        "source": "review",
                    }
                )
        return out

    def get_gallery(self, obj):
        """Service photos first, then review photos for the same service."""
        request = self.context.get("request")
        items = []
        for ph in obj.photos.all()[:16]:
            urls = photo_urls(request, ph.image)
            if urls["url"]:
                items.append(
                    {
                        "id": ph.id,
                        "image": urls["url"],
                        "thumb_url": urls["thumb_url"],
                        "source": "service",
                    }
                )
        for rp in self.get_review_photos(obj):
            items.append(rp)
        return items

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and instance.template_slug:
            if "name" in attrs and attrs["name"] != instance.name:
                raise serializers.ValidationError({"name": "Название услуги из каталога сферы изменить нельзя."})
        return attrs

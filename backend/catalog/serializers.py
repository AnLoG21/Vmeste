from rest_framework import serializers

from reviews.models import ReviewPhoto

from .models import Service, ServiceCategory, ServicePhoto, ServiceSubcategory


class ServicePhotoSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()

    class Meta:
        model = ServicePhoto
        fields = ["id", "image", "sort_order"]

    def get_image(self, obj):
        request = self.context.get("request")
        url = obj.image.url if obj.image else ""
        if request and url and not url.startswith("http"):
            return request.build_absolute_uri(url)
        return url


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
            "review_photos",
            "gallery",
        ]
        read_only_fields = [
            "provider",
            "template_slug",
            "category_name",
            "subcategory_name",
            "photos",
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
            url = ph.image.url if ph.image else ""
            if request and url and not url.startswith("http"):
                url = request.build_absolute_uri(url)
            if url:
                out.append({"id": f"review-{ph.id}", "image": url, "source": "review"})
        return out

    def get_gallery(self, obj):
        """Service photos first, then review photos for the same service."""
        request = self.context.get("request")
        items = []
        for ph in obj.photos.all()[:16]:
            url = ph.image.url if ph.image else ""
            if request and url and not url.startswith("http"):
                url = request.build_absolute_uri(url)
            if url:
                items.append({"id": ph.id, "image": url, "source": "service"})
        for rp in self.get_review_photos(obj):
            items.append(rp)
        return items

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and instance.template_slug:
            if "name" in attrs and attrs["name"] != instance.name:
                raise serializers.ValidationError({"name": "Название услуги из каталога сферы изменить нельзя."})
        return attrs

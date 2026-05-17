from rest_framework import serializers

from .models import Service, ServiceCategory, ServiceSubcategory


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
        ]
        read_only_fields = ["provider", "template_slug", "category_name", "subcategory_name"]

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        if instance and instance.template_slug:
            if "name" in attrs and attrs["name"] != instance.name:
                raise serializers.ValidationError({"name": "Название услуги из каталога сферы изменить нельзя."})
        return attrs

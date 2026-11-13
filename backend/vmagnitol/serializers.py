from rest_framework import serializers

from .models import Brand, CarModel, Guide, GuideFile, GuideStep


class GuideFileSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = GuideFile
        fields = [
            "id",
            "guide",
            "step",
            "title",
            "original_name",
            "content_type",
            "size_bytes",
            "url",
            "external_url",
            "role",
            "is_required",
            "notes",
            "created_at",
        ]
        read_only_fields = fields

    def get_url(self, obj):
        request = self.context.get("request")
        if not obj.file:
            return obj.external_url or ""
        url = obj.file.url
        if request:
            return request.build_absolute_uri(url)
        return url


class GuideStepSerializer(serializers.ModelSerializer):
    files = GuideFileSerializer(many=True, read_only=True)

    class Meta:
        model = GuideStep
        fields = [
            "id",
            "guide",
            "order",
            "title",
            "body",
            "warning",
            "stop_if",
            "files",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "guide", "files", "created_at", "updated_at"]


class GuideListSerializer(serializers.ModelSerializer):
    steps_count = serializers.SerializerMethodField()
    files_count = serializers.SerializerMethodField()
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    risk_label = serializers.CharField(source="get_risk_level_display", read_only=True)
    verified_label = serializers.CharField(source="get_verified_display", read_only=True)

    class Meta:
        model = Guide
        fields = [
            "id",
            "car_model",
            "title",
            "summary",
            "category",
            "category_label",
            "risk_level",
            "risk_label",
            "verified",
            "verified_label",
            "brick_warning",
            "file_manifest",
            "sort_order",
            "status",
            "source_url",
            "steps_count",
            "files_count",
            "updated_at",
            "created_at",
        ]
        read_only_fields = fields

    def get_steps_count(self, obj):
        return obj.steps.count()

    def get_files_count(self, obj):
        return obj.files.count()


class GuideDetailSerializer(serializers.ModelSerializer):
    steps = GuideStepSerializer(many=True, read_only=True)
    files = GuideFileSerializer(many=True, read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    risk_label = serializers.CharField(source="get_risk_level_display", read_only=True)
    verified_label = serializers.CharField(source="get_verified_display", read_only=True)

    class Meta:
        model = Guide
        fields = [
            "id",
            "car_model",
            "title",
            "summary",
            "category",
            "category_label",
            "risk_level",
            "risk_label",
            "verified",
            "verified_label",
            "brick_warning",
            "file_manifest",
            "sort_order",
            "status",
            "source_url",
            "steps",
            "files",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "steps", "files", "created_at", "updated_at"]


class GuideWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Guide
        fields = [
            "title",
            "summary",
            "status",
            "source_url",
            "category",
            "risk_level",
            "verified",
            "brick_warning",
            "file_manifest",
            "sort_order",
        ]


class CarModelSerializer(serializers.ModelSerializer):
    guides = GuideListSerializer(many=True, read_only=True)
    brand_name = serializers.CharField(source="brand.name", read_only=True)

    class Meta:
        model = CarModel
        fields = [
            "id",
            "brand",
            "brand_name",
            "name",
            "slug",
            "years",
            "head_unit",
            "notes",
            "sort_order",
            "guides",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "brand_name", "guides", "updated_at"]


class BrandSerializer(serializers.ModelSerializer):
    models = CarModelSerializer(many=True, read_only=True)
    models_count = serializers.SerializerMethodField()

    class Meta:
        model = Brand
        fields = [
            "id",
            "name",
            "slug",
            "notes",
            "sort_order",
            "models_count",
            "models",
            "updated_at",
        ]
        read_only_fields = ["id", "slug", "models_count", "models", "updated_at"]

    def get_models_count(self, obj):
        return obj.models.count()


class BrandWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Brand
        fields = ["name", "notes", "sort_order"]


class CarModelWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = CarModel
        fields = ["name", "years", "head_unit", "notes", "sort_order"]

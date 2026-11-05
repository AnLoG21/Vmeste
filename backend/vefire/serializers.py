from rest_framework import serializers

from .models import CastRequest


class CastRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CastRequest
        fields = ("id", "url", "title", "status", "error", "created_at", "updated_at", "claimed_at", "finished_at")
        read_only_fields = fields


class CastCreateSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=2000)
    title = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")

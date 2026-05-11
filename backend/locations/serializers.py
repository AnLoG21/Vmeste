from rest_framework import serializers

from .models import ProviderLocation


class ProviderLocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProviderLocation
        fields = "__all__"
        read_only_fields = ["provider"]

from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import User


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "email_verified",
            "first_name",
            "last_name",
            "patronymic",
            "phone",
            "organization_name",
            "organization_address",
            "organization_latitude",
            "organization_longitude",
            "provider_sphere",
        ]
        read_only_fields = ["id", "username", "email", "role", "email_verified"]


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    organization_address_details = serializers.CharField(required=False, allow_blank=True, write_only=True)
    entrance = serializers.CharField(required=False, allow_blank=True, write_only=True)
    apartment = serializers.CharField(required=False, allow_blank=True, write_only=True)
    intercom = serializers.CharField(required=False, allow_blank=True, write_only=True)
    floor = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = User
        fields = [
            "username",
            "first_name",
            "last_name",
            "patronymic",
            "email",
            "phone",
            "role",
            "password",
            "password_confirm",
            "provider_sphere",
            "organization_name",
            "organization_address",
            "organization_latitude",
            "organization_longitude",
            "organization_address_details",
            "entrance",
            "apartment",
            "intercom",
            "floor",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm", None):
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        validate_password(attrs["password"])
        attrs.pop("organization_address_details", None)
        attrs.pop("entrance", None)
        attrs.pop("apartment", None)
        attrs.pop("intercom", None)
        attrs.pop("floor", None)
        return attrs

    def create(self, validated_data):
        pwd = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(pwd)
        if settings.SKIP_EMAIL_VERIFICATION:
            user.email_verified = True
        user.save()
        return user


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Пароли не совпадают."})
        validate_password(attrs["new_password"])
        return attrs


class ChangeEmailSerializer(serializers.Serializer):
    new_email = serializers.EmailField()

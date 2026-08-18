from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .legal_versions import OFFER_VERSION, PRIVACY_VERSION
from .models import ProviderGalleryPhoto, User


def _client_ip(request):
    if not request:
        return None
    forwarded = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    if forwarded:
        return forwarded[:45]
    return request.META.get("REMOTE_ADDR") or None


def _client_ua(request):
    if not request:
        return ""
    return (request.META.get("HTTP_USER_AGENT") or "")[:512]


class UserSerializer(serializers.ModelSerializer):
    has_usable_password = serializers.SerializerMethodField()

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
            "organization_entrance",
            "organization_floor",
            "organization_apartment",
            "organization_intercom",
            "organization_address_extra",
            "organization_latitude",
            "organization_longitude",
            "provider_sphere",
            "booking_confirm_message_default",
            "booking_cancel_message_default",
            "booking_done_message_default",
            "organization_working_hours",
            "organization_phones",
            "organization_websites",
            "organization_card_note",
            "anonymous_seat_count",
            "provider_license_number",
            "organization_slug",
            "is_demo",
            "notify_booking_reminders",
            "notify_booking_status",
            "telegram_chat_id",
            "has_usable_password",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "role",
            "email_verified",
            "organization_slug",
            "is_demo",
            "telegram_chat_id",
            "has_usable_password",
        ]

    def get_has_usable_password(self, obj):
        return obj.has_usable_password()

class ProviderGalleryPhotoSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProviderGalleryPhoto
        fields = ["id", "url", "sort_order", "created_at"]
        read_only_fields = ["id", "url", "created_at"]

    def get_url(self, obj):
        request = self.context.get("request")
        if obj.image and request:
            return request.build_absolute_uri(obj.image.url)
        if obj.image:
            return obj.image.url
        return ""


class UserRegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)
    first_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    last_name = serializers.CharField(required=True, allow_blank=False, max_length=150)
    organization_address_details = serializers.CharField(required=False, allow_blank=True, write_only=True)
    entrance = serializers.CharField(required=False, allow_blank=True, write_only=True)
    apartment = serializers.CharField(required=False, allow_blank=True, write_only=True)
    intercom = serializers.CharField(required=False, allow_blank=True, write_only=True)
    floor = serializers.CharField(required=False, allow_blank=True, write_only=True)
    accept_privacy = serializers.BooleanField(write_only=True)
    accept_offer = serializers.BooleanField(write_only=True)
    age_confirmed = serializers.BooleanField(write_only=True)
    confirm_provider_authority = serializers.BooleanField(write_only=True, required=False, default=False)
    provider_license_number = serializers.CharField(required=False, allow_blank=True, max_length=120)

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
            "accept_privacy",
            "accept_offer",
            "age_confirmed",
            "confirm_provider_authority",
            "provider_license_number",
        ]

    def validate_email(self, value):
        email = (value or "").strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("Пользователь с таким email уже зарегистрирован.")
        return email

    def validate_username(self, value):
        username = (value or "").strip()
        if User.objects.filter(username__iexact=username).exists():
            raise serializers.ValidationError("Пользователь с таким логином уже существует.")
        return username

    def validate_first_name(self, value):
        name = (value or "").strip()
        if len(name) < 1:
            raise serializers.ValidationError("Укажите имя.")
        return name

    def validate_last_name(self, value):
        name = (value or "").strip()
        if len(name) < 1:
            raise serializers.ValidationError("Укажите фамилию.")
        return name

    def validate_provider_license_number(self, value):
        return (value or "").strip()[:120]

    def validate(self, attrs):
        if attrs["password"] != attrs.pop("password_confirm", None):
            raise serializers.ValidationError({"password_confirm": "Пароли не совпадают."})
        validate_password(attrs["password"])
        if not attrs.pop("accept_privacy", False):
            raise serializers.ValidationError({"accept_privacy": "Нужно согласие с политикой конфиденциальности."})
        if not attrs.pop("accept_offer", False):
            raise serializers.ValidationError({"accept_offer": "Нужно принять публичную оферту."})
        if not attrs.pop("age_confirmed", False):
            raise serializers.ValidationError({"age_confirmed": "Подтвердите, что вам исполнилось 18 лет."})
        role = attrs.get("role") or User.Role.CLIENT
        confirm_authority = attrs.pop("confirm_provider_authority", False)
        if role == User.Role.PROVIDER:
            if not confirm_authority:
                raise serializers.ValidationError(
                    {
                        "confirm_provider_authority": (
                            "Подтвердите право оказывать услуги и наличие лицензии, если она требуется."
                        )
                    }
                )
            attrs["_provider_authority_confirmed"] = True
        else:
            attrs.pop("provider_license_number", None)
        return attrs

    def create(self, validated_data):
        from django.utils import timezone

        pwd = validated_data.pop("password")
        extra = validated_data.pop("organization_address_details", "") or ""
        entrance = validated_data.pop("entrance", "") or ""
        floor = validated_data.pop("floor", "") or ""
        apartment = validated_data.pop("apartment", "") or ""
        intercom = validated_data.pop("intercom", "") or ""
        authority_ok = validated_data.pop("_provider_authority_confirmed", False)
        now = timezone.now()
        request = self.context.get("request")
        user = User(**validated_data)
        user.organization_entrance = entrance
        user.organization_floor = floor
        user.organization_apartment = apartment
        user.organization_intercom = intercom
        user.organization_address_extra = extra
        user.consent_privacy_at = now
        user.consent_offer_at = now
        user.age_confirmed_at = now
        user.consent_privacy_version = PRIVACY_VERSION
        user.consent_offer_version = OFFER_VERSION
        user.consent_ip = _client_ip(request)
        user.consent_user_agent = _client_ua(request)
        if authority_ok:
            user.provider_authority_confirmed_at = now
        user.set_password(pwd)
        if settings.SKIP_EMAIL_VERIFICATION:
            user.email_verified = True
        user.save()
        if user.role == User.Role.PROVIDER:
            from .slug_utils import ensure_organization_slug
            from subscriptions.access import ensure_free_subscription

            ensure_organization_slug(user)
            ensure_free_subscription(user)
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


class PasswordResetConfirmSerializer(serializers.Serializer):
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    new_password_confirm = serializers.CharField()

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError({"new_password_confirm": "Пароли не совпадают."})
        validate_password(attrs["new_password"])
        return attrs


class ChangeEmailSerializer(serializers.Serializer):
    new_email = serializers.EmailField()


class AutomationRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30, required=False, allow_blank=True, default="")
    telegram = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    message = serializers.CharField(required=False, allow_blank=True, default="")
    accept_privacy = serializers.BooleanField(write_only=True)

    def validate_accept_privacy(self, value):
        if not value:
            raise serializers.ValidationError("Нужно согласие на обработку персональных данных.")
        return value

    def validate(self, attrs):
        attrs.pop("accept_privacy", None)
        attrs["privacy_version"] = PRIVACY_VERSION
        return attrs

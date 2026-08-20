from django.conf import settings
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        email = (getattr(self.user, "email", None) or "").strip()
        # OAuth без почты: email_verified=False, но вход по логину+паролю должен работать.
        if (
            not settings.SKIP_EMAIL_VERIFICATION
            and email
            and not self.user.email_verified
        ):
            raise serializers.ValidationError(
                {
                    "detail": (
                        "Подтвердите email перед входом. "
                        "Проверьте почту или зарегистрируйтесь повторно с корректным адресом."
                    )
                }
            )
        return data

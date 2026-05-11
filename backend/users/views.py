import secrets

from django.conf import settings
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .serializers import (
    ChangeEmailSerializer,
    ChangePasswordSerializer,
    UserRegisterSerializer,
    UserSerializer,
)


class RolesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = [
            {"key": "client", "value": "Клиент"},
            {"key": "provider", "value": "Исполнитель"},
            {"key": "staff", "value": "Сотрудник"},
        ]
        return Response(data)


class SpheresView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        data = [
            {"key": k, "value": v} for k, v in User.ProviderSphere.choices
        ]
        return Response(data)


class UserRegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = UserRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        if not user.email_verified and not settings.SKIP_EMAIL_VERIFICATION:
            user.email_verification_token = secrets.token_urlsafe(32)
            user.save(update_fields=["email_verification_token"])
        return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


class VerifyEmailView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        if not token:
            return Response({"detail": "token required"}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email_verification_token=token).first()
        if not user:
            return Response({"detail": "Неверный токен."}, status=status.HTTP_400_BAD_REQUEST)
        user.email_verified = True
        user.email_verification_token = ""
        user.save(update_fields=["email_verified", "email_verification_token"])
        return Response({"detail": "ok"})


class ResendVerificationView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"detail": "Письмо не настроено (dev)."})


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        full_name = " ".join(
            p for p in (u.last_name, u.first_name, getattr(u, "patronymic", "") or "") if p
        ).strip()
        data = UserSerializer(u).data
        data["full_name"] = full_name or u.username
        return Response(data)

    def patch(self, request):
        ser = UserSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return self.get(request)


class ChangePasswordView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        if not u.check_password(ser.validated_data["old_password"]):
            return Response({"old_password": ["Неверный пароль."]}, status=status.HTTP_400_BAD_REQUEST)
        u.set_password(ser.validated_data["new_password"])
        u.save(update_fields=["password"])
        return Response({"detail": "ok"})


class ChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangeEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        u.email = ser.validated_data["new_email"]
        u.email_verified = getattr(settings, "SKIP_EMAIL_VERIFICATION", False)
        u.save(update_fields=["email", "email_verified"])
        return Response({"detail": "ok"})

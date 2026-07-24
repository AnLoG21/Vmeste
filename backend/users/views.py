import secrets

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .email_service import (
    _can_send,
    load_password_change_token,
    make_password_change_token,
    send_automation_request_email,
    send_email_change_email,
    send_password_change_email,
    send_verification_email,
)
from .serializers import (
    AutomationRequestSerializer,
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
        data = [{"key": k, "value": v} for k, v in User.ProviderSphere.choices]
        return Response(data)


class UserRegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = UserRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        need_email = not settings.SKIP_EMAIL_VERIFICATION
        if need_email and not _can_send():
            return Response(
                {
                    "detail": "Регистрация временно недоступна: не настроена отправка писем. Аккаунт не создан."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        try:
            with transaction.atomic():
                user = ser.save()
                if need_email and not user.email_verified:
                    user.email_verification_token = secrets.token_urlsafe(32)
                    user.save(update_fields=["email_verification_token"])
                    sent = send_verification_email(user)
                    if not sent:
                        raise RuntimeError("email_not_sent")
                data = UserSerializer(user).data
                data["detail"] = (
                    "Регистрация успешна. Письмо с подтверждением отправлено на ваш email."
                    if need_email
                    else "Регистрация успешна."
                )
                return Response(data, status=status.HTTP_201_CREATED)
        except Exception:
            return Response(
                {
                    "detail": "Не удалось отправить письмо подтверждения. Аккаунт не создан. Попробуйте позже."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )


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
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email and request.user.is_authenticated:
            email = (request.user.email or "").strip().lower()
        if not email:
            return Response({"detail": "Укажите email."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({"detail": "Пользователь не найден."}, status=status.HTTP_404_NOT_FOUND)
        if user.email_verified:
            return Response({"detail": "Email уже подтверждён."})
        if settings.SKIP_EMAIL_VERIFICATION:
            user.email_verified = True
            user.save(update_fields=["email_verified"])
            return Response({"detail": "Email подтверждён (режим разработки)."})
        user.email_verification_token = secrets.token_urlsafe(32)
        user.save(update_fields=["email_verification_token"])
        sent = send_verification_email(user)
        if not sent:
            return Response(
                {"detail": "Почта не настроена на сервере. Обратитесь в поддержку."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"detail": "Письмо отправлено. Проверьте почту."})


class AutomationRequestView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = AutomationRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            sent = send_automation_request_email(**data)
        except Exception:
            return Response(
                {"detail": "Не удалось отправить заявку. Проверьте настройки почты на сервере."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sent:
            return Response(
                {"detail": "Сервис почты временно недоступен. Напишите на vmesteofficialsupport@gmail.com"},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"detail": "Заявка отправлена. Мы свяжемся с вами в ближайшее время."})


class PresencePingView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        User.objects.filter(pk=request.user.id).update(last_seen_at=timezone.now())
        return Response({"ok": True})


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
    """Request password change: validates old password and emails a confirmation link."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        if not u.check_password(ser.validated_data["old_password"]):
            return Response({"old_password": ["Неверный пароль."]}, status=status.HTTP_400_BAD_REQUEST)
        if settings.SKIP_EMAIL_VERIFICATION:
            u.set_password(ser.validated_data["new_password"])
            u.save(update_fields=["password"])
            return Response({"detail": "Пароль изменён."})
        if not _can_send():
            return Response(
                {"detail": "Почта не настроена. Смена пароля временно недоступна."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        token = make_password_change_token(u, ser.validated_data["new_password"])
        try:
            sent = send_password_change_email(u, token)
        except Exception:
            return Response(
                {"detail": "Не удалось отправить письмо. Пароль не изменён."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sent:
            return Response(
                {"detail": "Не удалось отправить письмо. Пароль не изменён."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(
            {
                "detail": "Мы отправили письмо на вашу почту. Перейдите по ссылке, чтобы подтвердить смену пароля."
            }
        )


class ConfirmPasswordChangeView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        token = (request.data.get("token") or "").strip()
        if not token:
            return Response({"detail": "token required"}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payload = load_password_change_token(token)
        except signing.BadSignature:
            return Response({"detail": "Ссылка недействительна или устарела."}, status=status.HTTP_400_BAD_REQUEST)
        except signing.SignatureExpired:
            return Response({"detail": "Ссылка устарела. Запросите смену пароля снова."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "Ссылка недействительна или устарела."}, status=status.HTTP_400_BAD_REQUEST)
        uid = payload.get("uid")
        new_password = payload.get("np") or ""
        user = User.objects.filter(pk=uid).first()
        if not user or not new_password:
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_password)
        user.save(update_fields=["password"])
        return Response({"detail": "Пароль успешно изменён. Можно войти с новым паролем."})


class ChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangeEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        new_email = ser.validated_data["new_email"].strip().lower()
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response(
                {"new_email": ["Пользователь с таким email уже зарегистрирован."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        u = request.user
        u.email = new_email
        if settings.SKIP_EMAIL_VERIFICATION:
            u.email_verified = True
            u.email_verification_token = ""
            u.save(update_fields=["email", "email_verified", "email_verification_token"])
            return Response({"detail": "ok"})
        if not _can_send():
            return Response(
                {"detail": "Почта не настроена. Смена email временно недоступна."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        u.email_verified = False
        u.email_verification_token = secrets.token_urlsafe(32)
        u.save(update_fields=["email", "email_verified", "email_verification_token"])
        try:
            sent = send_email_change_email(u)
        except Exception:
            return Response(
                {"detail": "Не удалось отправить письмо на новый адрес."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if not sent:
            return Response(
                {"detail": "Не удалось отправить письмо на новый адрес."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({"detail": "Email изменён. Подтвердите новый адрес по ссылке из письма (это письмо о смене почты)."})

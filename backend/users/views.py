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
    load_password_reset_token,
    make_password_change_token,
    make_password_reset_token,
    send_automation_request_email,
    send_email_change_email,
    send_password_change_email,
    send_password_reset_email,
    send_verification_email,
)
from .serializers import (
    AutomationRequestSerializer,
    ChangeEmailSerializer,
    ChangePasswordSerializer,
    PasswordResetConfirmSerializer,
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
        ser = UserRegisterSerializer(data=request.data, context={"request": request})
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
        if u.role == User.Role.PROVIDER:
            from .slug_utils import ensure_organization_slug

            ensure_organization_slug(u)
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


class DeleteAccountView(APIView):
    """Обезличить и деактивировать аккаунт по запросу пользователя (152-ФЗ)."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        password = (request.data.get("password") or "").strip()
        confirm = (request.data.get("confirm") or "").strip().lower()
        if confirm not in ("удалить", "delete"):
            return Response(
                {"detail": "Для подтверждения введите слово «удалить»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = request.user
        if getattr(user, "is_demo", False):
            return Response(
                {"detail": "Демо-аккаунт нельзя удалить."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if not password or not user.check_password(password):
            if user.has_usable_password():
                return Response({"password": ["Неверный пароль."]}, status=status.HTTP_400_BAD_REQUEST)
        if user.role == User.Role.PROVIDER:
            # Не даём удалить организацию с активной подпиской без явного предупреждения —
            # данные обезличиваются, доступ закрывается.
            pass
        now = timezone.now()
        uid = user.id
        user.first_name = "Удалён"
        user.last_name = ""
        user.patronymic = ""
        user.phone = ""
        user.email = f"deleted_{uid}@deleted.local"
        user.username = f"deleted_{uid}"
        user.organization_name = ""
        user.organization_address = ""
        user.organization_entrance = ""
        user.organization_floor = ""
        user.organization_apartment = ""
        user.organization_intercom = ""
        user.organization_address_extra = ""
        user.organization_latitude = None
        user.organization_longitude = None
        user.organization_card_note = ""
        user.organization_phones = []
        user.organization_websites = []
        user.organization_working_hours = {}
        user.provider_license_number = ""
        user.email_verification_token = ""
        user.telegram_chat_id = ""
        user.telegram_link_token = ""
        user.max_user_id = ""
        user.yandex_id = ""
        user.vk_id = ""
        user.is_active = False
        user.account_deleted_at = now
        user.set_unusable_password()
        user.save()
        try:
            user.gallery_photos.all().delete()
        except Exception:
            pass
        try:
            from notifications.models import DevicePushToken

            DevicePushToken.objects.filter(user_id=uid).delete()
        except Exception:
            pass
        return Response({"detail": "Аккаунт удалён. Данные обезличены."})


class ChangePasswordView(APIView):
    """Request password change: validates old password and emails a confirmation link."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        u = request.user
        if getattr(u, "is_demo", False):
            return Response(
                {"detail": "В демо-режиме пароль менять нельзя."},
                status=status.HTTP_403_FORBIDDEN,
            )
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


RESET_SENT_DETAIL = "Если аккаунт с этой почтой есть, мы отправили ссылку для сброса пароля."


class RequestPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = None
        if request.user and request.user.is_authenticated:
            if getattr(request.user, "is_demo", False):
                return Response(
                    {"detail": "В демо-режиме пароль сбрасывать нельзя."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            user = request.user
        else:
            email = str((request.data or {}).get("email") or "").strip().lower()
            if email:
                user = User.objects.filter(email__iexact=email, is_active=True).exclude(is_demo=True).first()

        if user and (user.email or "").strip():
            if not _can_send() and not settings.SKIP_EMAIL_VERIFICATION:
                return Response(
                    {"detail": "Почта не настроена. Сброс пароля временно недоступен."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            if _can_send():
                token = make_password_reset_token(user)
                try:
                    sent = send_password_reset_email(user, token)
                except Exception:
                    if request.user and request.user.is_authenticated:
                        return Response(
                            {"detail": "Не удалось отправить письмо. Попробуйте позже."},
                            status=status.HTTP_503_SERVICE_UNAVAILABLE,
                        )
                    sent = False
                if not sent and request.user and request.user.is_authenticated:
                    return Response(
                        {"detail": "Не удалось отправить письмо. Попробуйте позже."},
                        status=status.HTTP_503_SERVICE_UNAVAILABLE,
                    )
            elif settings.SKIP_EMAIL_VERIFICATION and request.user and request.user.is_authenticated:
                return Response(
                    {"detail": "На сервере отключена почта. Задайте новый пароль формой выше, указав текущий."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        if request.user and request.user.is_authenticated:
            if not (request.user.email or "").strip():
                return Response({"detail": "У аккаунта нет почты — сброс недоступен."}, status=status.HTTP_400_BAD_REQUEST)
            return Response(
                {"detail": "Мы отправили ссылку для сброса пароля на вашу почту. Перейдите по ней в течение 24 часов."}
            )
        return Response({"detail": RESET_SENT_DETAIL})


class ConfirmPasswordResetView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = PasswordResetConfirmSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        token = ser.validated_data["token"]
        try:
            payload = load_password_reset_token(token)
        except signing.BadSignature:
            return Response({"detail": "Ссылка недействительна или устарела."}, status=status.HTTP_400_BAD_REQUEST)
        except signing.SignatureExpired:
            return Response({"detail": "Ссылка устарела. Запросите сброс пароля снова."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception:
            return Response({"detail": "Ссылка недействительна или устарела."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(pk=payload.get("uid"), is_active=True).first()
        if not user or getattr(user, "is_demo", False):
            return Response({"detail": "Ссылка недействительна."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(ser.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Пароль обновлён. Войдите с новым паролем."})


class ChangeEmailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        ser = ChangeEmailSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        if getattr(request.user, "is_demo", False):
            return Response(
                {"detail": "В демо-режиме email менять нельзя."},
                status=status.HTTP_403_FORBIDDEN,
            )
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


class DemoLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        from .demo import DEMO_SPHERES, login_demo

        sphere = (request.data.get("sphere") or "").strip()
        if sphere not in DEMO_SPHERES:
            return Response(
                {
                    "detail": "Выберите сферу: салон красоты, автосервис или кафе.",
                    "spheres": [{"key": k, "label": v["label"]} for k, v in DEMO_SPHERES.items()],
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = login_demo(sphere)
        except Exception as exc:
            return Response(
                {
                    "detail": (
                        str(exc)
                        if settings.DEBUG
                        else "Не удалось открыть демо. Попробуйте ещё раз через минуту."
                    )
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(data)


class DemoExitView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        from .demo import exit_demo

        if not getattr(request.user, "is_demo", False):
            return Response({"detail": "ok"})
        try:
            exit_demo(request.user)
        except Exception:
            pass
        return Response({"detail": "Демо-данные восстановлены."})


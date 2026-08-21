"""Provider APIs for visit packages (абонементы) and loyalty."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .loyalty import (
    get_or_create_loyalty_account,
    get_or_create_loyalty_settings,
    sell_package,
)
from .models import ClientPackage, LoyaltyAccount, VisitPackage
from .serializers import (
    ClientPackageSerializer,
    LoyaltyAccountSerializer,
    LoyaltySettingsSerializer,
    VisitPackageSerializer,
)

User = get_user_model()


def _resolve_client(raw: str):
    """Resolve client by numeric id or username/login (as shown in chats)."""
    value = (raw or "").strip()
    if not value:
        return None
    if value.isdigit():
        return User.objects.filter(pk=int(value), role=User.Role.CLIENT).first()
    return User.objects.filter(username__iexact=value, role=User.Role.CLIENT).first()


class VisitPackageViewSet(viewsets.ModelViewSet):
    serializer_class = VisitPackageSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return VisitPackage.objects.filter(provider=user).prefetch_related("services")
        provider = (self.request.query_params.get("provider") or "").strip()
        if provider:
            return VisitPackage.objects.filter(
                provider_id=provider, is_active=True
            ).prefetch_related("services")
        return VisitPackage.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role != "provider":
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save(provider=self.request.user)

    def perform_update(self, serializer):
        if self.request.user.role != "provider" or serializer.instance.provider_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != "provider" or instance.provider_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied()
        instance.is_active = False
        instance.save(update_fields=["is_active"])

    @action(detail=True, methods=["post"], url_path="purchase")
    def purchase(self, request, pk=None):
        """Client self-purchase of an active package (оплата у администратора / офлайн)."""
        if request.user.role != User.Role.CLIENT:
            return Response({"detail": "Только для клиентов."}, status=status.HTTP_403_FORBIDDEN)
        package = get_object_or_404(VisitPackage, pk=pk, is_active=True)
        try:
            purchase = sell_package(
                provider=package.provider,
                client=request.user,
                package=package,
                note="Самостоятельная покупка в приложении",
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ClientPackageSerializer(purchase).data, status=status.HTTP_201_CREATED)


class ClientPackageViewSet(viewsets.ModelViewSet):
    serializer_class = ClientPackageSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            qs = ClientPackage.objects.filter(provider=user)
            client = (self.request.query_params.get("client") or "").strip()
            if client:
                resolved = _resolve_client(client)
                if resolved:
                    qs = qs.filter(client=resolved)
                else:
                    qs = qs.filter(client_id=client) if client.isdigit() else qs.none()
            return qs.select_related("package", "client", "provider")
        return ClientPackage.objects.filter(client=user).select_related("package", "provider")

    def create(self, request, *args, **kwargs):
        """Sell / assign package to a client (provider only)."""
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = request.data or {}
        try:
            package = VisitPackage.objects.get(pk=int(data.get("package")), provider=request.user)
        except (VisitPackage.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Укажите package."}, status=status.HTTP_400_BAD_REQUEST)
        client = _resolve_client(str(data.get("client") or data.get("client_login") or ""))
        if not client:
            return Response(
                {"detail": "Клиент не найден. Укажите логин (как в чатах) или ID."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            purchase = sell_package(
                provider=request.user,
                client=client,
                package=package,
                note=str(data.get("note") or ""),
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(ClientPackageSerializer(purchase).data, status=status.HTTP_201_CREATED)


class LoyaltySettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj = get_or_create_loyalty_settings(request.user)
        return Response(LoyaltySettingsSerializer(obj).data)

    def patch(self, request):
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj = get_or_create_loyalty_settings(request.user)
        ser = LoyaltySettingsSerializer(obj, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class MyLoyaltyView(APIView):
    """Client: balance at a provider (or all accounts). Provider: lookup by client id/login."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider_id = (request.query_params.get("provider") or "").strip()
        client_raw = (request.query_params.get("client") or "").strip()
        if request.user.role == "provider":
            if not client_raw:
                qs = LoyaltyAccount.objects.filter(provider=request.user).select_related("client")[:100]
                return Response(LoyaltyAccountSerializer(qs, many=True).data)
            client = _resolve_client(client_raw)
            if not client:
                return Response({"detail": "Клиент не найден."}, status=status.HTTP_404_NOT_FOUND)
            account = get_or_create_loyalty_account(request.user, client)
            return Response(LoyaltyAccountSerializer(account).data)
        if not provider_id:
            qs = LoyaltyAccount.objects.filter(client=request.user).select_related("provider")[:100]
            return Response(LoyaltyAccountSerializer(qs, many=True).data)
        account = get_or_create_loyalty_account(
            get_object_or_404(User, pk=provider_id, role=User.Role.PROVIDER),
            request.user,
        )
        settings_obj = get_or_create_loyalty_settings(account.provider)
        data = LoyaltyAccountSerializer(account).data
        data["enabled"] = bool(settings_obj.enabled)
        data["rub_per_point"] = str(settings_obj.rub_per_point)
        return Response(data)


class MyLoyaltyAccountsView(APIView):
    """Alias list of client loyalty accounts."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.CLIENT:
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = LoyaltyAccount.objects.filter(client=request.user).select_related("provider")[:100]
        return Response(LoyaltyAccountSerializer(qs, many=True).data)

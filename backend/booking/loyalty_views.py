"""Provider APIs for visit packages (абонементы) and loyalty."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import permissions, status, viewsets
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


def _provider_user(request):
    if request.user.role != "provider":
        return None
    return request.user


class VisitPackageViewSet(viewsets.ModelViewSet):
    serializer_class = VisitPackageSerializer
    permission_classes = [permissions.IsAuthenticated]

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
                qs = qs.filter(client_id=client)
            return qs.select_related("package", "client", "provider")
        return ClientPackage.objects.filter(client=user).select_related("package", "provider")

    def create(self, request, *args, **kwargs):
        """Sell / assign package to a client (provider only)."""
        if request.user.role != "provider":
            return Response(status=status.HTTP_403_FORBIDDEN)
        data = request.data or {}
        try:
            package = VisitPackage.objects.get(pk=int(data.get("package")), provider=request.user)
            client = User.objects.get(pk=int(data.get("client")), role=User.Role.CLIENT)
        except (VisitPackage.DoesNotExist, User.DoesNotExist, TypeError, ValueError):
            return Response({"detail": "Укажите package и client."}, status=status.HTTP_400_BAD_REQUEST)
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
    """Client: balance at a provider. Provider: lookup by client id."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider_id = (request.query_params.get("provider") or "").strip()
        client_id = (request.query_params.get("client") or "").strip()
        if request.user.role == "provider":
            if not client_id:
                # list top accounts
                qs = LoyaltyAccount.objects.filter(provider=request.user).select_related("client")[:100]
                return Response(LoyaltyAccountSerializer(qs, many=True).data)
            account = get_or_create_loyalty_account(request.user, get_object_or_404(User, pk=client_id))
            return Response(LoyaltyAccountSerializer(account).data)
        if not provider_id:
            return Response({"detail": "Укажите provider."}, status=status.HTTP_400_BAD_REQUEST)
        account = get_or_create_loyalty_account(
            get_object_or_404(User, pk=provider_id, role=User.Role.PROVIDER),
            request.user,
        )
        settings_obj = get_or_create_loyalty_settings(account.provider)
        data = LoyaltyAccountSerializer(account).data
        data["enabled"] = bool(settings_obj.enabled)
        data["rub_per_point"] = str(settings_obj.rub_per_point)
        return Response(data)

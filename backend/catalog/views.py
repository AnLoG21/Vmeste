from django.db.models import Q
from rest_framework import permissions, viewsets

from .models import Service, ServiceCategory
from .serializers import ServiceCategorySerializer, ServiceSerializer


class ServiceCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceCategorySerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        provider = self.request.query_params.get("provider")
        if user.role == "provider":
            return ServiceCategory.objects.filter(provider=user).prefetch_related("subcategories")
        if provider:
            return ServiceCategory.objects.filter(provider_id=provider).prefetch_related("subcategories")
        if user.role == "staff":
            return (
                ServiceCategory.objects.filter(Q(provider=user) | Q(provider__staff_links__staff=user))
                .prefetch_related("subcategories")
                .distinct()
            )
        return ServiceCategory.objects.none()

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Service.objects.all().select_related("provider", "category", "subcategory")
        provider = self.request.query_params.get("provider")
        if provider:
            qs = qs.filter(provider_id=provider)
        if self.request.user.role == "provider":
            return qs.filter(provider=self.request.user)
        if self.request.user.role == "staff":
            return qs.filter(Q(provider=self.request.user) | Q(provider__staff_links__staff=self.request.user)).distinct()
        if self.request.user.role == "client" and provider:
            return qs.filter(provider_id=provider)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save(provider=self.request.user)

from django.db.models import Q
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied

from booking.models import ProviderStaff

from .models import ProviderLocation
from .serializers import ProviderLocationSerializer


class ProviderLocationViewSet(viewsets.ModelViewSet):
    serializer_class = ProviderLocationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.role == "provider":
            return ProviderLocation.objects.filter(provider=user)
        if user.role == "staff":
            ids = ProviderStaff.objects.filter(staff=user, is_active=True).values_list("provider_id", flat=True)
            return ProviderLocation.objects.filter(provider_id__in=ids)
        return ProviderLocation.objects.none()

    def perform_create(self, serializer):
        if self.request.user.role != "provider":
            raise DRFPermissionDenied()
        serializer.save(provider=self.request.user)

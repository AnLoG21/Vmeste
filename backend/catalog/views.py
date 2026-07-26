from django.db.models import Q
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import User

from booking.booking_windows import filter_services_bookable_by_staff

from .catalog_seed import provider_catalog_status, seed_provider_catalog
from .models import Service, ServiceCategory, ServicePhoto
from .serializers import ServiceCategorySerializer, ServicePhotoSerializer, ServiceSerializer
from .sphere_templates import get_sphere_catalog, list_sphere_catalogs


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
        user = self.request.user
        if user.role == User.Role.PROVIDER and not serializer.validated_data.get("template_slug"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Категории добавляются из готового каталога сферы. Используйте «Загрузить каталог»."
            )
        serializer.save(provider=user)


class ServiceViewSet(viewsets.ModelViewSet):
    serializer_class = ServiceSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        qs = Service.objects.all().select_related("provider", "category", "subcategory").prefetch_related("photos")
        provider = self.request.query_params.get("provider")
        if provider:
            qs = qs.filter(provider_id=provider)
        if self.request.user.role == "provider":
            return qs.filter(provider=self.request.user)
        if self.request.user.role == "staff":
            return qs.filter(Q(provider=self.request.user) | Q(provider__staff_links__staff=self.request.user)).distinct()
        if self.request.user.role == "client" and provider:
            qs = qs.filter(provider_id=provider, is_active=True)
            return filter_services_bookable_by_staff(int(provider), qs)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        if user.role == User.Role.PROVIDER and not serializer.validated_data.get("template_slug"):
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied(
                "Услуги добавляются из готового каталога сферы. Включите нужные позиции в разделе «Услуги и категории»."
            )
        serializer.save(provider=user)

    @action(detail=True, methods=["post"], url_path="photos")
    def upload_photos(self, request, pk=None):
        service = self.get_object()
        if request.user.role != "provider" or service.provider_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        files = request.FILES.getlist("photos") or request.FILES.getlist("photo")
        if not files and request.FILES.get("image"):
            files = [request.FILES["image"]]
        if not files:
            return Response({"detail": "Добавьте файлы photos."}, status=status.HTTP_400_BAD_REQUEST)
        existing = service.photos.count()
        created = []
        for i, f in enumerate(files):
            if existing + len(created) >= 12:
                break
            ph = ServicePhoto.objects.create(service=service, image=f, sort_order=existing + i)
            created.append(ph)
        return Response(
            {
                "photos": ServicePhotoSerializer(service.photos.all(), many=True, context={"request": request}).data,
                "gallery": ServiceSerializer(service, context={"request": request}).data.get("gallery"),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["delete"], url_path=r"photos/(?P<photo_id>[^/.]+)")
    def delete_photo(self, request, pk=None, photo_id=None):
        service = self.get_object()
        if request.user.role != "provider" or service.provider_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ph = service.photos.filter(pk=photo_id).first()
        if not ph:
            return Response(status=status.HTTP_404_NOT_FOUND)
        ph.delete()
        return Response({"ok": True})


class SphereCatalogTemplateView(APIView):
    """Просмотр шаблона каталога для сферы (без привязки к организации)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        sphere = (request.query_params.get("sphere") or "").strip()
        if not sphere and request.user.role == User.Role.PROVIDER:
            sphere = request.user.provider_sphere or ""
        catalog = get_sphere_catalog(sphere)
        if not catalog:
            return Response(
                {"detail": "Для этой сферы пока нет готового каталога."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(catalog)


class SphereCatalogListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(list_sphere_catalogs())


class SeedProviderCatalogView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        return Response(provider_catalog_status(request.user))

    def post(self, request):
        if request.user.role != User.Role.PROVIDER:
            return Response(status=status.HTTP_403_FORBIDDEN)
        sphere = (request.data.get("sphere") or request.user.provider_sphere or "").strip()
        if not get_sphere_catalog(sphere):
            return Response(
                {"detail": "Для выбранной сферы нет готового каталога услуг."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            stats = seed_provider_catalog(request.user, sphere)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        status_data = provider_catalog_status(request.user)
        return Response({"stats": stats, **status_data})

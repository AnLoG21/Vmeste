from datetime import time
from decimal import Decimal

from django.db.models import Avg, Count, Exists, FloatField, Max, Min, OuterRef, Prefetch, Q, Subquery
from django.db.models.fields import DecimalField
from django.utils.dateparse import parse_date
from rest_framework import permissions, viewsets
from rest_framework.exceptions import PermissionDenied as DRFPermissionDenied
from rest_framework.response import Response

from booking.models import AvailabilitySlot, ProviderStaff
from catalog.models import Service
from reviews.models import Review

from users.models import ProviderGalleryPhoto, User

from .models import ProviderLocation
from .serializers import ProviderLocationClientSerializer, ProviderLocationSerializer


def _parse_time_hm(value):
    if not value or not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    parts = s.split(":")
    if len(parts) < 2:
        return None
    try:
        return time(int(parts[0]), int(parts[1]))
    except ValueError:
        return None


class ProviderLocationViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        if getattr(self.request.user, "role", None) == "client":
            return ProviderLocationClientSerializer
        return ProviderLocationSerializer

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, "role", None)

        if role == "provider":
            return ProviderLocation.objects.filter(provider=user).select_related("provider")

        if role == "staff":
            ids = ProviderStaff.objects.filter(staff=user, is_active=True).values_list("provider_id", flat=True)
            return ProviderLocation.objects.filter(provider_id__in=ids).select_related("provider")

        if role == "client":
            return self._client_discover_queryset()

        return ProviderLocation.objects.none()

    def _client_discover_queryset(self):
        request = self.request
        min_sub = (
            Service.objects.filter(provider_id=OuterRef("provider_id"), is_active=True)
            .values("provider_id")
            .annotate(m=Min("price"))
            .values("m")[:1]
        )
        max_sub = (
            Service.objects.filter(provider_id=OuterRef("provider_id"), is_active=True)
            .values("provider_id")
            .annotate(m=Max("price"))
            .values("m")[:1]
        )
        rating_sub = (
            Review.objects.filter(provider_id=OuterRef("provider_id"))
            .values("provider_id")
            .annotate(a=Avg("rating"))
            .values("a")[:1]
        )
        reviews_count_sub = (
            Review.objects.filter(provider_id=OuterRef("provider_id"))
            .values("provider_id")
            .annotate(c=Count("id"))
            .values("c")[:1]
        )

        gallery_prefetch = Prefetch(
            "provider__gallery_photos",
            queryset=ProviderGalleryPhoto.objects.order_by("sort_order", "id")[:1],
            to_attr="_gallery_cover_list",
        )
        qs = (
            ProviderLocation.objects.select_related("provider")
            .prefetch_related(gallery_prefetch)
            .annotate(
                min_service_price=Subquery(min_sub, output_field=DecimalField(max_digits=12, decimal_places=2)),
                max_service_price=Subquery(max_sub, output_field=DecimalField(max_digits=12, decimal_places=2)),
                provider_average_rating=Subquery(rating_sub, output_field=FloatField()),
                provider_reviews_count=Subquery(reviews_count_sub),
            )
        )

        search = (request.query_params.get("search") or "").strip()
        if search:
            sphere_q = Q()
            sl = search.lower()
            for key, label in User.ProviderSphere.choices:
                if sl in (label or "").lower():
                    sphere_q |= Q(provider__provider_sphere=key)

            qs = qs.filter(
                Q(title__icontains=search)
                | Q(address__icontains=search)
                | Q(provider__organization_name__icontains=search)
                | Q(provider__username__icontains=search)
                | sphere_q
            )

        sphere = (request.query_params.get("sphere") or "").strip()
        if sphere:
            qs = qs.filter(provider__provider_sphere=sphere)

        def _decimal_param(name):
            raw = (request.query_params.get(name) or "").strip()
            if raw == "":
                return None
            try:
                from decimal import Decimal

                return Decimal(raw)
            except Exception:
                return None

        min_price = _decimal_param("min_price")
        max_price = _decimal_param("max_price")
        if min_price is not None or max_price is not None:
            qs = qs.filter(min_service_price__isnull=False, max_service_price__isnull=False)
        if min_price is not None and max_price is not None:
            qs = qs.filter(min_service_price__lte=max_price, max_service_price__gte=min_price)
        elif min_price is not None:
            qs = qs.filter(max_service_price__gte=min_price)
        elif max_price is not None:
            qs = qs.filter(min_service_price__lte=max_price)

        df = parse_date((request.query_params.get("slot_date_from") or "").strip() or "")
        dt = parse_date((request.query_params.get("slot_date_to") or "").strip() or "")
        t_from = _parse_time_hm(request.query_params.get("time_from") or "")
        t_to = _parse_time_hm(request.query_params.get("time_to") or "")

        if df or dt or t_from or t_to:
            slot_q = AvailabilitySlot.objects.filter(provider_id=OuterRef("provider_id"), is_booked=False)
            if df:
                slot_q = slot_q.filter(starts_at__date__gte=df)
            if dt:
                slot_q = slot_q.filter(starts_at__date__lte=dt)
            if t_from:
                slot_q = slot_q.filter(starts_at__time__gte=t_from)
            if t_to:
                slot_q = slot_q.filter(starts_at__time__lte=t_to)
            qs = qs.annotate(_has_slot=Exists(slot_q)).filter(_has_slot=True)

        return qs

    def create(self, request, *args, **kwargs):
        if request.user.role != "provider":
            raise DRFPermissionDenied()
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if request.user.role != "provider":
            raise DRFPermissionDenied()
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if request.user.role != "provider":
            raise DRFPermissionDenied()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if request.user.role != "provider":
            raise DRFPermissionDenied()
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        if self.request.user.role != "provider":
            raise DRFPermissionDenied()
        serializer.save(provider=self.request.user)

    def list(self, request, *args, **kwargs):
        if getattr(request.user, "role", None) != "client":
            return super().list(request, *args, **kwargs)
        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        data = list(serializer.data)
        seen_providers = {int(item["provider"]) for item in data if item.get("provider")}

        providers_qs = User.objects.filter(
            role=User.Role.PROVIDER,
            organization_latitude__isnull=False,
            organization_longitude__isnull=False,
        ).exclude(id__in=seen_providers)

        search = (request.query_params.get("search") or "").strip()
        if search:
            sl = search.lower()
            sphere_q = Q()
            for key, label in User.ProviderSphere.choices:
                if sl in (label or "").lower():
                    sphere_q |= Q(provider_sphere=key)
            providers_qs = providers_qs.filter(
                Q(organization_name__icontains=search)
                | Q(username__icontains=search)
                | Q(organization_address__icontains=search)
                | sphere_q
            )

        sphere = (request.query_params.get("sphere") or "").strip()
        if sphere:
            providers_qs = providers_qs.filter(provider_sphere=sphere)

        extra_providers = list(providers_qs)
        cover_by_provider = {}
        if extra_providers:
            prov_ids = [p.id for p in extra_providers]
            for row in ProviderGalleryPhoto.objects.filter(provider_id__in=prov_ids).order_by(
                "provider_id", "sort_order", "id"
            ):
                if row.provider_id not in cover_by_provider and row.image:
                    cover_by_provider[row.provider_id] = request.build_absolute_uri(row.image.url)

        for prov in extra_providers:
            min_p, max_p = self._provider_price_range(prov.id)
            if not self._provider_passes_price_filters(request, min_p, max_p):
                continue
            if not self._provider_passes_slot_filters(request, prov.id):
                continue
            rev_agg = Review.objects.filter(provider_id=prov.id).aggregate(a=Avg("rating"), c=Count("id"))
            data.append(
                {
                    "id": f"main-{prov.id}",
                    "provider": prov.id,
                    "title": "Основной офис",
                    "address": prov.organization_address or "",
                    "latitude": prov.organization_latitude,
                    "longitude": prov.organization_longitude,
                    "entrance": prov.organization_entrance or "",
                    "floor": prov.organization_floor or "",
                    "apartment": prov.organization_apartment or "",
                    "intercom": prov.organization_intercom or "",
                    "address_details": prov.organization_address_extra or "",
                    "organization_name": prov.organization_name or prov.username,
                    "provider_sphere": prov.provider_sphere or "",
                    "sphere_label": dict(User.ProviderSphere.choices).get(prov.provider_sphere or "", ""),
                    "provider_cover_url": cover_by_provider.get(prov.id),
                    "min_service_price": min_p,
                    "max_service_price": max_p,
                    "is_main_office": True,
                    "provider_average_rating": round(rev_agg["a"], 2) if rev_agg["a"] is not None else None,
                    "provider_reviews_count": rev_agg["c"] or 0,
                    "provider_working_hours": prov.organization_working_hours or {},
                }
            )
        return Response(data)

    def _provider_price_range(self, provider_id):
        agg = Service.objects.filter(provider_id=provider_id, is_active=True).aggregate(
            mn=Min("price"), mx=Max("price")
        )
        return agg["mn"], agg["mx"]

    def _provider_passes_price_filters(self, request, min_p, max_p):
        def _decimal_param(name):
            raw = (request.query_params.get(name) or "").strip()
            if raw == "":
                return None
            try:
                return Decimal(raw)
            except Exception:
                return None

        min_price = _decimal_param("min_price")
        max_price = _decimal_param("max_price")
        if min_price is None and max_price is None:
            return True
        if min_p is None or max_p is None:
            return False
        if min_price is not None and max_price is not None:
            return min_p <= max_price and max_p >= min_price
        if min_price is not None:
            return max_p >= min_price
        return min_p <= max_price

    def _provider_passes_slot_filters(self, request, provider_id):
        df = parse_date((request.query_params.get("slot_date_from") or "").strip() or "")
        dt = parse_date((request.query_params.get("slot_date_to") or "").strip() or "")
        t_from = _parse_time_hm(request.query_params.get("time_from") or "")
        t_to = _parse_time_hm(request.query_params.get("time_to") or "")
        if not (df or dt or t_from or t_to):
            return True
        slot_q = AvailabilitySlot.objects.filter(provider_id=provider_id, is_booked=False)
        if df:
            slot_q = slot_q.filter(starts_at__date__gte=df)
        if dt:
            slot_q = slot_q.filter(starts_at__date__lte=dt)
        if t_from:
            slot_q = slot_q.filter(starts_at__time__gte=t_from)
        if t_to:
            slot_q = slot_q.filter(starts_at__time__lte=t_to)
        return slot_q.exists()

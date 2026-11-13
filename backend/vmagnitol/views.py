from django.shortcuts import get_object_or_404
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Brand, CarModel, Guide, GuideFile, GuideStep
from .permissions import IsVmagnitolAllowed
from .serializers import (
    BrandSerializer,
    BrandWriteSerializer,
    CarModelSerializer,
    CarModelWriteSerializer,
    GuideDetailSerializer,
    GuideFileSerializer,
    GuideListSerializer,
    GuideStepSerializer,
    GuideWriteSerializer,
)


class BrandListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def get(self, request):
        qs = Brand.objects.prefetch_related("models__guides").all()
        return Response(BrandSerializer(qs, many=True).data)

    def post(self, request):
        ser = BrandWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        brand = Brand.objects.create(**ser.validated_data)
        return Response(BrandSerializer(brand).data, status=status.HTTP_201_CREATED)


class BrandDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def patch(self, request, pk):
        brand = get_object_or_404(Brand, pk=pk)
        ser = BrandWriteSerializer(brand, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(brand, k, v)
        brand.save()
        return Response(BrandSerializer(brand).data)

    def delete(self, request, pk):
        brand = get_object_or_404(Brand, pk=pk)
        brand.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CarModelListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def get(self, request, brand_id):
        brand = get_object_or_404(Brand, pk=brand_id)
        qs = brand.models.prefetch_related("guides").all()
        return Response(CarModelSerializer(qs, many=True).data)

    def post(self, request, brand_id):
        brand = get_object_or_404(Brand, pk=brand_id)
        ser = CarModelWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        model = CarModel.objects.create(brand=brand, **ser.validated_data)
        return Response(CarModelSerializer(model).data, status=status.HTTP_201_CREATED)


class CarModelDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def get(self, request, pk):
        model = get_object_or_404(CarModel.objects.prefetch_related("guides"), pk=pk)
        return Response(CarModelSerializer(model).data)

    def patch(self, request, pk):
        model = get_object_or_404(CarModel, pk=pk)
        ser = CarModelWriteSerializer(model, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(model, k, v)
        model.save()
        return Response(CarModelSerializer(model).data)

    def delete(self, request, pk):
        model = get_object_or_404(CarModel, pk=pk)
        model.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GuideListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def get(self, request, model_id):
        model = get_object_or_404(CarModel, pk=model_id)
        qs = model.guides.all()
        return Response(GuideListSerializer(qs, many=True).data)

    def post(self, request, model_id):
        model = get_object_or_404(CarModel, pk=model_id)
        ser = GuideWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        guide = Guide.objects.create(
            car_model=model,
            created_by=request.user,
            **ser.validated_data,
        )
        return Response(GuideDetailSerializer(guide).data, status=status.HTTP_201_CREATED)


class GuideDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def get(self, request, pk):
        guide = get_object_or_404(
            Guide.objects.prefetch_related("steps__files", "files"),
            pk=pk,
        )
        return Response(GuideDetailSerializer(guide, context={"request": request}).data)

    def patch(self, request, pk):
        guide = get_object_or_404(Guide, pk=pk)
        ser = GuideWriteSerializer(guide, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(guide, k, v)
        guide.save()
        guide = Guide.objects.prefetch_related("steps__files", "files").get(pk=guide.pk)
        return Response(GuideDetailSerializer(guide, context={"request": request}).data)

    def delete(self, request, pk):
        guide = get_object_or_404(Guide, pk=pk)
        guide.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GuideStepListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def post(self, request, guide_id):
        guide = get_object_or_404(Guide, pk=guide_id)
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        if not data.get("order"):
            last = guide.steps.order_by("-order").first()
            data["order"] = (last.order + 1) if last else 1
        ser = GuideStepSerializer(data=data)
        ser.is_valid(raise_exception=True)
        step = GuideStep.objects.create(guide=guide, **ser.validated_data)
        return Response(
            GuideStepSerializer(step, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GuideStepDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def patch(self, request, pk):
        step = get_object_or_404(GuideStep, pk=pk)
        ser = GuideStepSerializer(step, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(step, k, v)
        step.save()
        return Response(GuideStepSerializer(step, context={"request": request}).data)

    def delete(self, request, pk):
        step = get_object_or_404(GuideStep, pk=pk)
        step.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class GuideFileUploadView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, guide_id):
        guide = get_object_or_404(Guide, pk=guide_id)
        upload = request.FILES.get("file")
        external_url = (request.data.get("external_url") or "").strip()
        if not upload and not external_url:
            return Response(
                {"detail": "Передайте файл или external_url."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if upload:
            max_bytes = 512 * 1024 * 1024
            if upload.size > max_bytes:
                return Response(
                    {"detail": "Файл слишком большой (макс. 512 МБ)."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        step_id = request.data.get("step") or request.data.get("step_id")
        step = None
        if step_id:
            step = get_object_or_404(GuideStep, pk=step_id, guide=guide)
        title = (request.data.get("title") or "").strip()
        role = (request.data.get("role") or GuideFile.Role.OTHER).strip()
        if role not in GuideFile.Role.values:
            role = GuideFile.Role.OTHER
        is_required = str(request.data.get("is_required") or "").lower() in {"1", "true", "yes"}
        notes = (request.data.get("notes") or "").strip()
        obj = GuideFile(
            guide=guide,
            step=step,
            title=title,
            external_url=external_url,
            role=role,
            is_required=is_required,
            notes=notes,
        )
        if upload:
            obj.file = upload
            obj.original_name = getattr(upload, "name", "") or ""
            obj.content_type = getattr(upload, "content_type", "") or ""
            obj.size_bytes = int(upload.size or 0)
        obj.save()
        return Response(
            GuideFileSerializer(obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class GuideFileDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated, IsVmagnitolAllowed]

    def delete(self, request, pk):
        obj = get_object_or_404(GuideFile, pk=pk)
        if obj.file:
            obj.file.delete(save=False)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
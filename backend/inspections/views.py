from decimal import Decimal, InvalidOperation

from django.db.models import Prefetch
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from booking.models import Booking, ProviderStaff
from users.models import User

from .documents import build_agreement_pdf, build_work_order_pdf
from .models import InspectionItem, InspectionItemMedia, InspectionReport
from .serializers import (
    InspectionItemMediaSerializer,
    InspectionItemSerializer,
    InspectionItemWriteSerializer,
    InspectionReportCreateSerializer,
    InspectionReportSerializer,
)
from .services import approve_report, send_report


def _provider_for_user(user):
    if user.role == User.Role.PROVIDER:
        if user.provider_sphere != User.ProviderSphere.SERVICE_CENTER:
            return None
        return user
    if user.role == User.Role.STAFF:
        link = (
            ProviderStaff.objects.filter(
                staff=user,
                is_active=True,
                invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
                provider__provider_sphere=User.ProviderSphere.SERVICE_CENTER,
            )
            .select_related("provider")
            .first()
        )
        return link.provider if link else None
    return None


def _can_manage_reports(user) -> bool:
    if user.role == User.Role.PROVIDER:
        return user.provider_sphere == User.ProviderSphere.SERVICE_CENTER
    if user.role == User.Role.STAFF:
        link = ProviderStaff.objects.filter(
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            provider__provider_sphere=User.ProviderSphere.SERVICE_CENTER,
        ).first()
        if not link:
            return False
        perms = link.permissions or {}
        return bool(perms.get("manage_bookings", True))
    return False


def _report_qs():
    return InspectionReport.objects.select_related(
        "provider", "client", "booking", "created_by"
    ).prefetch_related(
        Prefetch(
            "items",
            queryset=InspectionItem.objects.prefetch_related("photos").order_by("sort_order", "id"),
        )
    )


class InspectionReportViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return InspectionReportCreateSerializer
        return InspectionReportSerializer

    def get_queryset(self):
        user = self.request.user
        qs = _report_qs()
        if user.role == User.Role.CLIENT:
            return qs.filter(client=user).exclude(status=InspectionReport.Status.DRAFT)
        provider = _provider_for_user(user)
        if provider:
            return qs.filter(provider=provider)
        return qs.none()

    def create(self, request, *args, **kwargs):
        if not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        provider = _provider_for_user(request.user)
        if not provider:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = InspectionReportCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        try:
            client = User.objects.get(pk=data["client"], role=User.Role.CLIENT)
        except User.DoesNotExist:
            return Response({"client": ["Клиент не найден."]}, status=status.HTTP_400_BAD_REQUEST)
        booking = None
        booking_id = data.get("booking")
        if booking_id:
            booking = Booking.objects.filter(pk=booking_id, provider=provider, client=client).first()
            if not booking:
                return Response({"booking": ["Запись не найдена."]}, status=status.HTTP_400_BAD_REQUEST)
        report = InspectionReport.objects.create(
            provider=provider,
            client=client,
            booking=booking,
            created_by=request.user,
            vehicle_title=(data.get("vehicle_title") or "")[:200],
            vehicle_plate=(data.get("vehicle_plate") or "")[:32],
            vehicle_vin=(data.get("vehicle_vin") or "")[:64],
            notes=data.get("notes") or "",
        )
        return Response(
            InspectionReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        report = self.get_object()
        if not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Редактировать можно только черновик."}, status=status.HTTP_400_BAD_REQUEST)
        for field in ("vehicle_title", "vehicle_plate", "vehicle_vin", "notes"):
            if field in request.data:
                setattr(report, field, str(request.data.get(field) or "")[: (200 if field == "vehicle_title" else 64 if field == "vehicle_vin" else 32 if field == "vehicle_plate" else 5000)])
        report.save()
        return Response(InspectionReportSerializer(report, context={"request": request}).data)

    def destroy(self, request, *args, **kwargs):
        report = self.get_object()
        if not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if report.status not in (InspectionReport.Status.DRAFT, InspectionReport.Status.CANCELLED):
            report.status = InspectionReport.Status.CANCELLED
            report.save(update_fields=["status", "updated_at"])
            return Response(InspectionReportSerializer(report, context={"request": request}).data)
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        report = self.get_object()
        if not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            send_report(report)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        report.refresh_from_db()
        return Response(InspectionReportSerializer(report, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        report = self.get_object()
        if request.user.role != User.Role.CLIENT or report.client_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        ids = request.data.get("selected_item_ids") or []
        try:
            ids = [int(x) for x in ids]
        except (TypeError, ValueError):
            return Response({"selected_item_ids": ["Некорректный список."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            approve_report(report, ids)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        report.refresh_from_db()
        return Response(InspectionReportSerializer(report, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="items")
    def add_item(self, request, pk=None):
        report = self.get_object()
        if not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Пункты можно менять только в черновике."}, status=status.HTTP_400_BAD_REQUEST)
        ser = InspectionItemWriteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        item = InspectionItem.objects.create(report=report, **ser.validated_data)
        return Response(
            InspectionItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["get"], url_path="documents/agreement")
    def agreement_pdf(self, request, pk=None):
        return self._pdf_response(request, "agreement")

    @action(detail=True, methods=["get"], url_path="documents/work-order")
    def work_order_pdf(self, request, pk=None):
        return self._pdf_response(request, "work-order")

    def _pdf_response(self, request, doc_type):
        report = self.get_object()
        is_client = request.user.role == User.Role.CLIENT and report.client_id == request.user.id
        is_org = _can_manage_reports(request.user) and report.provider_id == getattr(
            _provider_for_user(request.user), "id", None
        )
        if not is_client and not is_org:
            return Response(status=status.HTTP_403_FORBIDDEN)
        if report.status != InspectionReport.Status.APPROVED:
            return Response({"detail": "Документы доступны после утверждения."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if doc_type == "agreement":
                raw = build_agreement_pdf(report)
                filename = f"agreement-{report.id}.pdf"
            else:
                raw = build_work_order_pdf(report)
                filename = f"work-order-{report.id}.pdf"
        except Exception:
            import logging

            logging.getLogger(__name__).exception("inspection PDF failed for report %s", report.id)
            return Response({"detail": "Не удалось сформировать PDF."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        resp = HttpResponse(raw, content_type="application/pdf")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp


class InspectionItemDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    def _get_item(self, request, pk):
        item = (
            InspectionItem.objects.select_related("report")
            .prefetch_related("photos")
            .filter(pk=pk)
            .first()
        )
        if not item:
            return None, Response(status=status.HTTP_404_NOT_FOUND)
        report = item.report
        provider = _provider_for_user(request.user)
        if provider and report.provider_id == provider.id and _can_manage_reports(request.user):
            return item, None
        return None, Response(status=status.HTTP_403_FORBIDDEN)

    def patch(self, request, pk):
        item, err = self._get_item(request, pk)
        if err:
            return err
        if item.report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Пункты можно менять только в черновике."}, status=status.HTTP_400_BAD_REQUEST)
        ser = InspectionItemWriteSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        for k, v in ser.validated_data.items():
            setattr(item, k, v)
        item.save()
        return Response(InspectionItemSerializer(item, context={"request": request}).data)

    def delete(self, request, pk):
        item, err = self._get_item(request, pk)
        if err:
            return err
        if item.report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Пункты можно менять только в черновике."}, status=status.HTTP_400_BAD_REQUEST)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InspectionItemPhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        item = InspectionItem.objects.select_related("report").filter(pk=pk).first()
        if not item:
            return Response(status=status.HTTP_404_NOT_FOUND)
        provider = _provider_for_user(request.user)
        if not provider or item.report.provider_id != provider.id or not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if item.report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Фото можно добавлять только в черновике."}, status=status.HTTP_400_BAD_REQUEST)
        image = request.FILES.get("image") or request.FILES.get("photo")
        if not image:
            return Response({"image": ["Прикрепите файл."]}, status=status.HTTP_400_BAD_REQUEST)
        if item.photos.count() >= 8:
            return Response({"detail": "Не более 8 фото на пункт."}, status=status.HTTP_400_BAD_REQUEST)
        photo = InspectionItemMedia.objects.create(item=item, image=image)
        return Response(
            InspectionItemMediaSerializer(photo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, pk, photo_id):
        item = InspectionItem.objects.select_related("report").filter(pk=pk).first()
        if not item:
            return Response(status=status.HTTP_404_NOT_FOUND)
        provider = _provider_for_user(request.user)
        if not provider or item.report.provider_id != provider.id or not _can_manage_reports(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if item.report.status != InspectionReport.Status.DRAFT:
            return Response({"detail": "Фото можно удалять только в черновике."}, status=status.HTTP_400_BAD_REQUEST)
        photo = item.photos.filter(pk=photo_id).first()
        if not photo:
            return Response(status=status.HTTP_404_NOT_FOUND)
        photo.image.delete(save=False)
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class InspectionPublicView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        report = _report_qs().filter(share_token=token).first()
        if not report or report.status == InspectionReport.Status.DRAFT:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if report.status == InspectionReport.Status.CANCELLED:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(InspectionReportSerializer(report, context={"request": request}).data)

    def post(self, request, token):
        """Approve by share token: POST /public/<token>/approve/ handled separately."""
        return Response(status=status.HTTP_405_METHOD_NOT_ALLOWED)


class InspectionPublicApproveView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, token):
        report = _report_qs().filter(share_token=token).first()
        if not report or report.status != InspectionReport.Status.SENT:
            return Response({"detail": "Отчёт недоступен для утверждения."}, status=status.HTTP_400_BAD_REQUEST)
        ids = request.data.get("selected_item_ids") or []
        try:
            ids = [int(x) for x in ids]
        except (TypeError, ValueError):
            return Response({"selected_item_ids": ["Некорректный список."]}, status=status.HTTP_400_BAD_REQUEST)
        try:
            approve_report(report, ids)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        report.refresh_from_db()
        return Response(InspectionReportSerializer(report, context={"request": request}).data)

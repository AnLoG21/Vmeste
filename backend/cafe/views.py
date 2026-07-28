from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from subscriptions.yookassa_client import create_payment
from users.email_service import send_cafe_order_receipt_email

from .models import (
    CafeFloorPlan,
    CafeGuestSession,
    CafeMenuCategory,
    CafeMenuItem,
    CafeMenuItemPhoto,
    CafeOrder,
    CafeOrderItem,
    CafeSettings,
    CafeTable,
)
from .serializers import (
    CafeFloorPlanSerializer,
    CafeMenuCategorySerializer,
    CafeMenuItemPhotoSerializer,
    CafeMenuItemSerializer,
    CafeOrderSerializer,
    CafeSettingsSerializer,
    CafeTableSerializer,
)

MENU_ITEM_MAX_PHOTOS = 5


def _is_cafe_provider(user):
    from users.models import User

    return (
        user
        and user.is_authenticated
        and user.role == User.Role.PROVIDER
        and user.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT
    )


def _get_or_create_settings(provider):
    obj, _ = CafeSettings.objects.get_or_create(provider=provider)
    return obj


def _session_from_request(request):
    token = (request.headers.get("X-Cafe-Session") or request.data.get("session_token") or "").strip()
    if not token:
        return None
    sess = (
        CafeGuestSession.objects.select_related("table", "table__floor_plan", "provider")
        .filter(token=token)
        .first()
    )
    if not sess or sess.expires_at < timezone.now():
        return None
    if sess.table_id and not sess.table.is_active:
        return None
    if not sess.provider_id and sess.table_id:
        sess.provider = sess.table.floor_plan.provider
    return sess


def _session_provider(sess):
    if sess.provider_id:
        return sess.provider
    if sess.table_id:
        return sess.table.floor_plan.provider
    return None



class CafeSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        from users.slug_utils import ensure_organization_slug

        ensure_organization_slug(request.user)
        return Response(CafeSettingsSerializer(_get_or_create_settings(request.user)).data)

    def patch(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = CafeSettingsSerializer(_get_or_create_settings(request.user), data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)


class CafeFloorPlanListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = CafeFloorPlan.objects.filter(provider=request.user).prefetch_related("tables")
        return Response(CafeFloorPlanSerializer(qs, many=True).data)

    def post(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = CafeFloorPlanSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        plan = CafeFloorPlan.objects.create(provider=request.user, **ser.validated_data)
        return Response(CafeFloorPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class CafeFloorPlanDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        plan = get_object_or_404(CafeFloorPlan, pk=pk, provider=request.user)
        ser = CafeFloorPlanSerializer(plan, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeFloorPlanSerializer(plan).data)

    def delete(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        plan = get_object_or_404(CafeFloorPlan, pk=pk, provider=request.user)
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeTableListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, plan_id):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        plan = get_object_or_404(CafeFloorPlan, pk=plan_id, provider=request.user)
        ser = CafeTableSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        table = CafeTable.objects.create(floor_plan=plan, **ser.validated_data)
        return Response(CafeTableSerializer(table).data, status=status.HTTP_201_CREATED)


class CafeTableDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        table = get_object_or_404(CafeTable, pk=pk, floor_plan__provider=request.user)
        ser = CafeTableSerializer(table, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeTableSerializer(table).data)

    def delete(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        table = get_object_or_404(CafeTable, pk=pk, floor_plan__provider=request.user)
        table.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuCategoryListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = CafeMenuCategory.objects.filter(provider=request.user).prefetch_related("items__photos")
        return Response(CafeMenuCategorySerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = CafeMenuCategorySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if data.get("is_novelties"):
            CafeMenuCategory.objects.filter(provider=request.user, is_novelties=True).update(is_novelties=False)
        cat = CafeMenuCategory.objects.create(provider=request.user, **data)
        return Response(
            CafeMenuCategorySerializer(cat, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CafeMenuCategoryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        cat = get_object_or_404(CafeMenuCategory, pk=pk, provider=request.user)
        ser = CafeMenuCategorySerializer(cat, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if ser.validated_data.get("is_novelties"):
            CafeMenuCategory.objects.filter(provider=request.user, is_novelties=True).exclude(pk=cat.pk).update(
                is_novelties=False
            )
        ser.save()
        return Response(CafeMenuCategorySerializer(cat, context={"request": request}).data)

    def delete(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        cat = get_object_or_404(CafeMenuCategory, pk=pk, provider=request.user)
        cat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuItemListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        ser = CafeMenuItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cat = ser.validated_data["category"]
        if cat.provider_id != request.user.id:
            return Response({"category": ["Чужая категория."]}, status=status.HTTP_400_BAD_REQUEST)
        item = CafeMenuItem.objects.create(**ser.validated_data)
        return Response(
            CafeMenuItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CafeMenuItemDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = get_object_or_404(CafeMenuItem, pk=pk, category__provider=request.user)
        ser = CafeMenuItemSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if "category" in ser.validated_data and ser.validated_data["category"].provider_id != request.user.id:
            return Response({"category": ["Чужая категория."]}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(CafeMenuItemSerializer(item, context={"request": request}).data)

    def delete(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = get_object_or_404(CafeMenuItem, pk=pk, category__provider=request.user)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuItemPhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, item_id):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = get_object_or_404(CafeMenuItem, pk=item_id, category__provider=request.user)
        if item.photos.count() >= MENU_ITEM_MAX_PHOTOS:
            return Response(
                {"detail": f"Максимум {MENU_ITEM_MAX_PHOTOS} фото на блюдо."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        image = request.FILES.get("image")
        if not image:
            return Response({"image": ["Нужно фото."]}, status=status.HTTP_400_BAD_REQUEST)
        photo = CafeMenuItemPhoto.objects.create(item=item, image=image)
        return Response(
            CafeMenuItemPhotoSerializer(photo, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, item_id, photo_id=None):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not photo_id:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        photo = get_object_or_404(
            CafeMenuItemPhoto,
            pk=photo_id,
            item_id=item_id,
            item__category__provider=request.user,
        )
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeProviderOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = CafeOrder.objects.filter(provider=request.user).prefetch_related("items")[:100]
        return Response(CafeOrderSerializer(qs, many=True).data)

    def patch(self, request, pk):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        order = get_object_or_404(CafeOrder, pk=pk, provider=request.user)
        new_status = (request.data.get("status") or "").strip()
        allowed = {c[0] for c in CafeOrder.Status.choices}
        if new_status not in allowed:
            return Response({"status": ["Некорректный статус."]}, status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        order.save(update_fields=["status", "updated_at"])
        return Response(CafeOrderSerializer(order).data)


# ——— Guest / QR flow ———


class CafeTablePublicView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        table = (
            CafeTable.objects.select_related("floor_plan__provider")
            .filter(public_token=token, is_active=True)
            .first()
        )
        if not table:
            return Response({"detail": "Стол не найден."}, status=status.HTTP_404_NOT_FOUND)
        provider = table.floor_plan.provider
        settings_obj = _get_or_create_settings(provider)
        return Response(
            {
                "table_label": table.label,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug or "",
                "need_pin": True,
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
            }
        )


class CafeTableUnlockView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, token):
        table = (
            CafeTable.objects.select_related("floor_plan__provider")
            .filter(public_token=token, is_active=True)
            .first()
        )
        if not table:
            return Response({"detail": "Стол не найден."}, status=status.HTTP_404_NOT_FOUND)
        pin = (request.data.get("pin") or "").strip()
        if pin != table.pin_code:
            return Response({"pin": ["Неверный пароль."]}, status=status.HTTP_400_BAD_REQUEST)
        sess = CafeGuestSession.create_for_table(table)
        provider = table.floor_plan.provider
        settings_obj = _get_or_create_settings(provider)
        return Response(
            {
                "session_token": sess.token,
                "expires_at": sess.expires_at,
                "table_label": table.label,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": getattr(provider, "organization_slug", "") or "",
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                "pay_methods": {
                    "online": settings_obj.accept_online_payment,
                    "cash": settings_obj.accept_cash,
                    "card_on_spot": settings_obj.accept_card_on_spot,
                },
                "delivery_info": settings_obj.delivery_info,
                "delivery_fee": str(settings_obj.delivery_fee),
                "delivery_min_order": str(settings_obj.delivery_min_order),
            }
        )


class CafeOrgPublicView(APIView):
    """Публичное меню заведения без стола (самовывоз/доставка)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        from users.models import User
        from users.slug_utils import ensure_organization_slug

        provider = User.objects.filter(role=User.Role.PROVIDER, is_active=True, provider_sphere=User.ProviderSphere.CAFE_RESTAURANT).filter(
            organization_slug__iexact=slug
        ).first()
        if not provider:
            # try ensure by scanning names — only exact slug
            return Response({"detail": "Заведение не найдено."}, status=status.HTTP_404_NOT_FOUND)
        ensure_organization_slug(provider)
        settings_obj = _get_or_create_settings(provider)
        return Response(
            {
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug,
                "need_pin": False,
                "modes": {
                    "dine_in": False,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
            }
        )

    def post(self, request, slug):
        """Открыть гостевую сессию без стола."""
        from users.models import User

        provider = User.objects.filter(
            role=User.Role.PROVIDER,
            is_active=True,
            provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
            organization_slug__iexact=slug,
        ).first()
        if not provider:
            return Response({"detail": "Заведение не найдено."}, status=status.HTTP_404_NOT_FOUND)
        settings_obj = _get_or_create_settings(provider)
        if not settings_obj.enable_takeaway and not settings_obj.enable_delivery:
            return Response({"detail": "Самовывоз и доставка отключены."}, status=status.HTTP_400_BAD_REQUEST)
        sess = CafeGuestSession.create_session(provider=provider, table=None)
        return Response(
            {
                "session_token": sess.token,
                "expires_at": sess.expires_at,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug,
                "modes": {
                    "dine_in": False,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                "pay_methods": {
                    "online": settings_obj.accept_online_payment,
                    "cash": settings_obj.accept_cash,
                    "card_on_spot": settings_obj.accept_card_on_spot,
                },
                "delivery_info": settings_obj.delivery_info,
                "delivery_fee": str(settings_obj.delivery_fee),
                "delivery_min_order": str(settings_obj.delivery_min_order),
            }
        )


class CafeGuestMenuView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        sess = _session_from_request(request)
        if not sess:
            return Response({"detail": "Нужна авторизация меню."}, status=status.HTTP_401_UNAUTHORIZED)
        provider = _session_provider(sess)
        if not provider:
            return Response({"detail": "Сессия недействительна."}, status=status.HTTP_401_UNAUTHORIZED)
        cats = CafeMenuCategory.objects.filter(provider=provider, is_active=True).prefetch_related(
            "items__photos"
        )
        data = CafeMenuCategorySerializer(cats, many=True, context={"request": request}).data
        for cat in data:
            cat["items"] = [
                i
                for i in cat.get("items") or []
                if i.get("is_active") and i.get("is_available", True)
            ]
        return Response(
            {
                "categories": data,
                "table_label": sess.table.label if sess.table_id else "",
                "organization_name": provider.organization_name or provider.username,
            }
        )


class CafeGuestOrderCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        sess = _session_from_request(request)
        if not sess:
            return Response({"detail": "Нужна авторизация меню."}, status=status.HTTP_401_UNAUTHORIZED)
        provider = _session_provider(sess)
        if not provider:
            return Response({"detail": "Сессия недействительна."}, status=status.HTTP_401_UNAUTHORIZED)
        settings_obj = _get_or_create_settings(provider)
        mode = (request.data.get("mode") or "").strip()
        if mode == CafeOrder.Mode.DINE_IN:
            if not settings_obj.enable_dine_in:
                return Response({"mode": ["Режим «за столом» отключён."]}, status=status.HTTP_400_BAD_REQUEST)
            if not sess.table_id:
                return Response({"mode": ["Для заказа за столом отсканируйте QR стола."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode == CafeOrder.Mode.TAKEAWAY and not settings_obj.enable_takeaway:
            return Response({"mode": ["Самовывоз отключён."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode == CafeOrder.Mode.DELIVERY and not settings_obj.enable_delivery:
            return Response({"mode": ["Доставка отключена."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode not in {c[0] for c in CafeOrder.Mode.choices}:
            return Response({"mode": ["Укажите режим."]}, status=status.HTTP_400_BAD_REQUEST)

        pay_method = (request.data.get("pay_method") or CafeOrder.PayMethod.ONLINE).strip()
        if pay_method == CafeOrder.PayMethod.ONLINE and not settings_obj.accept_online_payment:
            return Response({"pay_method": ["Онлайн-оплата отключена."]}, status=status.HTTP_400_BAD_REQUEST)
        if pay_method == CafeOrder.PayMethod.CASH and not settings_obj.accept_cash:
            return Response({"pay_method": ["Оплата наличными отключена."]}, status=status.HTTP_400_BAD_REQUEST)
        if pay_method == CafeOrder.PayMethod.CARD_ON_SPOT and not settings_obj.accept_card_on_spot:
            return Response({"pay_method": ["Оплата картой на месте отключена."]}, status=status.HTTP_400_BAD_REQUEST)

        raw_items = request.data.get("items") or []
        if not isinstance(raw_items, list) or not raw_items:
            return Response({"items": ["Добавьте блюда."]}, status=status.HTTP_400_BAD_REQUEST)

        guest_phone = (request.data.get("guest_phone") or "").strip()
        guest_email = (request.data.get("guest_email") or "").strip().lower()
        guest_name = (request.data.get("guest_name") or "").strip()
        delivery_address = (request.data.get("delivery_address") or "").strip()
        try:
            tip_percent = max(0, min(30, int(request.data.get("tip_percent") or 0)))
        except (TypeError, ValueError):
            tip_percent = 0
        if mode == CafeOrder.Mode.DELIVERY and not delivery_address:
            return Response({"delivery_address": ["Укажите адрес доставки."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode in (CafeOrder.Mode.TAKEAWAY, CafeOrder.Mode.DELIVERY) and not guest_phone:
            return Response({"guest_phone": ["Укажите телефон."]}, status=status.HTTP_400_BAD_REQUEST)
        if not guest_email:
            return Response({"guest_email": ["Укажите email для чека."]}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            order = CafeOrder.objects.create(
                provider=provider,
                table=sess.table if mode == CafeOrder.Mode.DINE_IN else None,
                mode=mode,
                pay_method=pay_method,
                guest_name=guest_name,
                guest_phone=guest_phone,
                guest_email=guest_email,
                delivery_address=delivery_address,
                comment=(request.data.get("comment") or "").strip()[:1000],
                guest_session_token=sess.token,
                status=CafeOrder.Status.DRAFT,
            )
            items_total = Decimal("0")
            for row in raw_items:
                try:
                    mid = int(row.get("menu_item"))
                    qty = max(1, int(row.get("quantity") or 1))
                except (TypeError, ValueError):
                    continue
                menu_item = CafeMenuItem.objects.filter(
                    pk=mid, category__provider=provider, is_active=True, is_available=True
                ).first()
                if not menu_item:
                    continue
                CafeOrderItem.objects.create(
                    order=order,
                    menu_item=menu_item,
                    name=menu_item.name,
                    unit_price=menu_item.price,
                    quantity=qty,
                )
                items_total += Decimal(menu_item.price) * qty
            if items_total <= 0:
                order.delete()
                return Response({"items": ["Нет доступных позиций."]}, status=status.HTTP_400_BAD_REQUEST)

            delivery_fee = Decimal("0")
            if mode == CafeOrder.Mode.DELIVERY:
                if items_total < settings_obj.delivery_min_order and settings_obj.delivery_min_order > 0:
                    order.delete()
                    return Response(
                        {
                            "detail": f"Минимальная сумма для доставки: {settings_obj.delivery_min_order} ₽."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                delivery_fee = settings_obj.delivery_fee or Decimal("0")

            order.items_total = items_total
            order.tip_percent = tip_percent
            order.tip_amount = ((items_total * Decimal(tip_percent)) / Decimal("100")).quantize(Decimal("0.01"))
            order.delivery_fee = delivery_fee
            order.total = items_total + delivery_fee + order.tip_amount

            if pay_method == CafeOrder.PayMethod.ONLINE:
                order.status = CafeOrder.Status.AWAITING_PAYMENT
                order.save()
                return_base = (
                    f"{settings.FRONTEND_URL}/t/{sess.table.public_token}"
                    if sess.table_id
                    else f"{settings.FRONTEND_URL}/m/{provider.organization_slug}"
                )
                return_url = f"{return_base}?order={order.id}"
                yk = create_payment(
                    amount=str(order.total),
                    description=f"Заказ #{order.id} — {provider.organization_name or 'Вместе'}",
                    return_url=return_url,
                    metadata={"type": "cafe_order", "order_id": str(order.id)},
                )
                if yk and yk.get("id"):
                    order.yookassa_payment_id = yk["id"]
                    order.confirmation_url = (yk.get("confirmation") or {}).get("confirmation_url") or ""
                    order.save(update_fields=["yookassa_payment_id", "confirmation_url", "updated_at"])
                elif settings.DEBUG or not (settings.YOOKASSA_SHOP_ID and settings.YOOKASSA_SECRET_KEY):
                    order.status = CafeOrder.Status.PAID
                    order.paid_at = timezone.now()
                    order.save(update_fields=["status", "paid_at", "updated_at"])
            else:
                order.status = CafeOrder.Status.ACCEPTED
                order.save()

            lines = [f"{row.name} × {row.quantity} — {row.line_total} ₽" for row in order.items.all()]
            if order.delivery_fee > 0:
                lines.append(f"Доставка — {order.delivery_fee} ₽")
            if order.tip_amount > 0:
                lines.append(f"Чаевые ({order.tip_percent}%) — {order.tip_amount} ₽")
            try:
                send_cafe_order_receipt_email(
                    email=order.guest_email,
                    organization_name=provider.organization_name or provider.username,
                    order_id=order.id,
                    lines=lines,
                    total=f"{order.total} ₽",
                )
            except Exception:
                pass

        return Response(CafeOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CafeMenuItemRateView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, pk):
        try:
            rating = int(request.data.get("rating") or 0)
        except (TypeError, ValueError):
            rating = 0
        if rating < 1 or rating > 5:
            return Response({"rating": ["Оценка от 1 до 5."]}, status=status.HTTP_400_BAD_REQUEST)
        item = get_object_or_404(CafeMenuItem, pk=pk, is_active=True)
        item.rating_sum += rating
        item.rating_count += 1
        item.save(update_fields=["rating_sum", "rating_count", "updated_at"])
        return Response(
            {
                "id": item.id,
                "rating_avg": round(item.rating_sum / item.rating_count, 1),
                "rating_count": item.rating_count,
            }
        )

from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import (
    CafeFloorPlan,
    CafeGuestSession,
    CafeMenuCategory,
    CafeMenuItem,
    CafeMenuItemPhoto,
    CafeMenuItemRemovableIngredient,
    CafeOrder,
    CafeOrderItem,
    CafeOrderItemRating,
    CafeSettings,
    CafeTable,
)
from .receipt_service import SERVICE_CHARGE_PERCENT, send_order_receipt_after_payment
from .serializers import (
    CafeFloorPlanSerializer,
    CafeMenuCategorySerializer,
    CafeMenuItemPhotoSerializer,
    CafeMenuItemRemovableIngredientSerializer,
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


def _provider_hours_payload(provider) -> dict:
    from users.org_profile import provider_working_hours_payload

    return provider_working_hours_payload(provider)


def _reject_if_cafe_closed(provider):
    """Блокирует оформление заказа вне графика работы организации."""
    from users.org_profile import is_organization_open_now, organization_closed_order_detail, normalize_working_hours

    hours = normalize_working_hours(getattr(provider, "organization_working_hours", None) or {})
    if is_organization_open_now(hours):
        return None
    return Response(
        {"detail": organization_closed_order_detail(hours)},
        status=status.HTTP_400_BAD_REQUEST,
    )


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


def _guest_pay_methods(settings_obj):
    """Онлайн только если у организации свои ключи ЮKassa — без fallback на платформу."""
    return {
        "online": settings_obj.online_payment_ready(),
        "cash": settings_obj.accept_cash,
        "card_on_spot": settings_obj.accept_card_on_spot,
    }



class CafeSettingsView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        from users.slug_utils import ensure_organization_slug

        ensure_organization_slug(request.user)
        return Response(
            CafeSettingsSerializer(_get_or_create_settings(request.user), context={"request": request}).data
        )

    def patch(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        obj = _get_or_create_settings(request.user)
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        for secret_key in (
            "yookassa_secret_key",
            "tbank_password",
            "cloudpayments_api_secret",
            "robokassa_password1",
            "robokassa_password2",
        ):
            if not str(data.get(secret_key) or "").strip():
                data.pop(secret_key, None)
        if request.data.get("clear_logo") in ("1", "true", True):
            if obj.logo:
                obj.logo.delete(save=False)
            obj.logo = None
            obj.save(update_fields=["logo", "updated_at"])
            return Response(CafeSettingsSerializer(obj, context={"request": request}).data)
        ser = CafeSettingsSerializer(obj, data=data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeSettingsSerializer(obj, context={"request": request}).data)


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
        qs = CafeMenuCategory.objects.filter(provider=request.user).prefetch_related(
            "items__photos",
            "items__removable_ingredients",
        )
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


class CafeMenuItemIngredientView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, item_id):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        item = get_object_or_404(CafeMenuItem, pk=item_id, category__provider=request.user)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"name": ["Укажите название."]}, status=status.HTTP_400_BAD_REQUEST)
        ing = CafeMenuItemRemovableIngredient.objects.create(item=item, name=name[:120])
        return Response(
            CafeMenuItemRemovableIngredientSerializer(ing).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, item_id, ingredient_id=None):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        if not ingredient_id:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        ing = get_object_or_404(
            CafeMenuItemRemovableIngredient,
            pk=ingredient_id,
            item_id=item_id,
            item__category__provider=request.user,
        )
        ing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeProviderOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = CafeOrder.objects.filter(provider=request.user).prefetch_related("items")[:100]
        return Response(CafeOrderSerializer(qs, many=True).data)

    def post(self, request):
        """Официант создаёт заказ за стол."""
        if not _is_cafe_provider(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        try:
            table_id = int(request.data.get("table") or 0)
        except (TypeError, ValueError):
            table_id = 0
        table = (
            CafeTable.objects.select_related("floor_plan")
            .filter(pk=table_id, floor_plan__provider=request.user, is_active=True)
            .first()
        )
        if not table:
            return Response({"table": ["Укажите стол."]}, status=status.HTTP_400_BAD_REQUEST)
        raw_items = request.data.get("items") or []
        if not isinstance(raw_items, list) or not raw_items:
            return Response({"items": ["Добавьте блюда."]}, status=status.HTTP_400_BAD_REQUEST)
        pay_method = (request.data.get("pay_method") or CafeOrder.PayMethod.CASH).strip()
        if pay_method not in {c[0] for c in CafeOrder.PayMethod.choices}:
            pay_method = CafeOrder.PayMethod.CASH
        with transaction.atomic():
            order = CafeOrder.objects.create(
                provider=request.user,
                table=table,
                mode=CafeOrder.Mode.DINE_IN,
                pay_method=pay_method,
                guest_name=(request.data.get("guest_name") or "").strip()[:120],
                guest_phone=(request.data.get("guest_phone") or "").strip()[:30],
                comment=(request.data.get("comment") or "").strip()[:1000],
                status=CafeOrder.Status.ACCEPTED,
                include_service_charge=False,
            )
            items_total = Decimal("0")
            for row in raw_items:
                try:
                    mid = int(row.get("menu_item"))
                    qty = max(1, int(row.get("quantity") or 1))
                except (TypeError, ValueError):
                    continue
                menu_item = CafeMenuItem.objects.filter(
                    pk=mid, category__provider=request.user, is_active=True, is_available=True
                ).prefetch_related("removable_ingredients").first()
                if not menu_item:
                    continue
                allowed = {i.name for i in menu_item.removable_ingredients.all()}
                removed = []
                for name in row.get("removed_ingredients") or []:
                    name = str(name).strip()
                    if name and name in allowed and name not in removed:
                        removed.append(name)
                CafeOrderItem.objects.create(
                    order=order,
                    menu_item=menu_item,
                    name=menu_item.name,
                    unit_price=menu_item.price,
                    quantity=qty,
                    removed_ingredients=removed,
                )
                items_total += Decimal(menu_item.price) * qty
            if items_total <= 0:
                order.delete()
                return Response({"items": ["Нет доступных позиций."]}, status=status.HTTP_400_BAD_REQUEST)
            order.items_total = items_total
            order.total = items_total
            order.provider_payout_amount = items_total
            order.save()
            table.is_occupied = True
            try:
                guests = max(0, min(30, int(request.data.get("guest_count") or table.guest_count or 0)))
            except (TypeError, ValueError):
                guests = table.guest_count or 0
            if guests:
                table.guest_count = guests
            table.save(update_fields=["is_occupied", "guest_count"])
        return Response(CafeOrderSerializer(order).data, status=status.HTTP_201_CREATED)

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
        if new_status in (CafeOrder.Status.DONE, CafeOrder.Status.CANCELLED) and order.table_id:
            active = CafeOrder.objects.filter(
                table_id=order.table_id,
                status__in=[
                    CafeOrder.Status.ACCEPTED,
                    CafeOrder.Status.COOKING,
                    CafeOrder.Status.READY,
                    CafeOrder.Status.PAID,
                    CafeOrder.Status.AWAITING_PAYMENT,
                ],
            ).exclude(pk=order.pk).exists()
            if not active:
                CafeTable.objects.filter(pk=order.table_id).update(is_occupied=False, guest_count=0)
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
        logo_url = ""
        if settings_obj.logo:
            logo_url = request.build_absolute_uri(settings_obj.logo.url)
        return Response(
            {
                "table_label": table.label,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug or "",
                "logo_url": logo_url,
                "need_pin": True,
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                **_provider_hours_payload(provider),
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
        logo_url = ""
        if settings_obj.logo:
            logo_url = request.build_absolute_uri(settings_obj.logo.url)
        return Response(
            {
                "session_token": sess.token,
                "expires_at": sess.expires_at,
                "table_label": table.label,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": getattr(provider, "organization_slug", "") or "",
                "logo_url": logo_url,
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                "pay_methods": _guest_pay_methods(settings_obj),
                "delivery_info": settings_obj.delivery_info,
                "delivery_fee": str(settings_obj.delivery_fee),
                "delivery_min_order": str(settings_obj.delivery_min_order),
                **_provider_hours_payload(provider),
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
        logo_url = ""
        if settings_obj.logo:
            logo_url = request.build_absolute_uri(settings_obj.logo.url)
        return Response(
            {
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug,
                "organization_address": provider.organization_address or "",
                "logo_url": logo_url,
                "need_pin": False,
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                **_provider_hours_payload(provider),
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
        if not (
            settings_obj.enable_takeaway
            or settings_obj.enable_delivery
            or settings_obj.enable_dine_in
        ):
            return Response({"detail": "Заказ через меню сейчас недоступен."}, status=status.HTTP_400_BAD_REQUEST)
        sess = CafeGuestSession.create_session(provider=provider, table=None)
        logo_url = ""
        if settings_obj.logo:
            logo_url = request.build_absolute_uri(settings_obj.logo.url)
        return Response(
            {
                "session_token": sess.token,
                "expires_at": sess.expires_at,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug,
                "logo_url": logo_url,
                "table_label": "",
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                "pay_methods": _guest_pay_methods(settings_obj),
                "delivery_info": settings_obj.delivery_info,
                "delivery_fee": str(settings_obj.delivery_fee),
                "delivery_min_order": str(settings_obj.delivery_min_order),
                **_provider_hours_payload(provider),
            }
        )


class CafeOrgDineInAttachView(APIView):
    """Привязать сессию к столу по PIN (вход с меню / карты без QR стола)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request, slug):
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
        if not settings_obj.enable_dine_in:
            return Response({"detail": "Режим «за столом» отключён."}, status=status.HTTP_400_BAD_REQUEST)
        pin = (request.data.get("pin") or "").strip()
        if len(pin) != 6 or not pin.isdigit():
            return Response({"pin": ["Введите 6-значный код стола."]}, status=status.HTTP_400_BAD_REQUEST)
        table = (
            CafeTable.objects.select_related("floor_plan")
            .filter(floor_plan__provider=provider, is_active=True, pin_code=pin)
            .order_by("id")
            .first()
        )
        if not table:
            return Response({"pin": ["Неверный код стола."]}, status=status.HTTP_400_BAD_REQUEST)
        sess = CafeGuestSession.create_for_table(table)
        logo_url = ""
        if settings_obj.logo:
            logo_url = request.build_absolute_uri(settings_obj.logo.url)
        return Response(
            {
                "session_token": sess.token,
                "expires_at": sess.expires_at,
                "table_label": table.label,
                "organization_name": provider.organization_name or provider.username,
                "provider_slug": provider.organization_slug or "",
                "logo_url": logo_url,
                "modes": {
                    "dine_in": settings_obj.enable_dine_in,
                    "takeaway": settings_obj.enable_takeaway,
                    "delivery": settings_obj.enable_delivery,
                },
                "pay_methods": _guest_pay_methods(settings_obj),
                "delivery_info": settings_obj.delivery_info,
                "delivery_fee": str(settings_obj.delivery_fee),
                "delivery_min_order": str(settings_obj.delivery_min_order),
                **_provider_hours_payload(provider),
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
            "items__photos",
            "items__removable_ingredients",
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
        closed = _reject_if_cafe_closed(provider)
        if closed:
            return closed
        settings_obj = _get_or_create_settings(provider)
        mode = (request.data.get("mode") or "").strip()
        if mode == CafeOrder.Mode.DINE_IN:
            if not settings_obj.enable_dine_in:
                return Response({"mode": ["Режим «за столом» отключён."]}, status=status.HTTP_400_BAD_REQUEST)
            if not sess.table_id:
                return Response(
                    {"mode": ["Для заказа за столом введите код стола."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if mode == CafeOrder.Mode.TAKEAWAY and not settings_obj.enable_takeaway:
            return Response({"mode": ["Самовывоз отключён."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode == CafeOrder.Mode.DELIVERY and not settings_obj.enable_delivery:
            return Response({"mode": ["Доставка отключена."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode not in {c[0] for c in CafeOrder.Mode.choices}:
            return Response({"mode": ["Укажите режим."]}, status=status.HTTP_400_BAD_REQUEST)

        pay_method = (request.data.get("pay_method") or CafeOrder.PayMethod.ONLINE).strip()
        if pay_method == CafeOrder.PayMethod.ONLINE and not settings_obj.online_payment_ready():
            return Response(
                {
                    "pay_method": [
                        "Онлайн-оплата недоступна: организация не подключила свой магазин ЮKassa "
                        "(Shop ID и Secret Key в «Режимы и оплата»)."
                    ]
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
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
        include_service_charge = bool(request.data.get("include_service_charge", True))
        tip_custom = bool(request.data.get("tip_custom"))
        try:
            tip_percent = max(0, min(100, int(request.data.get("tip_percent") or 0)))
        except (TypeError, ValueError):
            tip_percent = 0
        try:
            tip_amount_raw = Decimal(str(request.data.get("tip_amount") or 0))
            if tip_amount_raw < 0:
                tip_amount_raw = Decimal("0")
        except Exception:
            tip_amount_raw = Decimal("0")
        if mode == CafeOrder.Mode.DELIVERY and not delivery_address:
            return Response({"delivery_address": ["Укажите адрес доставки."]}, status=status.HTTP_400_BAD_REQUEST)
        if mode in (CafeOrder.Mode.TAKEAWAY, CafeOrder.Mode.DELIVERY) and not guest_phone:
            return Response({"guest_phone": ["Укажите телефон."]}, status=status.HTTP_400_BAD_REQUEST)

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
                include_service_charge=include_service_charge,
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
                ).prefetch_related("removable_ingredients").first()
                if not menu_item:
                    continue
                allowed = {i.name for i in menu_item.removable_ingredients.all()}
                removed = []
                for name in row.get("removed_ingredients") or []:
                    name = str(name).strip()
                    if name and name in allowed and name not in removed:
                        removed.append(name)
                CafeOrderItem.objects.create(
                    order=order,
                    menu_item=menu_item,
                    name=menu_item.name,
                    unit_price=menu_item.price,
                    quantity=qty,
                    removed_ingredients=removed,
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

            if tip_custom:
                tip_amount = tip_amount_raw.quantize(Decimal("0.01"))
                tip_percent = 0
            else:
                tip_amount = ((items_total * Decimal(tip_percent)) / Decimal("100")).quantize(Decimal("0.01"))

            service_charge_amount = Decimal("0")
            if include_service_charge:
                service_charge_amount = (
                    (items_total * Decimal(SERVICE_CHARGE_PERCENT)) / Decimal("100")
                ).quantize(Decimal("0.01"))

            order.items_total = items_total
            order.tip_percent = tip_percent
            order.tip_amount = tip_amount
            order.tip_custom = tip_custom
            order.delivery_fee = delivery_fee
            order.service_charge_amount = service_charge_amount
            order.total = items_total + delivery_fee + tip_amount + service_charge_amount
            order.provider_payout_amount = order.total - service_charge_amount

            org_shop_id = (settings_obj.yookassa_shop_id or "").strip()
            org_secret = (settings_obj.yookassa_secret_key or "").strip()

            if pay_method == CafeOrder.PayMethod.ONLINE:
                from payments.gateway import create_org_payment, provider_ready

                code = settings_obj.payment_provider or "yookassa"
                creds = settings_obj.payment_creds()
                if not provider_ready(code, creds):
                    order.delete()
                    return Response(
                        {
                            "pay_method": [
                                "Онлайн-оплата недоступна: укажите ключи выбранного эквайера в настройках зала."
                            ]
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                order.status = CafeOrder.Status.AWAITING_PAYMENT
                order.save()
                return_base = (
                    f"{settings.FRONTEND_URL}/t/{sess.table.public_token}"
                    if sess.table_id
                    else f"{settings.FRONTEND_URL}/m/{provider.organization_slug}"
                )
                return_url = f"{return_base}?order={order.id}"
                pay = create_org_payment(
                    provider_code=code,
                    creds=creds,
                    amount=order.total,
                    description=f"Заказ #{order.id} — {provider.organization_name or 'Вместе'}",
                    return_url=return_url,
                    fail_url=return_url,
                    metadata={"type": "cafe_order", "order_id": str(order.id)},
                    order_id=f"c{order.id}",
                )
                if pay and pay.get("id"):
                    order.yookassa_payment_id = pay["id"]
                    order.confirmation_url = pay.get("confirmation_url") or ""
                    order.save(update_fields=["yookassa_payment_id", "confirmation_url", "updated_at"])
                else:
                    order.delete()
                    return Response(
                        {
                            "detail": "Не удалось создать платёж. Проверьте ключи эквайера организации."
                        },
                        status=status.HTTP_502_BAD_GATEWAY,
                    )
            else:
                order.status = CafeOrder.Status.ACCEPTED
                order.save()
                send_order_receipt_after_payment(order)

        return Response(CafeOrderSerializer(order).data, status=status.HTTP_201_CREATED)


class CafeGuestOrderDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, order_id):
        sess = _session_from_request(request)
        if not sess:
            return Response({"detail": "Нужна авторизация меню."}, status=status.HTTP_401_UNAUTHORIZED)
        order = CafeOrder.objects.filter(pk=order_id, guest_session_token=sess.token).prefetch_related(
            "items", "item_ratings"
        ).first()
        if not order:
            return Response({"detail": "Заказ не найден."}, status=status.HTTP_404_NOT_FOUND)
        return Response(CafeOrderSerializer(order).data)


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
        try:
            order_id = int(request.data.get("order_id") or 0)
        except (TypeError, ValueError):
            order_id = 0
        if not order_id:
            return Response({"order_id": ["Укажите заказ."]}, status=status.HTTP_400_BAD_REQUEST)
        sess = _session_from_request(request)
        if not sess:
            return Response({"detail": "Нужна авторизация меню."}, status=status.HTTP_401_UNAUTHORIZED)
        order = CafeOrder.objects.filter(pk=order_id, guest_session_token=sess.token).first()
        if not order:
            return Response({"order_id": ["Заказ не найден."]}, status=status.HTTP_404_NOT_FOUND)
        if order.status not in {
            CafeOrder.Status.PAID,
            CafeOrder.Status.ACCEPTED,
            CafeOrder.Status.COOKING,
            CafeOrder.Status.READY,
            CafeOrder.Status.DELIVERING,
            CafeOrder.Status.DONE,
        }:
            return Response({"order_id": ["Оценить блюда можно после оформления заказа."]}, status=status.HTTP_400_BAD_REQUEST)
        item = get_object_or_404(CafeMenuItem, pk=pk, is_active=True)
        if not order.items.filter(menu_item_id=item.id).exists():
            return Response({"detail": ["Это блюдо не входило в заказ."]}, status=status.HTTP_400_BAD_REQUEST)
        if CafeOrderItemRating.objects.filter(order=order, menu_item=item).exists():
            return Response({"detail": ["Вы уже оценили это блюдо."]}, status=status.HTTP_400_BAD_REQUEST)
        CafeOrderItemRating.objects.create(order=order, menu_item=item, rating=rating)
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

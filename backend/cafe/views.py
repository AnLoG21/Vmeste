from decimal import Decimal
import json

from django.conf import settings
from django.db import transaction
from django.http import HttpResponse
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
from users.models import User
from .receipt_service import SERVICE_CHARGE_PERCENT, build_order_receipt_pdf_bytes, send_order_receipt_after_payment
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


def _phone_digits(raw: str) -> str:
    """Normalize RU phone to last 10 digits (without country code)."""
    digits = "".join(ch for ch in str(raw or "") if ch.isdigit())
    if len(digits) >= 11 and digits[0] in "78":
        return digits[-10:]
    if len(digits) > 10:
        return digits[-10:]
    return digits if len(digits) >= 10 else ""


def _find_client_by_phone(phone: str):
    needle = _phone_digits(phone)
    if not needle:
        return None
    for u in User.objects.filter(role=User.Role.CLIENT).exclude(phone="").iterator(chunk_size=200):
        if _phone_digits(u.phone) == needle:
            return u
    return None


def _find_client_by_email(email: str):
    em = (email or "").strip().lower()
    if not em or "@" not in em:
        return None
    return User.objects.filter(role=User.Role.CLIENT, email__iexact=em).first()


def _client_orders_queryset(user):
    """Orders linked to client account or matching phone/email on guest fields."""
    from django.db.models import Q

    q = Q(client=user)
    phone = _phone_digits(getattr(user, "phone", "") or "")
    email = (getattr(user, "email", "") or "").strip().lower()
    if phone:
        # Broad SQL filter, exact digit match applied after
        q |= Q(guest_phone__icontains=phone[-10:])
    if email:
        q |= Q(guest_email__iexact=email)
    qs = (
        CafeOrder.objects.filter(q)
        .select_related("provider")
        .prefetch_related("items", "item_ratings", "reviews__photos")
        .order_by("-id")
    )
    # Exact phone match filter for safety when phone used
    if phone:
        filtered = []
        for o in qs[:200]:
            if o.client_id == user.id:
                filtered.append(o)
                continue
            if phone and _phone_digits(o.guest_phone) == phone:
                filtered.append(o)
                continue
            if email and (o.guest_email or "").strip().lower() == email:
                filtered.append(o)
        return filtered[:100]
    return list(qs[:100])


def _claim_orders_for_user(user, orders, phone_hint: str = ""):
    """Attach unlinked orders to the authenticated client when identity matches."""
    phone = _phone_digits(getattr(user, "phone", "") or "") or _phone_digits(phone_hint)
    email = (getattr(user, "email", "") or "").strip().lower()
    claimed = []
    for order in orders:
        if order.client_id and order.client_id != user.id:
            continue
        if order.client_id == user.id:
            continue
        match = False
        if phone and _phone_digits(order.guest_phone) == phone:
            match = True
        elif email and (order.guest_email or "").strip().lower() == email:
            match = True
        elif phone_hint and _phone_digits(order.guest_phone) == _phone_digits(phone_hint):
            match = True
        if match:
            order.client = user
            order.save(update_fields=["client", "updated_at"])
            claimed.append(order.id)
            # Fill empty profile phone so future lists match
            if not _phone_digits(getattr(user, "phone", "") or "") and _phone_digits(order.guest_phone):
                user.phone = (order.guest_phone or "")[:30]
                user.save(update_fields=["phone"])
                phone = _phone_digits(user.phone)
    return claimed


def _is_cafe_provider(user):
    from users.models import User

    return (
        user
        and user.is_authenticated
        and user.role == User.Role.PROVIDER
        and user.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT
    )


def _gate_cafe(request, **needs):
    from .access import require_cafe

    return require_cafe(request, **needs)


def _cafe_auth(request, **needs):
    provider, _perms, err = _gate_cafe(request, **needs)
    if err:
        return None, err
    return provider, None


def _get_or_create_settings(provider):
    obj, _ = CafeSettings.objects.get_or_create(provider=provider)
    return obj


def _provider_hours_payload(provider) -> dict:
    from users.org_profile import provider_working_hours_payload

    return provider_working_hours_payload(provider)


def _guest_delivery_payload(settings_obj, provider=None) -> dict:
    from .delivery_zones import normalize_delivery_zones

    lat = getattr(provider, "organization_latitude", None) if provider else None
    lon = getattr(provider, "organization_longitude", None) if provider else None
    return {
        "delivery_info": settings_obj.delivery_info,
        "delivery_fee": str(settings_obj.delivery_fee),
        "delivery_min_order": str(settings_obj.delivery_min_order),
        "delivery_zones": normalize_delivery_zones(settings_obj.delivery_zones or []),
        "organization_latitude": float(lat) if lat is not None else None,
        "organization_longitude": float(lon) if lon is not None else None,
    }


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
        provider, err = _cafe_auth(request, need_any=True)
        if err:
            return err
        from users.slug_utils import ensure_organization_slug

        ensure_organization_slug(provider)
        return Response(
            CafeSettingsSerializer(_get_or_create_settings(provider), context={"request": request}).data
        )

    def patch(self, request):
        provider, err = _cafe_auth(request, need_settings=True)
        if err:
            return err
        obj = _get_or_create_settings(provider)
        raw = request.data
        if hasattr(raw, "lists"):
            # QueryDict: JSON-поля могут прийти строкой
            data = {k: raw.get(k) for k in raw.keys()}
        else:
            data = dict(raw)
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
        if "delivery_zones" in data:
            zones_val = data.get("delivery_zones")
            if isinstance(zones_val, str):
                try:
                    zones_val = json.loads(zones_val)
                except json.JSONDecodeError:
                    return Response(
                        {"delivery_zones": ["Некорректный JSON зон."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            from .delivery_zones import normalize_delivery_zones

            data["delivery_zones"] = normalize_delivery_zones(zones_val)
        ser = CafeSettingsSerializer(obj, data=data, partial=True, context={"request": request})
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeSettingsSerializer(obj, context={"request": request}).data)


class CafeFloorPlanListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        provider, err = _cafe_auth(request, need_seating=True, need_orders=True, need_settings=True)
        if err:
            return err
        qs = CafeFloorPlan.objects.filter(provider=provider).prefetch_related("tables")
        return Response(CafeFloorPlanSerializer(qs, many=True).data)

    def post(self, request):
        provider, err = _cafe_auth(request, need_settings=True)
        if err:
            return err
        ser = CafeFloorPlanSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        plan = CafeFloorPlan.objects.create(provider=provider, **ser.validated_data)
        return Response(CafeFloorPlanSerializer(plan).data, status=status.HTTP_201_CREATED)


class CafeFloorPlanDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        
        provider, err = _cafe_auth(request, need_seating=True, need_settings=True)
        if err:
            return err
        plan = get_object_or_404(CafeFloorPlan, pk=pk, provider=provider)
        ser = CafeFloorPlanSerializer(plan, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeFloorPlanSerializer(plan).data)

    def delete(self, request, pk):
        
        provider, err = _cafe_auth(request, need_settings=True)
        if err:
            return err
        plan = get_object_or_404(CafeFloorPlan, pk=pk, provider=provider)
        plan.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeTableListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, plan_id):
        
        provider, err = _cafe_auth(request, need_seating=True, need_orders=True, need_settings=True)
        if err:
            return err
        plan = get_object_or_404(CafeFloorPlan, pk=plan_id, provider=provider)
        ser = CafeTableSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        table = CafeTable.objects.create(floor_plan=plan, **ser.validated_data)
        return Response(CafeTableSerializer(table).data, status=status.HTTP_201_CREATED)


class CafeTableDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        
        provider, err = _cafe_auth(request, need_seating=True, need_orders=True, need_settings=True)
        if err:
            return err
        table = get_object_or_404(CafeTable, pk=pk, floor_plan__provider=provider)
        if request.data.get("clear_waiter_call") in ("1", "true", True):
            table.waiter_called_at = None
            table.save(update_fields=["waiter_called_at"])
            return Response(CafeTableSerializer(table).data)
        ser = CafeTableSerializer(table, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(CafeTableSerializer(table).data)

    def delete(self, request, pk):
        
        provider, err = _cafe_auth(request, need_settings=True)
        if err:
            return err
        table = get_object_or_404(CafeTable, pk=pk, floor_plan__provider=provider)
        table.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuCategoryListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        
        provider, err = _cafe_auth(request, need_menu=True, need_orders=True)
        if err:
            return err
        qs = CafeMenuCategory.objects.filter(provider=provider).prefetch_related(
            "items__photos",
            "items__removable_ingredients",
        )
        return Response(CafeMenuCategorySerializer(qs, many=True, context={"request": request}).data)

    def post(self, request):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        ser = CafeMenuCategorySerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data
        if data.get("is_novelties"):
            CafeMenuCategory.objects.filter(provider=provider, is_novelties=True).update(is_novelties=False)
        cat = CafeMenuCategory.objects.create(provider=provider, **data)
        return Response(
            CafeMenuCategorySerializer(cat, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CafeMenuCategoryDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        
        provider, err = _cafe_auth(request, need_menu=True, need_orders=True)
        if err:
            return err
        cat = get_object_or_404(CafeMenuCategory, pk=pk, provider=provider)
        ser = CafeMenuCategorySerializer(cat, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if ser.validated_data.get("is_novelties"):
            CafeMenuCategory.objects.filter(provider=provider, is_novelties=True).exclude(pk=cat.pk).update(
                is_novelties=False
            )
        ser.save()
        return Response(CafeMenuCategorySerializer(cat, context={"request": request}).data)

    def delete(self, request, pk):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        cat = get_object_or_404(CafeMenuCategory, pk=pk, provider=provider)
        cat.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuItemListCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        ser = CafeMenuItemSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        cat = ser.validated_data["category"]
        if cat.provider_id != provider.id:
            return Response({"category": ["Чужая категория."]}, status=status.HTTP_400_BAD_REQUEST)
        item = CafeMenuItem.objects.create(**ser.validated_data)
        return Response(
            CafeMenuItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CafeMenuItemDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        
        provider, err = _cafe_auth(request, need_menu=True, need_orders=True)
        if err:
            return err
        item = get_object_or_404(CafeMenuItem, pk=pk, category__provider=provider)
        ser = CafeMenuItemSerializer(item, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        if "category" in ser.validated_data and ser.validated_data["category"].provider_id != provider.id:
            return Response({"category": ["Чужая категория."]}, status=status.HTTP_400_BAD_REQUEST)
        ser.save()
        return Response(CafeMenuItemSerializer(item, context={"request": request}).data)

    def delete(self, request, pk):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        item = get_object_or_404(CafeMenuItem, pk=pk, category__provider=provider)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuItemPhotoView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, item_id):
        
        provider, err = _cafe_auth(request, need_menu=True, need_orders=True)
        if err:
            return err
        item = get_object_or_404(CafeMenuItem, pk=item_id, category__provider=provider)
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
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        if not photo_id:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        photo = get_object_or_404(
            CafeMenuItemPhoto,
            pk=photo_id,
            item_id=item_id,
            item__category__provider=provider,
        )
        photo.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeMenuItemIngredientView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, item_id):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        item = get_object_or_404(CafeMenuItem, pk=item_id, category__provider=provider)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"name": ["Укажите название."]}, status=status.HTTP_400_BAD_REQUEST)
        ing = CafeMenuItemRemovableIngredient.objects.create(item=item, name=name[:120])
        return Response(
            CafeMenuItemRemovableIngredientSerializer(ing).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, item_id, ingredient_id=None):
        
        provider, err = _cafe_auth(request, need_menu=True)
        if err:
            return err
        if not ingredient_id:
            return Response(status=status.HTTP_400_BAD_REQUEST)
        ing = get_object_or_404(
            CafeMenuItemRemovableIngredient,
            pk=ingredient_id,
            item_id=item_id,
            item__category__provider=provider,
        )
        ing.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CafeProviderOrdersView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        
        provider, err = _cafe_auth(request, need_orders=True, need_kitchen=True, need_delivery=True, need_seating=True)
        if err:
            return err
        qs = CafeOrder.objects.filter(provider=provider).select_related("courier_user").prefetch_related("items")[:100]
        return Response(CafeOrderSerializer(qs, many=True).data)

    def post(self, request):
        """Официант создаёт заказ за стол."""
        
        provider, err = _cafe_auth(request, need_orders=True)
        if err:
            return err
        try:
            table_id = int(request.data.get("table") or 0)
        except (TypeError, ValueError):
            table_id = 0
        table = (
            CafeTable.objects.select_related("floor_plan")
            .filter(pk=table_id, floor_plan__provider=provider, is_active=True)
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
                provider=provider,
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
        try:
            from .notify import notify_new_cafe_order

            notify_new_cafe_order(order)
        except Exception:
            pass
        return Response(CafeOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        
        provider, err = _cafe_auth(request, need_orders=True, need_kitchen=True, need_delivery=True)
        if err:
            return err
        order = get_object_or_404(CafeOrder, pk=pk, provider=provider)
        new_status = (request.data.get("status") or "").strip()
        allowed = {c[0] for c in CafeOrder.Status.choices}
        if new_status not in allowed:
            return Response({"status": ["Некорректный статус."]}, status=status.HTTP_400_BAD_REQUEST)
        order.status = new_status
        update_fields = ["status", "updated_at"]
        if "courier_user" in request.data or "courier_user_id" in request.data:
            raw_c = request.data.get("courier_user", request.data.get("courier_user_id"))
            if raw_c in (None, "", "null"):
                order.courier_user_id = None
                update_fields.append("courier_user")
            else:
                try:
                    cid = int(raw_c)
                except (TypeError, ValueError):
                    return Response({"courier_user": ["Некорректный сотрудник."]}, status=status.HTTP_400_BAD_REQUEST)
                from booking.models import ProviderStaff

                ok = ProviderStaff.objects.filter(
                    provider=provider,
                    staff_id=cid,
                    is_active=True,
                    invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
                ).exists()
                if not ok and cid != provider.id:
                    return Response(
                        {"courier_user": ["Сотрудник не найден в организации."]},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                order.courier_user_id = cid
                update_fields.append("courier_user")
        if "courier_lat" in request.data and "courier_lon" in request.data:
            try:
                clat = float(request.data.get("courier_lat"))
                clon = float(request.data.get("courier_lon"))
                if abs(clat) < 0.0001 and abs(clon) < 0.0001:
                    return Response(
                        {"detail": "Некорректные координаты курьера."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if abs(clat) > 90 or abs(clon) > 180:
                    return Response(
                        {"detail": "Некорректные координаты курьера."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                order.courier_lat = clat
                order.courier_lon = clon
                from django.utils import timezone as dj_tz

                order.courier_updated_at = dj_tz.now()
                update_fields.extend(["courier_lat", "courier_lon", "courier_updated_at"])
            except (TypeError, ValueError):
                return Response(
                    {"detail": "Некорректные координаты курьера."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        order.save(update_fields=update_fields)
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


class CafeOrderReceiptView(APIView):
    """PDF-чек заказа для печати (браузер / термопринтер)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        
        provider, err = _cafe_auth(request, need_orders=True, need_kitchen=True, need_delivery=True, need_seating=True)
        if err:
            return err
        order = (
            CafeOrder.objects.filter(pk=pk, provider=provider)
            .prefetch_related("items")
            .select_related("provider")
            .first()
        )
        if not order:
            return Response({"detail": "Заказ не найден."}, status=status.HTTP_404_NOT_FOUND)
        pdf_bytes = build_order_receipt_pdf_bytes(order)
        if not pdf_bytes:
            return Response({"detail": "Не удалось сформировать чек."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        resp = HttpResponse(pdf_bytes, content_type="application/pdf")
        resp["Content-Disposition"] = f'inline; filename="cafe-order-{order.id}.pdf"'
        return resp


class CafeGuestCallWaiterView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        sess = _session_from_request(request)
        if not sess:
            return Response({"detail": "Нужна авторизация меню."}, status=status.HTTP_401_UNAUTHORIZED)
        table = sess.table
        if not table:
            return Response(
                {"detail": "Вызов официанта доступен только за столом."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        table.waiter_called_at = timezone.now()
        table.save(update_fields=["waiter_called_at"])
        try:
            from .notify import notify_waiter_call

            notify_waiter_call(table)
        except Exception:
            pass
        return Response(
            {
                "ok": True,
                "table_id": table.id,
                "table_label": table.label,
                "waiter_called_at": table.waiter_called_at.isoformat(),
            }
        )


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
                **_guest_delivery_payload(settings_obj, provider),
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
                **_guest_delivery_payload(settings_obj, provider),
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
                **_guest_delivery_payload(settings_obj, provider),
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
    # JWT optional: if client is logged in, order is linked to their account

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
        delivery_apartment = (request.data.get("delivery_apartment") or "").strip()[:32]
        delivery_entrance = (request.data.get("delivery_entrance") or "").strip()[:32]
        delivery_intercom = (request.data.get("delivery_intercom") or "").strip()[:64]
        delivery_private_house = bool(request.data.get("delivery_private_house"))
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
        if mode == CafeOrder.Mode.DELIVERY and not delivery_private_house and not delivery_apartment:
            return Response(
                {"delivery_apartment": ["Укажите квартиру или отметьте «частный дом»."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
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
                delivery_apartment="" if delivery_private_house else delivery_apartment,
                delivery_entrance="" if delivery_private_house else delivery_entrance,
                delivery_intercom="" if delivery_private_house else delivery_intercom,
                delivery_private_house=delivery_private_house,
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
                from .delivery_zones import find_delivery_zone, normalize_delivery_zones

                zones = normalize_delivery_zones(settings_obj.delivery_zones or [])
                zone = None
                if zones:
                    try:
                        d_lat = float(request.data.get("delivery_lat"))
                        d_lon = float(request.data.get("delivery_lon"))
                    except (TypeError, ValueError):
                        order.delete()
                        return Response(
                            {
                                "delivery_address": [
                                    "Укажите точку доставки на карте — адрес должен попадать в зону."
                                ]
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    zone = find_delivery_zone(d_lat, d_lon, zones)
                    if not zone:
                        order.delete()
                        return Response(
                            {
                                "detail": "Адрес вне зон доставки. Выберите точку внутри выделенной области на карте."
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    zone_min = Decimal(str(zone.get("min_order") or 0))
                    zone_fee = Decimal(str(zone.get("fee") or 0))
                    if zone_min <= 0:
                        zone_min = settings_obj.delivery_min_order or Decimal("0")
                    if zone_fee < 0:
                        zone_fee = settings_obj.delivery_fee or Decimal("0")
                    if items_total < zone_min and zone_min > 0:
                        order.delete()
                        return Response(
                            {"detail": f"Минимальная сумма заказа для доставки: {zone_min} ₽."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    delivery_fee = zone_fee
                    # зону в адрес не пишем — клиенту не нужна
                    order.delivery_address = delivery_address
                else:
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
            try:
                d_lat = float(request.data.get("delivery_lat"))
                d_lon = float(request.data.get("delivery_lon"))
                order.delivery_lat = d_lat
                order.delivery_lon = d_lon
            except (TypeError, ValueError):
                pass
            if request.user and getattr(request.user, "is_authenticated", False) and getattr(
                request.user, "role", None
            ) == User.Role.CLIENT:
                order.client = request.user
            else:
                twin = _find_client_by_phone(guest_phone) or _find_client_by_email(guest_email)
                if twin:
                    order.client = twin

            if pay_method == CafeOrder.PayMethod.ONLINE:
                from payments.gateway import create_org_payment, provider_ready
                from payments.resolve import resolve_org_payment_setup

                code, creds = resolve_org_payment_setup(provider)
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

        try:
            from .notify import notify_new_cafe_order

            notify_new_cafe_order(order)
        except Exception:
            pass

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
        if order.status != CafeOrder.Status.DONE:
            return Response(
                {"order_id": ["Оценить блюда можно после завершения заказа."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
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


class CafeClientOrdersView(APIView):
    """Заказы кафе текущего клиента (для раздела «Мои заказы»)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if getattr(user, "role", None) != User.Role.CLIENT and getattr(user, "role", None) != User.Role.PROVIDER:
            # staff etc. — only own client-side orders if any
            pass
        orders = _client_orders_queryset(user)
        # Auto-claim matching unlinked guest orders so they stay under client=
        _claim_orders_for_user(user, [o for o in orders if not o.client_id])
        orders = _client_orders_queryset(user)
        return Response(CafeOrderSerializer(orders, many=True, context={"request": request}).data)

    def post(self, request):
        """Привязать заказы по id (из localStorage гостевого меню), если телефон/email совпали."""
        user = request.user
        raw_ids = request.data.get("order_ids") or []
        phone_hint = (request.data.get("guest_phone") or request.data.get("phone") or "").strip()
        if not isinstance(raw_ids, list):
            return Response({"order_ids": ["Ожидается список id."]}, status=status.HTTP_400_BAD_REQUEST)
        ids = []
        for x in raw_ids[:50]:
            try:
                ids.append(int(x))
            except (TypeError, ValueError):
                continue
        orders = list(CafeOrder.objects.filter(pk__in=ids)) if ids else []
        claimed = _claim_orders_for_user(user, orders, phone_hint=phone_hint)
        # Also claim other phone/email matches
        more = _client_orders_queryset(user)
        claimed += _claim_orders_for_user(user, [o for o in more if not o.client_id], phone_hint=phone_hint)
        if phone_hint and not ids:
            # Claim all guest orders with this phone for the logged-in user
            needle = _phone_digits(phone_hint)
            if needle:
                candidates = list(
                    CafeOrder.objects.filter(client__isnull=True, guest_phone__icontains=needle[-10:])[:100]
                )
                claimed += _claim_orders_for_user(user, candidates, phone_hint=phone_hint)
        return Response({"claimed": list(dict.fromkeys(claimed))})


class CafeClientOrderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        order = (
            CafeOrder.objects.filter(pk=pk)
            .select_related("provider")
            .prefetch_related("items", "item_ratings", "reviews__photos")
            .first()
        )
        if not order:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        ok = order.client_id == request.user.id
        if not ok:
            phone = _phone_digits(getattr(request.user, "phone", "") or "")
            email = (getattr(request.user, "email", "") or "").strip().lower()
            if phone and _phone_digits(order.guest_phone) == phone:
                ok = True
            elif email and (order.guest_email or "").strip().lower() == email:
                ok = True
        if not ok:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        if not order.client_id:
            order.client = request.user
            order.save(update_fields=["client", "updated_at"])
        return Response(CafeOrderSerializer(order, context={"request": request}).data)

    def post(self, request, pk):
        """Оценить блюдо из завершённого заказа (звёзды 1–5)."""
        order = CafeOrder.objects.filter(pk=pk).prefetch_related("items").first()
        if not order:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        ok = order.client_id == request.user.id
        if not ok:
            phone = _phone_digits(getattr(request.user, "phone", "") or "")
            ok = bool(phone and _phone_digits(order.guest_phone) == phone)
        if not ok:
            return Response({"detail": "Не найдено."}, status=status.HTTP_404_NOT_FOUND)
        if order.status != CafeOrder.Status.DONE:
            return Response({"detail": "Оценить можно только завершённый заказ."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            rating = int(request.data.get("rating") or 0)
            menu_item_id = int(request.data.get("menu_item") or 0)
        except (TypeError, ValueError):
            return Response({"detail": "Укажите menu_item и rating."}, status=status.HTTP_400_BAD_REQUEST)
        if rating < 1 or rating > 5:
            return Response({"rating": ["Оценка от 1 до 5."]}, status=status.HTTP_400_BAD_REQUEST)
        if not order.items.filter(menu_item_id=menu_item_id).exists():
            return Response({"detail": "Это блюдо не входило в заказ."}, status=status.HTTP_400_BAD_REQUEST)
        item = CafeMenuItem.objects.filter(pk=menu_item_id, is_active=True).first()
        if not item:
            return Response({"detail": "Блюдо не найдено."}, status=status.HTTP_404_NOT_FOUND)
        if CafeOrderItemRating.objects.filter(order=order, menu_item=item).exists():
            return Response({"detail": "Вы уже оценили это блюдо."}, status=status.HTTP_400_BAD_REQUEST)
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

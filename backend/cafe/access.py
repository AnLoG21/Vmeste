"""Доступ сотрудников к кабинету кафе (как marketplaces/access)."""

from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response

from booking.models import ProviderStaff
from users.models import User

CAFE_PERM_KEYS = (
    "cafe_orders",
    "cafe_kitchen",
    "cafe_seating",
    "cafe_delivery",
    "cafe_menu",
    "cafe_settings",
)


def full_cafe_perms() -> dict:
    return {k: True for k in CAFE_PERM_KEYS}


def staff_cafe_perms(link) -> dict:
    raw = link.permissions if isinstance(getattr(link, "permissions", None), dict) else {}
    return {k: bool(raw.get(k)) for k in CAFE_PERM_KEYS}


def any_cafe_perm(perms: dict) -> bool:
    return any(bool(perms.get(k)) for k in CAFE_PERM_KEYS)


def _staff_cafe_link(user):
    return (
        ProviderStaff.objects.filter(
            staff=user,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
            provider__role=User.Role.PROVIDER,
            provider__provider_sphere=User.ProviderSphere.CAFE_RESTAURANT,
        )
        .select_related("provider")
        .first()
    )


def resolve_cafe_access(request):
    """
    Returns (provider, perms, error_response).
    error_response is None on success.
    """
    user = request.user
    if not user or not user.is_authenticated:
        return None, {}, Response(status=status.HTTP_401_UNAUTHORIZED)

    if user.role == User.Role.PROVIDER and user.provider_sphere == User.ProviderSphere.CAFE_RESTAURANT:
        return user, full_cafe_perms(), None

    if user.role == User.Role.STAFF:
        link = _staff_cafe_link(user)
        if link:
            perms = staff_cafe_perms(link)
            if not any_cafe_perm(perms):
                return None, perms, Response(
                    {"detail": "Нет прав на раздел кафе."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return link.provider, perms, None

    return None, {}, Response(status=status.HTTP_403_FORBIDDEN)


def require_cafe(request, *, need_orders=False, need_kitchen=False, need_seating=False, need_delivery=False, need_menu=False, need_settings=False, need_any=False):
    """
    need_any: достаточно любого cafe_* права (например чтение настроек для отображения).
    Несколько need_*: достаточно одного из запрошенных (OR).
    """
    provider, perms, err = resolve_cafe_access(request)
    if err:
        return None, perms, err

    flags = []
    if need_orders:
        flags.append(bool(perms.get("cafe_orders")))
    if need_kitchen:
        flags.append(bool(perms.get("cafe_kitchen")))
    if need_seating:
        flags.append(bool(perms.get("cafe_seating")))
    if need_delivery:
        flags.append(bool(perms.get("cafe_delivery")))
    if need_menu:
        flags.append(bool(perms.get("cafe_menu")))
    if need_settings:
        flags.append(bool(perms.get("cafe_settings")))

    if need_any:
        if not any_cafe_perm(perms):
            return None, perms, Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)
    elif flags and not any(flags):
        return None, perms, Response({"detail": "Недостаточно прав."}, status=status.HTTP_403_FORBIDDEN)

    request.cafe_provider = provider
    request.cafe_perms = perms
    return provider, perms, None


COURIER_ALLOWED_STATUSES = frozenset({"to_courier", "delivering", "done", "cancelled"})


def delivery_only_perms(perms: dict) -> bool:
    return bool(perms.get("cafe_delivery")) and not bool(perms.get("cafe_orders")) and not bool(perms.get("cafe_kitchen"))


def validate_courier_order_patch(*, perms: dict, order_mode: str, new_status: str) -> str | None:
    """
    If staff is delivery-only, restrict to delivery orders + courier statuses.
    Returns error detail or None when OK.
    """
    if not delivery_only_perms(perms):
        return None
    if order_mode != "delivery":
        return "Курьер может работать только с заказами доставки."
    if new_status not in COURIER_ALLOWED_STATUSES:
        return "Для курьера доступны статусы: передаём курьеру, в пути, завершён, отменён."
    return None

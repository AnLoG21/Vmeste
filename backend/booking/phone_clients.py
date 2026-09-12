"""Поиск и создание клиентов по телефону (без дублей при разном формате номера)."""

from __future__ import annotations

import re
import secrets

from django.contrib.auth import get_user_model

User = get_user_model()


def phone_digits(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) >= 11 and digits[0] in "78":
        return digits[-10:]
    if len(digits) > 10:
        return digits[-10:]
    return digits if len(digits) >= 10 else ""


def normalize_phone(raw: str) -> str:
    digits = re.sub(r"\D+", "", raw or "")
    if len(digits) == 11 and digits.startswith("8"):
        digits = "7" + digits[1:]
    if len(digits) == 10:
        digits = "7" + digits
    if len(digits) == 11 and digits.startswith("7"):
        return "+" + digits
    return (raw or "").strip()[:30]


def find_client_by_phone(phone: str):
    """Найти клиента по номеру: точное совпадение нормализованного или по 10 цифрам."""
    phone_n = normalize_phone(phone)
    needle = phone_digits(phone_n) or phone_digits(phone)
    if not needle:
        return None
    exact = User.objects.filter(phone=phone_n, role=User.Role.CLIENT).first()
    if exact:
        return exact
    # Кандидаты по хвосту номера, затем точное сравнение цифр
    for fragment in (needle[-7:], needle[-4:]):
        qs = (
            User.objects.filter(role=User.Role.CLIENT)
            .exclude(phone="")
            .filter(phone__icontains=fragment)
        )
        for u in qs.iterator(chunk_size=200):
            if phone_digits(u.phone) == needle:
                return u
    return None


def _apply_name(user, name: str) -> None:
    if not name or not user:
        return
    if (user.first_name or "").strip():
        return
    parts = name.strip().split(None, 1)
    user.first_name = parts[0][:30]
    if len(parts) > 1:
        user.last_name = parts[1][:30]
    user.save(update_fields=["first_name", "last_name"])


def get_or_create_client_by_phone(*, phone: str, name: str = ""):
    """
    Найти существующего клиента по телефону или создать guest-аккаунт.
    Не создаёт дубли при +7 / 8 / без кода.
    """
    phone_n = normalize_phone(phone)
    if len(phone_digits(phone_n)) < 10:
        raise ValueError("Укажите корректный телефон.")
    existing = find_client_by_phone(phone_n)
    if existing:
        _apply_name(existing, name)
        # Нормализуем сохранённый телефон, если был в другом формате
        if (existing.phone or "").strip() != phone_n:
            existing.phone = phone_n
            existing.save(update_fields=["phone"])
        return existing
    base = f"guest_{re.sub(r'\D+', '', phone_n)[-10:]}"
    username = base
    for _ in range(8):
        if not User.objects.filter(username=username).exists():
            break
        username = f"{base}_{secrets.token_hex(2)}"
    parts = (name or "").strip().split(None, 1)
    user = User(
        username=username,
        role=User.Role.CLIENT,
        phone=phone_n,
        first_name=(parts[0] if parts else "")[:30],
        last_name=(parts[1] if len(parts) > 1 else "")[:30],
    )
    user.set_unusable_password()
    user.save()
    return user


def client_brief(user, *, request=None, provider_id=None) -> dict:
    if not user:
        return {}
    parts = [user.first_name or "", user.last_name or ""]
    name = " ".join(p for p in parts if p).strip() or user.username
    initial = (name[:1] or "?").upper()
    avatar_url = ""
    try:
        from common.media_urls import photo_urls

        urls = photo_urls(request, getattr(user, "avatar_image", None))
        avatar_url = urls["thumb_url"] or urls["url"] or ""
    except Exception:
        avatar_url = ""
    brief = {
        "id": user.id,
        "username": user.username,
        "phone": user.phone or "",
        "email": (getattr(user, "email", None) or "").strip(),
        "name": name,
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "patronymic": getattr(user, "patronymic", None) or "",
        "avatar_url": avatar_url,
        "avatar_initial": initial,
        "visits_done": 0,
        "last_visit": "",
    }
    if provider_id:
        from .models import Booking

        done_qs = Booking.objects.filter(
            provider_id=provider_id,
            client_id=user.id,
            status=Booking.Status.DONE,
        )
        brief["visits_done"] = done_qs.count()
        last = (
            done_qs.select_related("slot")
            .order_by("-slot__starts_at", "-id")
            .first()
        )
        if last and getattr(last, "slot", None) and last.slot.starts_at:
            from django.utils import timezone as dj_tz

            brief["last_visit"] = dj_tz.localtime(last.slot.starts_at).strftime("%d.%m.%Y")
    return brief


def touch_provider_client_card(provider_id: int, client) -> None:
    """Создать/показать CRM-карточку клиента у провайдера."""
    if not provider_id or not client:
        return
    from .models import ProviderClientCard

    card, _ = ProviderClientCard.objects.get_or_create(provider_id=provider_id, client=client)
    if card.hidden:
        card.hidden = False
        card.save(update_fields=["hidden", "updated_at"])


def ensure_org_client_from_order(
    *,
    provider_id: int,
    phone: str = "",
    name: str = "",
    existing_client=None,
):
    """
    Привязать заказ к User-клиенту и карточке CRM.
    Возвращает client User или None.
    """
    client = existing_client
    if client is not None and getattr(client, "role", None) == User.Role.CLIENT:
        touch_provider_client_card(provider_id, client)
        return client
    phone = (phone or "").strip()
    if phone and len(phone_digits(phone)) >= 10:
        try:
            client = get_or_create_client_by_phone(phone=phone, name=name or "")
        except ValueError:
            return existing_client
        touch_provider_client_card(provider_id, client)
        return client
    return existing_client


def org_client_ids(provider_id: int) -> set[int]:
    """Клиенты базы организации: записи, CRM, заказы кафе/магазина."""
    from .models import Booking, ProviderClientCard

    booking_ids = (
        Booking.objects.filter(provider_id=provider_id)
        .exclude(client_id__isnull=True)
        .values_list("client_id", flat=True)
        .distinct()
    )
    card_ids = ProviderClientCard.objects.filter(provider_id=provider_id, hidden=False).values_list(
        "client_id", flat=True
    )
    hidden_ids = set(
        ProviderClientCard.objects.filter(provider_id=provider_id, hidden=True).values_list(
            "client_id", flat=True
        )
    )
    ids = set(booking_ids) | set(card_ids)

    try:
        from cafe.models import CafeOrder

        ids |= set(
            CafeOrder.objects.filter(provider_id=provider_id)
            .exclude(client_id__isnull=True)
            .values_list("client_id", flat=True)
            .distinct()
        )
        for ph in (
            CafeOrder.objects.filter(provider_id=provider_id, client_id__isnull=True)
            .exclude(guest_phone="")
            .values_list("guest_phone", flat=True)
            .distinct()[:300]
        ):
            u = find_client_by_phone(ph)
            if u:
                ids.add(u.id)
    except Exception:
        pass

    try:
        from shop.models import ShopOrder

        ids |= set(
            ShopOrder.objects.filter(provider_id=provider_id)
            .exclude(client_id__isnull=True)
            .values_list("client_id", flat=True)
            .distinct()
        )
        for ph in (
            ShopOrder.objects.filter(provider_id=provider_id, client_id__isnull=True)
            .exclude(guest_phone="")
            .values_list("guest_phone", flat=True)
            .distinct()[:300]
        ):
            u = find_client_by_phone(ph)
            if u:
                ids.add(u.id)
    except Exception:
        pass

    return ids - hidden_ids


def client_is_blocked_for_provider(provider_id: int, client_id: int) -> bool:
    from .models import ProviderClientCard

    return ProviderClientCard.objects.filter(
        provider_id=provider_id, client_id=client_id, is_blocked=True
    ).exists()


def search_clients_for_provider(provider_id: int, q: str, *, limit: int = 12) -> list:
    """Подсказки только среди клиентов своей базы (записи / CRM), без глобального поиска."""
    from django.db.models import Q

    raw = (q or "").strip()
    if len(raw) < 2:
        return []

    known_ids = org_client_ids(provider_id)
    if not known_ids:
        return []

    qs = User.objects.filter(role=User.Role.CLIENT, id__in=known_ids)

    digits = phone_digits(raw)
    if len(digits) >= 4:
        # Сначала точное совпадение телефона внутри базы
        found = find_client_by_phone(raw)
        if found and found.id in known_ids:
            return [found]
        candidates = list(qs.exclude(phone="").filter(phone__icontains=digits[-7:] if len(digits) >= 7 else digits)[:60])
        out = []
        for u in candidates:
            ud = phone_digits(u.phone)
            if digits in ud or ud.endswith(digits) or ud == digits:
                out.append(u)
            if len(out) >= limit:
                break
        return out

    terms = [t for t in re.split(r"\s+", raw) if t]
    name_q = Q()
    for t in terms:
        name_q &= (
            Q(first_name__icontains=t)
            | Q(last_name__icontains=t)
            | Q(patronymic__icontains=t)
            | Q(username__icontains=t)
        )

    return list(qs.filter(name_q).order_by("last_name", "first_name", "id")[:limit])


def get_or_create_client_by_name(*, name: str, phone: str = ""):
    """Создать guest-клиента по имени (телефон опционален)."""
    name = (name or "").strip()
    phone = (phone or "").strip()
    if phone and len(phone_digits(phone)) >= 10:
        return get_or_create_client_by_phone(phone=phone, name=name)
    if not name:
        raise ValueError("Укажите имя или выберите клиента из базы.")
    parts = name.split(None, 1)
    slug = re.sub(r"[^\w]+", "_", name.lower(), flags=re.UNICODE).strip("_")[:18] or "guest"
    base = f"guest_{slug}"
    username = base
    for _ in range(8):
        if not User.objects.filter(username=username).exists():
            break
        username = f"{base}_{secrets.token_hex(2)}"
    user = User(
        username=username[:30],
        role=User.Role.CLIENT,
        phone="",
        first_name=(parts[0] if parts else "")[:30],
        last_name=(parts[1] if len(parts) > 1 else "")[:30],
    )
    user.set_unusable_password()
    user.save()
    return user


def list_clients_for_provider(
    provider_id: int,
    *,
    q: str = "",
    page: int = 1,
    page_size: int = 20,
    request=None,
) -> dict:
    """
    База клиентов организации: кто был записан (или есть CRM-карточка).
    Пагинация page/page_size (по умолчанию 20). Поиск только внутри этой базы.
    """
    from django.db.models import F, Max, OrderBy, Q

    from .models import Booking, ProviderClientCard

    page = max(1, int(page or 1))
    page_size = min(50, max(1, int(page_size or 20)))

    client_ids = org_client_ids(provider_id)
    qs = User.objects.filter(role=User.Role.CLIENT, id__in=client_ids)

    raw = (q or "").strip()
    if len(raw) >= 2:
        digits = phone_digits(raw)
        if len(digits) >= 4:
            qs = qs.filter(
                Q(phone__icontains=digits[-7:] if len(digits) >= 7 else digits)
                | Q(first_name__icontains=raw)
                | Q(last_name__icontains=raw)
                | Q(patronymic__icontains=raw)
                | Q(username__icontains=raw)
            )
        else:
            terms = [t for t in re.split(r"\s+", raw) if t]
            name_q = Q()
            for t in terms:
                name_q &= (
                    Q(first_name__icontains=t)
                    | Q(last_name__icontains=t)
                    | Q(patronymic__icontains=t)
                    | Q(username__icontains=t)
                )
            qs = qs.filter(name_q)

    qs = qs.annotate(
        last_booking_at=Max(
            "client_bookings__slot__starts_at",
            filter=Q(client_bookings__provider_id=provider_id),
        )
    ).order_by(
        OrderBy(F("last_booking_at"), descending=True, nulls_last=True),
        "last_name",
        "first_name",
        "id",
    )

    total = qs.count()
    start = (page - 1) * page_size
    users = list(qs[start : start + page_size])

    cards_by_client = {
        c.client_id: c
        for c in ProviderClientCard.objects.filter(
            provider_id=provider_id, client_id__in=[u.id for u in users]
        )
    }

    from django.db.models import Sum
    from decimal import Decimal

    spent_map = {
        row["client_id"]: row["total"] or Decimal("0")
        for row in Booking.objects.filter(
            provider_id=provider_id,
            client_id__in=[u.id for u in users],
            status=Booking.Status.DONE,
        )
        .values("client_id")
        .annotate(total=Sum("service__price"))
    }

    try:
        from cafe.models import CafeOrder

        cafe_revenue = {
            CafeOrder.Status.PAID,
            CafeOrder.Status.ACCEPTED,
            CafeOrder.Status.COOKING,
            CafeOrder.Status.READY,
            CafeOrder.Status.DELIVERING,
            CafeOrder.Status.DONE,
        }
        for row in (
            CafeOrder.objects.filter(
                provider_id=provider_id,
                client_id__in=[u.id for u in users],
                status__in=cafe_revenue,
            )
            .values("client_id")
            .annotate(total=Sum("total"))
        ):
            cid = row["client_id"]
            spent_map[cid] = (spent_map.get(cid) or Decimal("0")) + (row["total"] or Decimal("0"))
    except Exception:
        pass

    try:
        from shop.models import ShopOrder

        shop_revenue = {
            ShopOrder.Status.PAID,
            ShopOrder.Status.ASSEMBLING,
            ShopOrder.Status.READY,
            ShopOrder.Status.TO_COURIER,
            ShopOrder.Status.DELIVERING,
            ShopOrder.Status.DONE,
        }
        for row in (
            ShopOrder.objects.filter(
                provider_id=provider_id,
                client_id__in=[u.id for u in users],
                status__in=shop_revenue,
            )
            .values("client_id")
            .annotate(total=Sum("total"))
        ):
            cid = row["client_id"]
            spent_map[cid] = (spent_map.get(cid) or Decimal("0")) + (row["total"] or Decimal("0"))
    except Exception:
        pass

    results = []
    sphere = ""
    try:
        provider_user = User.objects.filter(id=provider_id).only("provider_sphere").first()
        sphere = (getattr(provider_user, "provider_sphere", None) or "").strip()
    except Exception:
        sphere = ""

    for u in users:
        brief = client_brief(u, request=request, provider_id=provider_id)
        card = cards_by_client.get(u.id)
        tech = card.tech if card and isinstance(card.tech, dict) else {}
        personal = card.personal if card and isinstance(card.personal, dict) else {}
        brief["has_memory"] = bool(card)
        brief["provider_sphere"] = sphere
        brief["allergies"] = (personal.get("allergies") or "")[:80]
        # Sphere-specific list hints (FE picks by provider_sphere)
        brief["hair_color"] = (tech.get("hair_color") or "")[:80] if sphere != "service_center" and sphere != "shops" else ""
        brief["vehicle_title"] = (tech.get("vehicle_title") or "")[:80]
        brief["vehicle_plate"] = (tech.get("vehicle_plate") or "")[:40]
        brief["mileage_km"] = (tech.get("mileage_km") or "")[:40]
        brief["last_works"] = (tech.get("last_works") or "")[:80]
        brief["preferred_size"] = (tech.get("preferred_size") or "")[:40]
        brief["purchase_notes"] = (tech.get("purchase_notes") or "")[:80]
        brief["is_blocked"] = bool(card.is_blocked) if card else False
        brief["no_show_count"] = int(card.no_show_count or 0) if card else 0
        brief["acquisition_source"] = (card.acquisition_source or "") if card else ""
        spent = spent_map.get(u.id) or Decimal("0")
        brief["total_spent"] = float(spent)
        results.append(brief)

    # VIP: топ 20% по выручке среди текущей страницы + глобально по org — mark top spenders in page relative to org median
    if results:
        all_spent = sorted((r["total_spent"] for r in results), reverse=True)
        vip_threshold = all_spent[max(0, min(len(all_spent) - 1, len(all_spent) // 5))] if all_spent else 0
        for r in results:
            r["is_vip"] = bool(r["total_spent"] > 0 and r["total_spent"] >= vip_threshold and vip_threshold > 0)

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": max(1, (total + page_size - 1) // page_size) if total else 1,
        "results": results,
    }

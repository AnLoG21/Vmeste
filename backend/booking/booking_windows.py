from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import F
from django.db.models.functions import Coalesce
from django.utils import timezone

from catalog.models import Service

from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


def staff_booking_label(user) -> str:
    if not user:
        return "Без сотрудника"
    fn = (user.first_name or "").strip() or user.username
    ln = (user.last_name or "").strip()
    if ln:
        return f"{fn} {ln[0].upper()}."
    return fn


def _org_uses_staff_assignments(provider_id: int) -> bool:
    for link in ProviderStaff.objects.filter(
        provider_id=provider_id,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).prefetch_related("assigned_services", "assigned_categories"):
        if link.assigned_services.exists() or link.assigned_categories.exists():
            return True
    return False


def bookable_service_ids(provider_id: int) -> set[int] | None:
    """
    ID услуг, которые может выполнить хотя бы один принятый мастер.
    None — ограничение по мастерам не используется (все активные услуги).
    """
    if not _org_uses_staff_assignments(provider_id):
        return None
    ids: set[int] = set()
    links = ProviderStaff.objects.filter(
        provider_id=provider_id,
        is_active=True,
        invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
    ).prefetch_related("assigned_services", "assigned_categories")
    for link in links:
        for svc in link.assigned_services.filter(provider_id=provider_id, is_active=True):
            ids.add(svc.id)
        cat_ids = list(link.assigned_categories.filter(provider_id=provider_id).values_list("id", flat=True))
        if cat_ids:
            ids.update(
                Service.objects.filter(
                    provider_id=provider_id,
                    is_active=True,
                    category_id__in=cat_ids,
                ).values_list("id", flat=True)
            )
    return ids


def filter_services_bookable_by_staff(provider_id: int, queryset):
    ids = bookable_service_ids(provider_id)
    if ids is None:
        return queryset
    return queryset.filter(pk__in=ids)


def _staff_ids_for_service(provider_id: int, service: Service) -> list[int | None]:
    links = list(
        ProviderStaff.objects.filter(
            provider_id=provider_id,
            is_active=True,
            invitation_status=ProviderStaff.InvitationStatus.ACCEPTED,
        )
        .prefetch_related("assigned_services", "assigned_categories")
        .select_related("staff")
    )
    if not _org_uses_staff_assignments(provider_id):
        return [None]

    ids = []
    for link in links:
        if link.assigned_services.filter(pk=service.pk).exists():
            ids.append(link.staff_id)
            continue
        if service.category_id and link.assigned_categories.filter(pk=service.category_id).exists():
            ids.append(link.staff_id)
    return ids


def _booked_ranges(provider_id: int, book_date):
    """Busy ranges: (starts, ends, staff_id, anonymous_index)."""
    qs = AvailabilitySlot.objects.filter(
        provider_id=provider_id,
        is_booked=True,
        starts_at__date=book_date,
    ).select_related("booking")
    out = []
    for slot in qs:
        try:
            booking = slot.booking
            if booking.status == Booking.Status.CANCELLED:
                continue
        except Booking.DoesNotExist:
            booking = None
        sid = (booking.staff_id if booking and booking.staff_id else None) or slot.staff_id
        out.append((slot.starts_at, slot.ends_at, sid, slot.anonymous_index))
    return out


def _overlaps_named(start, end, staff_id, booked):
    """Именованный сотрудник конфликтует только с тем же staff_id."""
    if staff_id is None:
        return False
    for bs, be, b_staff, _anon in booked:
        if bs < end and be > start and b_staff is not None and b_staff == staff_id:
            return True
    return False


def _anon_busy_count(start, end, booked) -> int:
    n = 0
    for bs, be, b_staff, _anon in booked:
        if bs < end and be > start and b_staff is None:
            n += 1
    return n


def _anon_busy_indexes(start, end, booked) -> set:
    indexes = set()
    for bs, be, b_staff, anon in booked:
        if bs < end and be > start and b_staff is None:
            indexes.add(anon if anon is not None else 0)
    return indexes


def list_available_windows(provider_id: int, service_id: int, book_date, extra_minutes: int = 0) -> list[dict]:
    try:
        service = Service.objects.get(pk=service_id, provider_id=provider_id, is_active=True)
    except Service.DoesNotExist:
        return []

    total_minutes = max(1, int(service.duration_minutes or 30) + max(0, int(extra_minutes or 0)))
    duration = timedelta(minutes=total_minutes)
    slots = list(
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            starts_at__date=book_date,
        )
        .select_related("staff")
        .order_by("starts_at")
    )
    staff_by_id = {
        l.staff_id: l.staff
        for l in ProviderStaff.objects.filter(provider_id=provider_id).select_related("staff")
    }
    booked = _booked_ranges(provider_id, book_date)
    windows = []
    now = timezone.now()
    allowed = _staff_ids_for_service(provider_id, service)

    named_slots = [s for s in slots if s.staff_id]
    anon_slots = [s for s in slots if not s.staff_id]

    def _anon_allows_service(slot) -> bool:
        ids = getattr(slot, "service_ids", None) or []
        if not ids:
            return True
        try:
            return int(service_id) in {int(x) for x in ids}
        except (TypeError, ValueError):
            return False

    for slot in named_slots:
        if _org_uses_staff_assignments(provider_id) and slot.staff_id not in allowed:
            continue
        sid = slot.staff_id
        cur = slot.starts_at
        while cur + duration <= slot.ends_at:
            w_end = cur + duration
            if cur < now:
                cur += duration
                continue
            if not _overlaps_named(cur, w_end, sid, booked):
                user = staff_by_id.get(sid)
                windows.append(
                    {
                        "starts_at": cur.isoformat(),
                        "ends_at": w_end.isoformat(),
                        "staff_id": sid,
                        "staff_label": staff_booking_label(user),
                        "parent_slot_id": slot.id,
                    }
                )
            cur += duration

    # Одна клиентская полоса «Без сотрудника»: окно доступно, пока есть свободная ёмкость.
    seen_anon_times: set[tuple[str, str]] = set()
    anon_for_service = [s for s in anon_slots if _anon_allows_service(s)]
    for slot in anon_for_service:
        cur = slot.starts_at
        while cur + duration <= slot.ends_at:
            w_end = cur + duration
            if cur < now:
                cur += duration
                continue
            key = (cur.isoformat(), w_end.isoformat())
            if key in seen_anon_times:
                cur += duration
                continue
            covering = [s for s in anon_for_service if s.starts_at <= cur and s.ends_at >= w_end]
            remaining = len(covering) - _anon_busy_count(cur, w_end, booked)
            if remaining > 0:
                seen_anon_times.add(key)
                windows.append(
                    {
                        "starts_at": cur.isoformat(),
                        "ends_at": w_end.isoformat(),
                        "staff_id": None,
                        "staff_label": "Без сотрудника",
                        "parent_slot_id": covering[0].id,
                        "remaining": remaining,
                    }
                )
            cur += duration

    windows.sort(key=lambda w: w["starts_at"])
    return windows


def list_available_dates(provider_id: int, service_id: int, date_from, date_to, extra_minutes: int = 0) -> list[str]:
    """ISO dates in [date_from, date_to] that have at least one bookable window."""
    if date_from > date_to:
        date_from, date_to = date_to, date_from
    slot_days = (
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            starts_at__date__gte=date_from,
            starts_at__date__lte=date_to,
        )
        .dates("starts_at", "day")
    )
    out = []
    for day in slot_days:
        if list_available_windows(provider_id, service_id, day, extra_minutes=extra_minutes):
            out.append(day.isoformat())
    return out


def resolve_selected_options(service, option_ids) -> list[dict]:
    """Validate option IDs and return frozen snapshots."""
    from decimal import Decimal

    if not option_ids:
        return []
    try:
        ids = [int(x) for x in option_ids]
    except (TypeError, ValueError) as exc:
        raise ValueError("Некорректные доп. опции.") from exc
    opts = list(service.options.filter(pk__in=ids, is_active=True))
    if len(opts) != len(set(ids)):
        raise ValueError("Некоторые доп. опции недоступны.")
    return [
        {
            "id": o.id,
            "name": o.name,
            "price": str(Decimal(o.price)),
            "extra_minutes": int(o.extra_minutes or 0),
        }
        for o in opts
    ]


def book_time_window(
    provider_id: int,
    service_id: int,
    starts_at,
    ends_at,
    staff_id,
    client,
    comment: str,
    selected_options: list | None = None,
):
    """Забронировать окно внутри свободного интервала без разрезания исходного слота."""
    service = Service.objects.get(pk=service_id, provider_id=provider_id, is_active=True)
    snapshots = selected_options or []
    booked = _booked_ranges(provider_id, starts_at.date())
    anon_index = None

    if staff_id:
        container = (
            AvailabilitySlot.objects.filter(
                provider_id=provider_id,
                is_booked=False,
                staff_id=staff_id,
                starts_at__lte=starts_at,
                ends_at__gte=ends_at,
            )
            .order_by("starts_at")
            .first()
        )
        if not container:
            raise ValueError("Интервал недоступен.")
        if _overlaps_named(starts_at, ends_at, staff_id, booked):
            raise ValueError("Это время уже занято.")
        sid = staff_id
    else:
        containers = list(
            AvailabilitySlot.objects.filter(
                provider_id=provider_id,
                is_booked=False,
                staff__isnull=True,
                starts_at__lte=starts_at,
                ends_at__gte=ends_at,
            ).order_by(models_order_anon(), "starts_at")
        )
        busy_idx = _anon_busy_indexes(starts_at, ends_at, booked)
        container = None
        for c in containers:
            allowed = getattr(c, "service_ids", None) or []
            if allowed:
                try:
                    if int(service_id) not in {int(x) for x in allowed}:
                        continue
                except (TypeError, ValueError):
                    continue
            idx = c.anonymous_index if c.anonymous_index is not None else 0
            if idx not in busy_idx:
                container = c
                anon_index = c.anonymous_index
                break
        if not container:
            raise ValueError("Интервал недоступен.")
        sid = None

    booked_slot = AvailabilitySlot.objects.create(
        provider_id=provider_id,
        staff_id=sid,
        starts_at=starts_at,
        ends_at=ends_at,
        is_booked=True,
        anonymous_index=anon_index,
    )

    booking = Booking.objects.create(
        client=client,
        provider_id=provider_id,
        service=service,
        slot=booked_slot,
        staff_id=sid,
        comment=(comment or "")[:250],
        selected_options=snapshots,
    )
    try:
        from .booking_actions import notify_new_booking

        notify_new_booking(booking)
    except Exception:
        pass
    return booking


def models_order_anon():
    """Order anonymous seats by index."""
    return Coalesce(F("anonymous_index"), 0)


def manual_hold_window(provider_id: int, starts_at, ends_at, guest_name: str = ""):
    """Забронировать интервал организацией без клиентской записи (hold_label = ФИО/заметка)."""
    if ends_at <= starts_at:
        raise ValueError("Время начала должно быть раньше окончания.")
    booked = _booked_ranges(provider_id, starts_at.date())
    # Prefer matching named container if any cover; else anon capacity
    named = (
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            staff__isnull=False,
            starts_at__lte=starts_at,
            ends_at__gte=ends_at,
        )
        .order_by("starts_at")
        .first()
    )
    if named and not _overlaps_named(starts_at, ends_at, named.staff_id, booked):
        return AvailabilitySlot.objects.create(
            provider_id=provider_id,
            staff_id=named.staff_id,
            starts_at=starts_at,
            ends_at=ends_at,
            is_booked=True,
            hold_label=(guest_name or "").strip()[:120],
        )

    containers = list(
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            staff__isnull=True,
            starts_at__lte=starts_at,
            ends_at__gte=ends_at,
        ).order_by(models_order_anon(), "starts_at")
    )
    busy_idx = _anon_busy_indexes(starts_at, ends_at, booked)
    for c in containers:
        idx = c.anonymous_index if c.anonymous_index is not None else 0
        if idx in busy_idx:
            continue
        return AvailabilitySlot.objects.create(
            provider_id=provider_id,
            staff_id=None,
            starts_at=starts_at,
            ends_at=ends_at,
            is_booked=True,
            hold_label=(guest_name or "").strip()[:120],
            anonymous_index=c.anonymous_index,
        )

    # Fallback: any covering free named seat that isn't busy
    for c in AvailabilitySlot.objects.filter(
        provider_id=provider_id,
        is_booked=False,
        starts_at__lte=starts_at,
        ends_at__gte=ends_at,
    ).order_by("starts_at"):
        if c.staff_id and _overlaps_named(starts_at, ends_at, c.staff_id, booked):
            continue
        if not c.staff_id:
            continue
        return AvailabilitySlot.objects.create(
            provider_id=provider_id,
            staff_id=c.staff_id,
            starts_at=starts_at,
            ends_at=ends_at,
            is_booked=True,
            hold_label=(guest_name or "").strip()[:120],
        )

    raise ValueError("В выбранном диапазоне нет свободного интервала.")


def release_manual_hold(slot: AvailabilitySlot) -> AvailabilitySlot | None:
    """Снять ручную бронь организации (не клиентскую запись). None — слот удалён."""
    if not slot.is_booked:
        raise ValueError("Интервал уже свободен.")
    try:
        _ = slot.booking
        raise ValueError("Это клиентская запись — отмените её в разделе «Записи».")
    except Booking.DoesNotExist:
        pass

    covered_by_free = (
        AvailabilitySlot.objects.filter(
            provider_id=slot.provider_id,
            is_booked=False,
            starts_at__lte=slot.starts_at,
            ends_at__gte=slot.ends_at,
        )
        .exclude(pk=slot.pk)
        .exists()
    )
    if covered_by_free:
        slot.delete()
        return None

    slot.is_booked = False
    slot.hold_label = ""
    slot.save(update_fields=["is_booked", "hold_label"])
    return slot

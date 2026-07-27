from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from catalog.models import Service

from .models import AvailabilitySlot, Booking, ProviderStaff

User = get_user_model()


def staff_booking_label(user) -> str:
    if not user:
        return "Мастер"
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
    """Busy ranges for a day: client bookings and manual holds (is_booked slots)."""
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
        out.append((slot.starts_at, slot.ends_at, sid))
    return out


def _overlaps(start, end, staff_id, booked):
    for bs, be, b_staff in booked:
        if bs < end and be > start:
            if staff_id is None and b_staff is None:
                return True
            if staff_id is not None and b_staff is not None and staff_id == b_staff:
                return True
            if staff_id is None or b_staff is None:
                return True
    return False


def list_available_windows(provider_id: int, service_id: int, book_date) -> list[dict]:
    try:
        service = Service.objects.get(pk=service_id, provider_id=provider_id, is_active=True)
    except Service.DoesNotExist:
        return []

    duration = timedelta(minutes=max(1, int(service.duration_minutes or 30)))
    slots = (
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

    for slot in slots:
        eligible = []
        if slot.staff_id:
            allowed = _staff_ids_for_service(provider_id, service)
            if slot.staff_id in allowed or (None in allowed and not _org_uses_staff_assignments(provider_id)):
                eligible = [slot.staff_id]
        else:
            allowed = _staff_ids_for_service(provider_id, service)
            eligible = [x for x in allowed if x is not None]
            if not eligible and None in allowed:
                eligible = [None]

        cur = slot.starts_at
        while cur + duration <= slot.ends_at:
            w_end = cur + duration
            # Skip windows that already started (or start in the past)
            if cur < now:
                cur += duration
                continue
            for sid in eligible:
                if _overlaps(cur, w_end, sid, booked):
                    continue
                user = staff_by_id.get(sid) if sid else None
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

    windows.sort(key=lambda w: w["starts_at"])
    return windows


def list_available_dates(provider_id: int, service_id: int, date_from, date_to) -> list[str]:
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
        if list_available_windows(provider_id, service_id, day):
            out.append(day.isoformat())
    return out


def book_time_window(provider_id: int, service_id: int, starts_at, ends_at, staff_id, client, comment: str):
    """Забронировать окно внутри свободного интервала без разрезания исходного слота."""
    service = Service.objects.get(pk=service_id, provider_id=provider_id, is_active=True)
    container = (
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            starts_at__lte=starts_at,
            ends_at__gte=ends_at,
        )
        .order_by("starts_at")
        .first()
    )
    if not container:
        raise ValueError("Интервал недоступен.")

    sid = staff_id or container.staff_id
    if _overlaps(starts_at, ends_at, sid, _booked_ranges(provider_id, starts_at.date())):
        raise ValueError("Это время уже занято.")

    # Свободный интервал организатора остаётся целым; занятость — отдельный слот.
    booked_slot = AvailabilitySlot.objects.create(
        provider_id=provider_id,
        staff_id=sid,
        starts_at=starts_at,
        ends_at=ends_at,
        is_booked=True,
    )

    booking = Booking.objects.create(
        client=client,
        provider_id=provider_id,
        service=service,
        slot=booked_slot,
        staff_id=sid,
        comment=(comment or "")[:250],
    )
    try:
        from .booking_actions import notify_new_booking

        notify_new_booking(booking)
    except Exception:
        pass
    return booking


def manual_hold_window(provider_id: int, starts_at, ends_at, guest_name: str = ""):
    """Забронировать интервал организацией без клиентской записи (hold_label = ФИО/заметка)."""
    if ends_at <= starts_at:
        raise ValueError("Время начала должно быть раньше окончания.")
    container = (
        AvailabilitySlot.objects.filter(
            provider_id=provider_id,
            is_booked=False,
            starts_at__lte=starts_at,
            ends_at__gte=ends_at,
        )
        .order_by("starts_at")
        .first()
    )
    if not container:
        raise ValueError("В выбранном диапазоне нет свободного интервала.")

    label = (guest_name or "").strip()[:120]
    sid = container.staff_id
    if _overlaps(starts_at, ends_at, sid, _booked_ranges(provider_id, starts_at.date())):
        raise ValueError("Это время уже занято.")

    return AvailabilitySlot.objects.create(
        provider_id=provider_id,
        staff_id=sid,
        starts_at=starts_at,
        ends_at=ends_at,
        is_booked=True,
        hold_label=label,
    )


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

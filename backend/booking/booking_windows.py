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
    qs = (
        Booking.objects.filter(provider_id=provider_id, slot__starts_at__date=book_date)
        .exclude(status=Booking.Status.CANCELLED)
        .select_related("slot")
    )
    out = []
    for b in qs:
        sid = b.staff_id or b.slot.staff_id
        out.append((b.slot.starts_at, b.slot.ends_at, sid))
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


def book_time_window(provider_id: int, service_id: int, starts_at, ends_at, staff_id, client, comment: str):
    """Забронировать подынтервал внутри свободного слота (при необходимости разрезает слот)."""
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

    booked_slot = None
    if container.starts_at == starts_at and container.ends_at == ends_at:
        booked_slot = container
        booked_slot.is_booked = True
        booked_slot.staff_id = staff_id or container.staff_id
        booked_slot.save(update_fields=["is_booked", "staff"])
    else:
        recurrence = container.recurrence_group
        provider = container.provider
        slot_staff = container.staff_id
        c_start = container.starts_at
        c_end = container.ends_at
        container.delete()
        if c_start < starts_at:
            AvailabilitySlot.objects.create(
                provider=provider,
                staff_id=slot_staff,
                starts_at=c_start,
                ends_at=starts_at,
                is_booked=False,
                recurrence_group=recurrence,
            )
        booked_slot = AvailabilitySlot.objects.create(
            provider=provider,
            staff_id=staff_id or slot_staff,
            starts_at=starts_at,
            ends_at=ends_at,
            is_booked=True,
            recurrence_group=recurrence,
        )
        if ends_at < c_end:
            AvailabilitySlot.objects.create(
                provider=provider,
                staff_id=slot_staff,
                starts_at=ends_at,
                ends_at=c_end,
                is_booked=False,
                recurrence_group=recurrence,
            )

    booking = Booking.objects.create(
        client=client,
        provider_id=provider_id,
        service=service,
        slot=booked_slot,
        staff_id=staff_id or booked_slot.staff_id,
        comment=(comment or "")[:250],
    )
    try:
        from notifications.models import InAppNotification
        from notifications.push import notify_users

        recipients = {provider_id}
        if booking.staff_id:
            recipients.add(booking.staff_id)
        notify_users(
            list(recipients),
            kind=InAppNotification.Kind.BOOKING,
            title="Новая запись",
            body=f"{getattr(service, 'name', 'Услуга')}: клиент записался",
            payload={"booking_id": str(booking.id), "view": "bookings"},
        )
    except Exception:
        pass
    return booking

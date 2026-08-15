"""Shared interactive demo accounts: seed data and rollback of visitor changes."""

from __future__ import annotations

import hashlib
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

DEMO_SPHERES = {
    "hair_salon": {
        "username": "demo_salon",
        "email": "demo.salon@vsevmeste.space",
        "first_name": "Анна",
        "last_name": "Морозова",
        "organization_name": "Студия «Линия»",
        "organization_slug": "demo-salon",
        "address": "Москва, Тверская ул., 7",
        "lat": Decimal("55.760080"),
        "lng": Decimal("37.609230"),
        "phone": "+7 495 000-11-22",
        "label": "Салон красоты",
        "staff": [
            {"username": "demo_salon_staff_1", "first_name": "Анна", "last_name": "Морозова", "job_title": "Мастер маникюра"},
            {"username": "demo_salon_staff_2", "first_name": "Елена", "last_name": "Соколова", "job_title": "Парикмахер"},
        ],
        "clients": [
            {"username": "demo_salon_client_1", "first_name": "Мария", "last_name": "Козлова"},
            {"username": "demo_salon_client_2", "first_name": "Ольга", "last_name": "Новикова"},
            {"username": "demo_salon_client_3", "first_name": "Ирина", "last_name": "Васильева"},
        ],
    },
    "service_center": {
        "username": "demo_autoservice",
        "email": "demo.auto@vsevmeste.space",
        "first_name": "Дмитрий",
        "last_name": "Козлов",
        "organization_name": "Автосервис «Мотор»",
        "organization_slug": "demo-autoservice",
        "address": "Москва, Волгоградский просп., 32",
        "lat": Decimal("55.730210"),
        "lng": Decimal("37.689440"),
        "phone": "+7 495 000-22-33",
        "label": "Автосервис",
        "staff": [
            {"username": "demo_auto_staff_1", "first_name": "Игорь", "last_name": "Петров", "job_title": "Приёмщик"},
            {"username": "demo_auto_staff_2", "first_name": "Сергей", "last_name": "Орлов", "job_title": "Механик"},
        ],
        "clients": [
            {"username": "demo_auto_client_1", "first_name": "Павел", "last_name": "Смирнов"},
            {"username": "demo_auto_client_2", "first_name": "Андрей", "last_name": "Лебедев"},
        ],
    },
    "cafe_restaurant": {
        "username": "demo_cafe",
        "email": "demo.cafe@vsevmeste.space",
        "first_name": "Игорь",
        "last_name": "Смирнов",
        "organization_name": "Кафе «Вместе»",
        "organization_slug": "demo-cafe",
        "address": "Москва, Пятницкая ул., 18",
        "lat": Decimal("55.741920"),
        "lng": Decimal("37.628110"),
        "phone": "+7 495 000-33-44",
        "label": "Кафе",
        "staff": [
            {"username": "demo_cafe_staff_1", "first_name": "Алина", "last_name": "Белова", "job_title": "Администратор зала"},
            {"username": "demo_cafe_staff_2", "first_name": "Никита", "last_name": "Громов", "job_title": "Официант"},
        ],
        "clients": [
            {"username": "demo_cafe_client_1", "first_name": "Екатерина", "last_name": "Ильина"},
        ],
    },
}


def demo_password() -> str:
    raw = (getattr(settings, "DEMO_PASSWORD", "") or "").strip()
    if raw:
        return raw
    digest = hashlib.sha256(f"{settings.SECRET_KEY}:vmeste-demo".encode()).hexdigest()
    return digest[:24]


def _hours():
    return {
        day: {"open": "10:00", "close": "20:00", "closed": False}
        for day in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
    }


def _ensure_user(*, username, email, role, first_name, last_name, **extra):
    user, created = User.objects.get_or_create(
        username=username,
        defaults={
            "email": email,
            "role": role,
            "first_name": first_name,
            "last_name": last_name,
            "email_verified": True,
            "is_demo": True,
            **extra,
        },
    )
    changed = []
    if not user.is_demo:
        user.is_demo = True
        changed.append("is_demo")
    if not user.email_verified:
        user.email_verified = True
        changed.append("email_verified")
    if user.role != role:
        user.role = role
        changed.append("role")
    for key, val in extra.items():
        if getattr(user, key) != val:
            setattr(user, key, val)
            changed.append(key)
    if created or not user.has_usable_password() or not user.check_password(demo_password()):
        user.set_password(demo_password())
        changed.append("password")
    if changed:
        user.save()
    return user


def _seed_usernames(cfg: dict) -> set[str]:
    names = {cfg["username"]}
    names.update(s["username"] for s in cfg["staff"])
    names.update(c["username"] for c in cfg["clients"])
    return names


def _wipe_visitor_data(provider, cfg: dict):
    from booking.models import AvailabilitySlot, Booking, ProviderStaff
    from cafe.models import CafeFloorPlan, CafeGuestSession, CafeMenuCategory, CafeOrder
    from catalog.models import Service, ServiceCategory
    from chat.models import Conversation, ConversationMember
    from locations.models import ProviderLocation
    from reviews.models import Review
    from inspections.models import InspectionReport

    InspectionReport.objects.filter(provider=provider).delete()
    Booking.objects.filter(provider=provider).delete()
    AvailabilitySlot.objects.filter(provider=provider).delete()
    Review.objects.filter(provider=provider).delete()
    CafeOrder.objects.filter(provider=provider).delete()
    CafeGuestSession.objects.filter(provider=provider).delete()
    Service.objects.filter(provider=provider, template_slug="").delete()
    ServiceCategory.objects.filter(provider=provider, template_slug="").delete()
    CafeFloorPlan.objects.filter(provider=provider).delete()
    CafeMenuCategory.objects.filter(provider=provider).delete()
    ProviderLocation.objects.filter(provider=provider).delete()

    keep = _seed_usernames(cfg)
    extra_links = ProviderStaff.objects.filter(provider=provider).exclude(staff__username__in=keep)
    extra_ids = list(extra_links.values_list("staff_id", flat=True))
    extra_links.delete()
    User.objects.filter(id__in=extra_ids, is_demo=True).exclude(username__in=keep).delete()

    conv_ids = list(ConversationMember.objects.filter(user=provider).values_list("conversation_id", flat=True))
    if conv_ids:
        Conversation.objects.filter(id__in=conv_ids).delete()
    Conversation.objects.filter(organization=provider).delete()


def _restore_profile(provider, cfg: dict):
    provider.organization_name = cfg["organization_name"]
    provider.organization_address = cfg["address"]
    provider.organization_latitude = cfg["lat"]
    provider.organization_longitude = cfg["lng"]
    provider.organization_slug = cfg["organization_slug"]
    provider.organization_phones = [cfg["phone"]]
    provider.organization_working_hours = _hours()
    provider.organization_card_note = "Демо-организация. Можно нажимать, создавать записи и услуги — при выходе всё вернётся."
    provider.phone = cfg["phone"]
    provider.first_name = cfg["first_name"]
    provider.last_name = cfg["last_name"]
    provider.provider_sphere = (
        cfg.get("sphere")
        or next(k for k, v in DEMO_SPHERES.items() if v["username"] == cfg["username"])
    )
    provider.save()


def _ensure_subscription(provider):
    from datetime import timedelta as td

    from subscriptions.models import SubscriptionPlan, UserSubscription

    plan = SubscriptionPlan.objects.filter(slug="business", is_active=True).first()
    if not plan:
        plan = SubscriptionPlan.objects.filter(is_active=True).exclude(plan_type="trial").first()
    if not plan:
        return
    now = timezone.now()
    sub, _ = UserSubscription.objects.get_or_create(
        user=provider,
        plan=plan,
        defaults={
            "status": UserSubscription.Status.ACTIVE,
            "source": UserSubscription.Source.PROMO,
            "period_start": now,
            "period_end": now + td(days=3650),
            "auto_renew": False,
            "promo_code": "DEMO",
        },
    )
    if sub.status != UserSubscription.Status.ACTIVE or not sub.period_end or sub.period_end < now + td(days=30):
        sub.status = UserSubscription.Status.ACTIVE
        sub.period_start = now
        sub.period_end = now + td(days=3650)
        sub.auto_renew = False
        sub.save()


def _activate_catalog(provider):
    from catalog.catalog_seed import seed_provider_catalog
    from catalog.models import Service

    sphere = provider.provider_sphere
    try:
        seed_provider_catalog(provider, sphere)
    except ValueError:
        return []
    qs = list(Service.objects.filter(provider=provider, template_slug__gt="").order_by("id")[:12])
    for i, svc in enumerate(qs):
        price = Decimal("900") + Decimal(i) * Decimal("150")
        svc.is_active = True
        if not svc.price or svc.price == 0:
            svc.price = price
        svc.save(update_fields=["is_active", "price"])
    return qs


def _ensure_staff(provider, cfg: dict):
    from booking.models import ProviderStaff

    links = []
    for item in cfg["staff"]:
        staff = _ensure_user(
            username=item["username"],
            email=f"{item['username']}@vsevmeste.space",
            role=User.Role.STAFF,
            first_name=item["first_name"],
            last_name=item["last_name"],
        )
        link, _ = ProviderStaff.objects.get_or_create(
            provider=provider,
            staff=staff,
            defaults={
                "display_name": f"{item['first_name']} {item['last_name']}",
                "job_title": item["job_title"],
                "is_active": True,
                "invitation_status": ProviderStaff.InvitationStatus.ACCEPTED,
            },
        )
        if link.job_title != item["job_title"] or not link.is_active:
            link.job_title = item["job_title"]
            link.display_name = f"{item['first_name']} {item['last_name']}"
            link.is_active = True
            link.invitation_status = ProviderStaff.InvitationStatus.ACCEPTED
            link.save()
        links.append(link)
    return links


def _ensure_clients(cfg: dict):
    clients = []
    for item in cfg["clients"]:
        clients.append(
            _ensure_user(
                username=item["username"],
                email=f"{item['username']}@vsevmeste.space",
                role=User.Role.CLIENT,
                first_name=item["first_name"],
                last_name=item["last_name"],
            )
        )
    return clients


def _seed_slots_and_bookings(provider, staff_links, clients, services):
    from booking.models import AvailabilitySlot, Booking

    if not services:
        return
    now = timezone.localtime()
    start_day = now.replace(hour=10, minute=0, second=0, microsecond=0)
    if now.hour >= 19:
        start_day = start_day + timedelta(days=1)

    workers = staff_links or [None]
    created_slots = []
    for day_offset in range(2):
        day = start_day + timedelta(days=day_offset)
        for link in workers:
            staff = link.staff if link else None
            for hour in range(10, 18):
                starts = day.replace(hour=hour)
                ends = starts + timedelta(hours=1)
                slot, _ = AvailabilitySlot.objects.get_or_create(
                    provider=provider,
                    staff=staff,
                    starts_at=starts,
                    ends_at=ends,
                    defaults={"is_booked": False},
                )
                created_slots.append(slot)

    if not clients or not created_slots:
        return
    statuses = [Booking.Status.CONFIRMED, Booking.Status.NEW, Booking.Status.DONE]
    for i, client in enumerate(clients):
        slot = created_slots[i * 3] if i * 3 < len(created_slots) else created_slots[i % len(created_slots)]
        if slot.is_booked:
            continue
        svc = services[i % len(services)]
        staff = slot.staff
        Booking.objects.create(
            client=client,
            provider=provider,
            service=svc,
            slot=slot,
            staff=staff,
            status=statuses[i % len(statuses)],
            comment="Демо-запись",
        )
        slot.is_booked = True
        slot.save(update_fields=["is_booked"])


def _seed_reviews(provider, clients, staff_links):
    from reviews.models import Review

    if not clients:
        return
    texts = [
        "Удобно записалась без звонка, мастер подтвердил в кабинете.",
        "Всё понятно: услуги, время, чат. Вернусь ещё.",
    ]
    for i, text in enumerate(texts[: len(clients)]):
        Review.objects.create(
            provider=provider,
            client=clients[i],
            staff=staff_links[i % len(staff_links)] if staff_links else None,
            rating=5,
            text=text,
        )


def _seed_inspection(provider, clients, staff_links):
    from inspections.models import InspectionItem, InspectionReport
    from inspections.services import send_report

    if not clients:
        return
    client = clients[0]
    creator = staff_links[0].staff if staff_links else provider
    report = InspectionReport.objects.create(
        provider=provider,
        client=client,
        created_by=creator,
        vehicle_title="Hyundai Solaris",
        vehicle_plate="А123ВС777",
        vehicle_vin="Z94CT41AADR123456",
        notes="Демо-отчёт после ТО. Можно открыть как клиент или утвердить по ссылке.",
    )
    samples = [
        ("Тормозные колодки передние", "Износ критический, нужна замена.", "critical", "4200", "2500"),
        ("Пыльник ШРУСа", "Небольшой разрыв, рекомендуется замена.", "recommended", "1800", "1200"),
        ("Уровень масла", "В норме после замены.", "ok", "0", "0"),
        ("Воздушный фильтр", "Загрязнён, замена по регламенту.", "recommended", "900", "400"),
        ("Аккумулятор", "Нагрузка в норме.", "ok", "0", "0"),
    ]
    for i, (title, desc, sev, parts, labor) in enumerate(samples):
        InspectionItem.objects.create(
            report=report,
            title=title,
            description=desc,
            severity=sev,
            parts_price=parts,
            labor_price=labor,
            sort_order=i,
        )
    try:
        send_report(report)
    except Exception:
        pass


def _seed_location(provider, cfg: dict):
    from locations.models import ProviderLocation

    loc, _ = ProviderLocation.objects.get_or_create(
        provider=provider,
        title=cfg["organization_name"],
        defaults={
            "address": cfg["address"],
            "latitude": cfg["lat"],
            "longitude": cfg["lng"],
        },
    )
    loc.address = cfg["address"]
    loc.latitude = cfg["lat"]
    loc.longitude = cfg["lng"]
    loc.save()


def _seed_cafe(provider):
    from cafe.models import CafeFloorPlan, CafeMenuCategory, CafeMenuItem, CafeSettings, CafeTable

    CafeSettings.objects.get_or_create(
        provider=provider,
        defaults={
            "enable_dine_in": True,
            "enable_takeaway": True,
            "enable_delivery": True,
            "accept_cash": True,
            "accept_card_on_spot": True,
            "accept_online_payment": False,
            "delivery_info": "Доставка по району, 30–40 минут.",
            "delivery_fee": Decimal("250"),
        },
    )
    plan = CafeFloorPlan.objects.create(provider=provider, name="Основной зал", width=800, height=520)
    tables = [
        ("Стол 1", 80, 80, "111111"),
        ("Стол 2", 280, 80, "222222"),
        ("Стол 3", 80, 280, "333333"),
        ("Стол 4", 280, 280, "444444"),
    ]
    for i, (label, x, y, pin) in enumerate(tables):
        CafeTable.objects.create(
            floor_plan=plan,
            label=label,
            x=x,
            y=y,
            pin_code=pin,
            seats=4,
            sort_order=i,
        )
    drinks = CafeMenuCategory.objects.create(provider=provider, name="Напитки", sort_order=1)
    food = CafeMenuCategory.objects.create(provider=provider, name="Кухня", sort_order=2)
    CafeMenuItem.objects.create(category=drinks, name="Капучино", price=Decimal("220"), weight_grams=250, calories=90)
    CafeMenuItem.objects.create(category=drinks, name="Лимонад", price=Decimal("280"), weight_grams=400, calories=120)
    CafeMenuItem.objects.create(category=food, name="Цезарь с курицей", price=Decimal("590"), weight_grams=280, calories=420)
    CafeMenuItem.objects.create(category=food, name="Паста карбонара", price=Decimal("640"), weight_grams=320, calories=610, is_new=True)


def seed_sphere(sphere: str, *, reset: bool = True) -> User:
    cfg = DEMO_SPHERES[sphere]
    with transaction.atomic():
        provider = _ensure_user(
            username=cfg["username"],
            email=cfg["email"],
            role=User.Role.PROVIDER,
            first_name=cfg["first_name"],
            last_name=cfg["last_name"],
            organization_name=cfg["organization_name"],
            organization_slug=cfg["organization_slug"],
            organization_address=cfg["address"],
            organization_latitude=cfg["lat"],
            organization_longitude=cfg["lng"],
            provider_sphere=sphere,
            phone=cfg["phone"],
            organization_phones=[cfg["phone"]],
            organization_working_hours=_hours(),
        )
        if reset:
            _wipe_visitor_data(provider, cfg)
        _restore_profile(provider, cfg)
        _ensure_subscription(provider)
        services = _activate_catalog(provider)
        staff_links = _ensure_staff(provider, cfg)
        clients = _ensure_clients(cfg)
        _seed_location(provider, cfg)
        if sphere == User.ProviderSphere.CAFE_RESTAURANT:
            _seed_cafe(provider)
        else:
            _seed_slots_and_bookings(provider, staff_links, clients, services)
            _seed_reviews(provider, clients, staff_links)
            if sphere == User.ProviderSphere.SERVICE_CENTER:
                _seed_inspection(provider, clients, staff_links)
        if staff_links and services:
            for link in staff_links:
                link.assigned_services.set(services[:6])
        return provider


def ensure_demo_world(*, sphere: str | None = None, reset: bool = True):
    spheres = [sphere] if sphere else list(DEMO_SPHERES)
    for key in spheres:
        if key in DEMO_SPHERES:
            seed_sphere(key, reset=reset)


def login_demo(sphere: str) -> dict:
    if sphere not in DEMO_SPHERES:
        raise ValueError("unknown_sphere")
    provider = seed_sphere(sphere, reset=True)
    refresh = RefreshToken.for_user(provider)
    cfg = DEMO_SPHERES[sphere]
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "is_demo": True,
        "sphere": sphere,
        "organization_name": cfg["organization_name"],
        "label": cfg["label"],
    }


def exit_demo(user) -> None:
    if not getattr(user, "is_demo", False) or user.role != User.Role.PROVIDER:
        return
    sphere = user.provider_sphere
    if sphere in DEMO_SPHERES:
        seed_sphere(sphere, reset=True)

from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.contrib.auth import get_user_model
from django.db import transaction

from .models import Service, ServiceCategory, ServiceOption, ServiceSubcategory
from .sphere_templates import get_sphere_catalog

User = get_user_model()

DEFAULT_PRICE = Decimal("0")


def _seed_service_options(svc, svc_data, stats):
    options = svc_data.get("options") or []
    for i, opt_data in enumerate(options):
        slug = (opt_data.get("slug") or "").strip()
        name = (opt_data.get("name") or "").strip()
        if not name:
            continue
        extra = int(opt_data.get("extra_minutes") or 0)
        price = Decimal(str(opt_data.get("price", DEFAULT_PRICE)))
        defaults = {
            "name": name,
            "price": price,
            "extra_minutes": extra,
            "is_active": True,
            "sort_order": i,
        }
        if slug:
            opt, created = ServiceOption.objects.get_or_create(
                service=svc,
                template_slug=slug,
                defaults=defaults,
            )
        else:
            opt, created = ServiceOption.objects.get_or_create(
                service=svc,
                name=name,
                defaults={**defaults, "template_slug": ""},
            )
        if created:
            stats["options_created"] = stats.get("options_created", 0) + 1
        else:
            changed = []
            if opt.name != name:
                opt.name = name
                changed.append("name")
            if opt.extra_minutes != extra:
                opt.extra_minutes = extra
                changed.append("extra_minutes")
            # цену не перезаписываем — организация могла поменять
            if opt.sort_order != i:
                opt.sort_order = i
                changed.append("sort_order")
            if changed:
                opt.save(update_fields=changed)
        stats["options"] = stats.get("options", 0) + 1


def seed_provider_catalog(provider, sphere: str, *, reset_inactive_only: bool = False) -> dict[str, int]:
    """
    Создаёт или обновляет каталог организации по шаблону сферы.
    Услуги по умолчанию неактивны — организация включает и задаёт цену.
    """
    catalog = get_sphere_catalog(sphere)
    if not catalog:
        raise ValueError(f"Нет шаблона каталога для сферы: {sphere}")

    stats = {"categories": 0, "subcategories": 0, "services": 0, "services_created": 0, "options": 0, "options_created": 0}

    with transaction.atomic():
        for cat_data in catalog["categories"]:
            cat, cat_created = ServiceCategory.objects.get_or_create(
                provider=provider,
                template_slug=cat_data["slug"],
                defaults={
                    "name": cat_data["name"],
                    "allow_subcategory_booking": True,
                },
            )
            if not cat_created and cat.name != cat_data["name"]:
                cat.name = cat_data["name"]
                cat.save(update_fields=["name"])
            if cat_created:
                stats["categories"] += 1

            for sub_data in cat_data.get("subcategories") or []:
                sub, sub_created = ServiceSubcategory.objects.get_or_create(
                    category=cat,
                    template_slug=sub_data["slug"],
                    defaults={"name": sub_data["name"]},
                )
                if not sub_created and sub.name != sub_data["name"]:
                    sub.name = sub_data["name"]
                    sub.save(update_fields=["name"])
                if sub_created:
                    stats["subcategories"] += 1

                for svc_data in sub_data.get("services") or []:
                    duration = int(svc_data.get("duration_minutes") or 30)
                    price = Decimal(str(svc_data.get("price", DEFAULT_PRICE)))
                    svc, svc_created = Service.objects.get_or_create(
                        provider=provider,
                        template_slug=svc_data["slug"],
                        defaults={
                            "category": cat,
                            "subcategory": sub,
                            "name": svc_data["name"],
                            "price": price,
                            "duration_minutes": duration,
                            "is_active": False,
                        },
                    )
                    if svc_created:
                        stats["services_created"] += 1
                    else:
                        changed = []
                        if svc.name != svc_data["name"]:
                            svc.name = svc_data["name"]
                            changed.append("name")
                        if svc.category_id != cat.id:
                            svc.category = cat
                            changed.append("category")
                        if svc.subcategory_id != sub.id:
                            svc.subcategory = sub
                            changed.append("subcategory")
                        if svc.duration_minutes != duration:
                            svc.duration_minutes = duration
                            changed.append("duration_minutes")
                        if changed:
                            svc.save(update_fields=changed)
                    stats["services"] += 1
                    _seed_service_options(svc, svc_data, stats)

    return stats


def provider_catalog_status(provider) -> dict[str, Any]:
    sphere = getattr(provider, "provider_sphere", "") or ""
    template = get_sphere_catalog(sphere)
    total_services = Service.objects.filter(provider=provider).count()
    active_services = Service.objects.filter(provider=provider, is_active=True).count()
    has_template = bool(template)
    return {
        "sphere": sphere,
        "sphere_label": template["label"] if template else "",
        "has_template": has_template,
        "catalog_seeded": total_services > 0,
        "total_services": total_services,
        "active_services": active_services,
    }

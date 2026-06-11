"""Готовые каталоги услуг по сферам деятельности организации."""

from __future__ import annotations

from typing import Any

from .service_center_catalog import SERVICE_CENTER_CATALOG

# slug, name, subcategories: [{slug, name, services: [{slug, name, duration_minutes?, price?}]}]
HAIR_SALON_CATALOG: dict[str, Any] = {
    "sphere": "hair_salon",
    "label": "Салон красоты",
    "categories": [
        {
            "slug": "hair",
            "name": "Парикмахерские услуги (Волосы)",
            "subcategories": [
                {
                    "slug": "hair-cuts",
                    "name": "Стрижки",
                    "services": [
                        {"slug": "hair-cut-women", "name": "Женская стрижка", "duration_minutes": 60},
                        {"slug": "hair-cut-men", "name": "Мужская стрижка", "duration_minutes": 40},
                        {"slug": "hair-cut-kids", "name": "Детская стрижка", "duration_minutes": 35},
                        {"slug": "hair-cut-creative", "name": "Креативная стрижка", "duration_minutes": 75},
                        {"slug": "hair-cut-hot-scissors", "name": "Стрижка горячими ножницами", "duration_minutes": 60},
                        {"slug": "hair-cut-bangs", "name": "Оформление чёлки", "duration_minutes": 20},
                    ],
                },
                {
                    "slug": "hair-color",
                    "name": "Окрашивание",
                    "services": [
                        {
                            "slug": "hair-color-complex",
                            "name": "Сложное окрашивание (аиртач, балаяж, омбре, шатуш)",
                            "duration_minutes": 180,
                        },
                        {"slug": "hair-color-highlights", "name": "Мелирование", "duration_minutes": 120},
                        {"slug": "hair-color-tone", "name": "Тонирование", "duration_minutes": 60},
                        {"slug": "hair-color-gray", "name": "Окрашивание седины", "duration_minutes": 90},
                        {"slug": "hair-color-bleach", "name": "Обесцвечивание", "duration_minutes": 90},
                        {"slug": "hair-color-men-gray", "name": "Мужской камуфляж седины", "duration_minutes": 30},
                    ],
                },
                {
                    "slug": "hair-styling",
                    "name": "Укладки и причёски",
                    "services": [
                        {"slug": "hair-style-day", "name": "Дневная укладка", "duration_minutes": 45},
                        {"slug": "hair-style-evening", "name": "Вечерняя укладка", "duration_minutes": 60},
                        {"slug": "hair-style-wedding", "name": "Свадебная причёска", "duration_minutes": 90},
                        {"slug": "hair-style-braids", "name": "Плетение кос", "duration_minutes": 60},
                        {"slug": "hair-style-straight", "name": "Выпрямление", "duration_minutes": 45},
                    ],
                },
                {
                    "slug": "hair-care",
                    "name": "Уход и лечение",
                    "services": [
                        {"slug": "hair-care-keratin", "name": "Кератиновое выпрямление", "duration_minutes": 150},
                        {"slug": "hair-care-lamination", "name": "Ламинирование", "duration_minutes": 90},
                        {"slug": "hair-care-screening", "name": "Экранирование", "duration_minutes": 60},
                        {"slug": "hair-care-botox", "name": "Ботокс для волос", "duration_minutes": 90},
                        {"slug": "hair-care-repair", "name": "Восстановление волос", "duration_minutes": 60},
                        {"slug": "hair-care-spa", "name": "SPA-программы для волос", "duration_minutes": 75},
                    ],
                },
                {
                    "slug": "hair-chemical",
                    "name": "Химическая завивка / выпрямление",
                    "services": [
                        {"slug": "hair-chem-perm", "name": "Биозавивка", "duration_minutes": 120},
                        {"slug": "hair-chem-carving", "name": "Карвинг", "duration_minutes": 90},
                        {"slug": "hair-chem-straight", "name": "Долговременное выпрямление", "duration_minutes": 150},
                    ],
                },
                {
                    "slug": "hair-extensions",
                    "name": "Наращивание",
                    "services": [
                        {"slug": "hair-extensions-full", "name": "Наращивание волос", "duration_minutes": 180},
                    ],
                },
            ],
        },
        {
            "slug": "nails",
            "name": "Ногтевой сервис (Маникюр и педикюр)",
            "subcategories": [
                {
                    "slug": "nails-manicure",
                    "name": "Маникюр",
                    "services": [
                        {"slug": "nails-manicure-classic", "name": "Классический (обрезной) маникюр", "duration_minutes": 60},
                        {"slug": "nails-manicure-apparatus", "name": "Аппаратный маникюр", "duration_minutes": 60},
                        {"slug": "nails-manicure-european", "name": "Европейский маникюр", "duration_minutes": 50},
                        {"slug": "nails-manicure-combo", "name": "Комбинированный маникюр", "duration_minutes": 70},
                        {"slug": "nails-manicure-japanese", "name": "Японский маникюр", "duration_minutes": 75},
                    ],
                },
                {
                    "slug": "nails-coating",
                    "name": "Покрытие",
                    "services": [
                        {"slug": "nails-coat-gel", "name": "Гель-лак (шеллак)", "duration_minutes": 90},
                        {"slug": "nails-coat-healing", "name": "Лечебное покрытие", "duration_minutes": 60},
                        {"slug": "nails-coat-design", "name": "Дизайн ногтей", "duration_minutes": 30},
                        {"slug": "nails-coat-french", "name": "Французский маникюр", "duration_minutes": 90},
                    ],
                },
                {
                    "slug": "nails-modeling",
                    "name": "Моделирование",
                    "services": [
                        {"slug": "nails-model-extension", "name": "Наращивание ногтей (гель/акрил)", "duration_minutes": 120},
                        {"slug": "nails-model-strengthen", "name": "Укрепление ногтей", "duration_minutes": 60},
                        {"slug": "nails-model-repair", "name": "Ремонт ногтей", "duration_minutes": 30},
                    ],
                },
                {
                    "slug": "nails-pedicure",
                    "name": "Педикюр",
                    "services": [
                        {"slug": "nails-pedicure-apparatus", "name": "Аппаратный педикюр", "duration_minutes": 75},
                        {"slug": "nails-pedicure-combo", "name": "Комбинированный педикюр", "duration_minutes": 80},
                        {"slug": "nails-pedicure-spa", "name": "SPA-педикюр", "duration_minutes": 90},
                    ],
                },
            ],
        },
        {
            "slug": "brow-lash",
            "name": "Брови и ресницы (Lash & Brow)",
            "subcategories": [
                {
                    "slug": "brow",
                    "name": "Брови",
                    "services": [
                        {"slug": "brow-shape", "name": "Коррекция бровей (воск/нить/пинцет)", "duration_minutes": 30},
                        {"slug": "brow-tint", "name": "Окрашивание бровей (краска/хна)", "duration_minutes": 25},
                        {"slug": "brow-lamination", "name": "Долговременная укладка бровей (ламинирование)", "duration_minutes": 45},
                    ],
                },
                {
                    "slug": "lash",
                    "name": "Ресницы",
                    "services": [
                        {"slug": "lash-classic", "name": "Наращивание ресниц (классика)", "duration_minutes": 120},
                        {"slug": "lash-volume", "name": "Наращивание ресниц (объём)", "duration_minutes": 150},
                        {"slug": "lash-lamination", "name": "Ламинирование ресниц", "duration_minutes": 60},
                        {"slug": "lash-botox", "name": "Ботокс ресниц", "duration_minutes": 45},
                        {"slug": "lash-tint", "name": "Окрашивание ресниц", "duration_minutes": 20},
                    ],
                },
            ],
        },
        {
            "slug": "cosmetology",
            "name": "Косметология (Лицо и тело)",
            "subcategories": [
                {
                    "slug": "cosmo-aesthetic",
                    "name": "Эстетическая косметология",
                    "services": [
                        {"slug": "cosmo-clean-ultra", "name": "Чистка лица (ультразвуковая)", "duration_minutes": 60},
                        {"slug": "cosmo-clean-mechanical", "name": "Чистка лица (механическая)", "duration_minutes": 75},
                        {"slug": "cosmo-peeling", "name": "Пилинги", "duration_minutes": 60},
                        {"slug": "cosmo-facial-care", "name": "Уходовые программы (маски, сыворотки)", "duration_minutes": 60},
                        {"slug": "cosmo-cryolift", "name": "Криолифтинг", "duration_minutes": 45},
                    ],
                },
                {
                    "slug": "cosmo-injection",
                    "name": "Инъекционная косметология",
                    "services": [
                        {"slug": "cosmo-meso", "name": "Мезотерапия", "duration_minutes": 45},
                        {"slug": "cosmo-biorev", "name": "Биоревитализация", "duration_minutes": 45},
                        {"slug": "cosmo-contour", "name": "Контурная пластика", "duration_minutes": 60},
                        {"slug": "cosmo-botox", "name": "Ботулинотерапия", "duration_minutes": 30},
                    ],
                },
                {
                    "slug": "cosmo-hair-removal",
                    "name": "Эпиляция / депиляция",
                    "services": [
                        {"slug": "cosmo-sugar", "name": "Шугаринг", "duration_minutes": 45},
                        {"slug": "cosmo-wax", "name": "Ваксинг (воск)", "duration_minutes": 45},
                        {"slug": "cosmo-laser", "name": "Лазерная эпиляция", "duration_minutes": 40},
                    ],
                },
                {
                    "slug": "cosmo-pmu",
                    "name": "Перманентный макияж",
                    "services": [
                        {"slug": "cosmo-pmu-brows", "name": "Татуаж бровей", "duration_minutes": 120},
                        {"slug": "cosmo-pmu-eyes", "name": "Татуаж век", "duration_minutes": 120},
                        {"slug": "cosmo-pmu-lips", "name": "Татуаж губ", "duration_minutes": 120},
                    ],
                },
            ],
        },
        {
            "slug": "massage-spa",
            "name": "Массаж и SPA",
            "subcategories": [
                {
                    "slug": "massage",
                    "name": "Массаж",
                    "services": [
                        {"slug": "massage-classic", "name": "Классический массаж", "duration_minutes": 60},
                        {"slug": "massage-therapeutic", "name": "Лечебный массаж", "duration_minutes": 60},
                        {"slug": "massage-relax", "name": "Расслабляющий массаж", "duration_minutes": 60},
                        {"slug": "massage-lymph", "name": "Лимфодренажный массаж", "duration_minutes": 60},
                        {"slug": "massage-anticellulite", "name": "Антицеллюлитный массаж", "duration_minutes": 60},
                        {"slug": "massage-face", "name": "Массаж лица", "duration_minutes": 30},
                    ],
                },
                {
                    "slug": "spa",
                    "name": "SPA",
                    "services": [
                        {"slug": "spa-wrap", "name": "Обертывания", "duration_minutes": 75},
                        {"slug": "spa-thalasso", "name": "Талассотерапия", "duration_minutes": 90},
                        {"slug": "spa-body", "name": "Программы по коррекции фигуры", "duration_minutes": 90},
                    ],
                },
            ],
        },
        {
            "slug": "extra",
            "name": "Дополнительные услуги",
            "subcategories": [
                {
                    "slug": "extra-makeup",
                    "name": "Визаж",
                    "services": [
                        {"slug": "extra-makeup-day", "name": "Макияж дневной", "duration_minutes": 45},
                        {"slug": "extra-makeup-evening", "name": "Макияж вечерний", "duration_minutes": 60},
                        {"slug": "extra-makeup-wedding", "name": "Макияж свадебный", "duration_minutes": 90},
                    ],
                },
                {
                    "slug": "extra-other",
                    "name": "Прочее",
                    "services": [
                        {"slug": "extra-solarium", "name": "Солярий", "duration_minutes": 15},
                        {
                            "slug": "extra-cosmetics-sale",
                            "name": "Продажа профессиональной косметики для домашнего ухода",
                            "duration_minutes": 15,
                        },
                    ],
                },
            ],
        },
    ],
}

SPHERE_CATALOGS: dict[str, dict[str, Any]] = {
    "hair_salon": HAIR_SALON_CATALOG,
    "service_center": SERVICE_CENTER_CATALOG,
}


def get_sphere_catalog(sphere: str) -> dict[str, Any] | None:
    return SPHERE_CATALOGS.get(sphere)


def list_sphere_catalogs() -> list[dict[str, str]]:
    return [{"sphere": key, "label": val["label"]} for key, val in SPHERE_CATALOGS.items()]

"""Шаблон каталога услуг для сферы «Сервисный центр» (автосервис)."""

from __future__ import annotations

from typing import Any

SERVICE_CENTER_CATALOG: dict[str, Any] = {
    "sphere": "service_center",
    "label": "Сервисный центр",
    "categories": [
        {
            "slug": "auto-maintenance",
            "name": "ТО и регламентное обслуживание",
            "subcategories": [
                {
                    "slug": "auto-maint-scheduled",
                    "name": "Плановое ТО",
                    "services": [
                        {"slug": "auto-to-basic", "name": "ТО-1 (базовое)", "duration_minutes": 90},
                        {"slug": "auto-to-standard", "name": "ТО-2 (стандартное)", "duration_minutes": 120},
                        {"slug": "auto-to-full", "name": "ТО-3 (расширенное)", "duration_minutes": 180},
                        {"slug": "auto-to-dealer", "name": "ТО по регламенту производителя", "duration_minutes": 150},
                    ],
                },
                {
                    "slug": "auto-maint-fluids",
                    "name": "Жидкости и фильтры",
                    "services": [
                        {"slug": "auto-oil-engine", "name": "Замена моторного масла и фильтра", "duration_minutes": 45},
                        {"slug": "auto-oil-box", "name": "Замена масла в АКПП / МКПП", "duration_minutes": 90},
                        {"slug": "auto-filter-air", "name": "Замена воздушного фильтра", "duration_minutes": 20},
                        {"slug": "auto-filter-cabin", "name": "Замена салонного фильтра", "duration_minutes": 25},
                        {"slug": "auto-filter-fuel", "name": "Замена топливного фильтра", "duration_minutes": 40},
                        {"slug": "auto-coolant", "name": "Замена охлаждающей жидкости", "duration_minutes": 60},
                        {"slug": "auto-brake-fluid", "name": "Замена тормозной жидкости", "duration_minutes": 45},
                        {"slug": "auto-ps-fluid", "name": "Замена жидкости ГУР / ЭУР", "duration_minutes": 50},
                    ],
                },
                {
                    "slug": "auto-maint-belts",
                    "name": "Ремни и цепи ГРМ",
                    "services": [
                        {"slug": "auto-belt-accessory", "name": "Замена ремня навесного оборудования", "duration_minutes": 60},
                        {"slug": "auto-belt-timing", "name": "Замена ремня ГРМ", "duration_minutes": 240},
                        {"slug": "auto-chain-timing", "name": "Замена цепи ГРМ", "duration_minutes": 360},
                        {"slug": "auto-tensioners", "name": "Замена роликов и натяжителей", "duration_minutes": 120},
                    ],
                },
            ],
        },
        {
            "slug": "auto-diagnostics",
            "name": "Диагностика",
            "subcategories": [
                {
                    "slug": "auto-diag-electronic",
                    "name": "Компьютерная диагностика",
                    "services": [
                        {"slug": "auto-diag-engine", "name": "Диагностика двигателя", "duration_minutes": 45},
                        {"slug": "auto-diag-full", "name": "Комплексная диагностика автомобиля", "duration_minutes": 90},
                        {"slug": "auto-diag-errors", "name": "Считывание и сброс ошибок", "duration_minutes": 30},
                        {"slug": "auto-diag-electronics", "name": "Диагностика электронных систем", "duration_minutes": 60},
                        {"slug": "auto-diag-prebuy", "name": "Диагностика перед покупкой", "duration_minutes": 120},
                    ],
                },
                {
                    "slug": "auto-diag-mechanical",
                    "name": "Механическая диагностика",
                    "services": [
                        {"slug": "auto-diag-suspension", "name": "Диагностика подвески", "duration_minutes": 45},
                        {"slug": "auto-diag-brakes", "name": "Диагностика тормозной системы", "duration_minutes": 30},
                        {"slug": "auto-diag-leak", "name": "Поиск утечек", "duration_minutes": 60},
                        {"slug": "auto-diag-noise", "name": "Поиск посторонних шумов", "duration_minutes": 45},
                    ],
                },
            ],
        },
        {
            "slug": "auto-engine",
            "name": "Двигатель",
            "subcategories": [
                {
                    "slug": "auto-engine-repair",
                    "name": "Ремонт двигателя",
                    "services": [
                        {"slug": "auto-engine-minor", "name": "Мелкий ремонт двигателя", "duration_minutes": 180},
                        {"slug": "auto-engine-major", "name": "Капитальный ремонт двигателя", "duration_minutes": 2880},
                        {"slug": "auto-engine-head", "name": "Ремонт головки блока цилиндров", "duration_minutes": 480},
                        {"slug": "auto-engine-turbo", "name": "Ремонт турбины", "duration_minutes": 240},
                        {"slug": "auto-engine-injectors", "name": "Ремонт / промывка форсунок", "duration_minutes": 120},
                        {"slug": "auto-engine-carbon", "name": "Чистка впускного коллектора и клапанов", "duration_minutes": 180},
                    ],
                },
                {
                    "slug": "auto-engine-cooling",
                    "name": "Система охлаждения",
                    "services": [
                        {"slug": "auto-radiator", "name": "Ремонт / замена радиатора", "duration_minutes": 120},
                        {"slug": "auto-water-pump", "name": "Замена помпы", "duration_minutes": 150},
                        {"slug": "auto-thermostat", "name": "Замена термостата", "duration_minutes": 60},
                        {"slug": "auto-cooling-flush", "name": "Промывка системы охлаждения", "duration_minutes": 90},
                    ],
                },
            ],
        },
        {
            "slug": "auto-transmission",
            "name": "Трансмиссия и сцепление",
            "subcategories": [
                {
                    "slug": "auto-trans-gearbox",
                    "name": "Коробка передач",
                    "services": [
                        {"slug": "auto-akpp-service", "name": "Обслуживание АКПП", "duration_minutes": 120},
                        {"slug": "auto-akpp-repair", "name": "Ремонт АКПП", "duration_minutes": 1440},
                        {"slug": "auto-mkpp-repair", "name": "Ремонт МКПП", "duration_minutes": 480},
                        {"slug": "auto-cvt-repair", "name": "Ремонт вариатора", "duration_minutes": 960},
                        {"slug": "auto-driveshaft", "name": "Ремонт карданного вала", "duration_minutes": 120},
                    ],
                },
                {
                    "slug": "auto-trans-clutch",
                    "name": "Сцепление",
                    "services": [
                        {"slug": "auto-clutch-replace", "name": "Замена сцепления", "duration_minutes": 360},
                        {"slug": "auto-clutch-cylinder", "name": "Замена цилиндра сцепления", "duration_minutes": 90},
                        {"slug": "auto-flywheel", "name": "Замена маховика", "duration_minutes": 300},
                    ],
                },
                {
                    "slug": "auto-trans-axle",
                    "name": "Привод и редуктор",
                    "services": [
                        {"slug": "auto-cv-joint", "name": "Замена ШРУСа / пыльника", "duration_minutes": 90},
                        {"slug": "auto-diff-oil", "name": "Замена масла в редукторе", "duration_minutes": 45},
                        {"slug": "auto-diff-repair", "name": "Ремонт редуктора", "duration_minutes": 480},
                    ],
                },
            ],
        },
        {
            "slug": "auto-suspension",
            "name": "Ходовая часть и подвеска",
            "subcategories": [
                {
                    "slug": "auto-susp-shocks",
                    "name": "Амортизаторы и пружины",
                    "services": [
                        {"slug": "auto-shocks-front", "name": "Замена амортизаторов (перед)", "duration_minutes": 120},
                        {"slug": "auto-shocks-rear", "name": "Замена амортизаторов (зад)", "duration_minutes": 90},
                        {"slug": "auto-springs", "name": "Замена пружин", "duration_minutes": 120},
                        {"slug": "auto-strut-mount", "name": "Замена опорных подшипников", "duration_minutes": 90},
                    ],
                },
                {
                    "slug": "auto-susp-arms",
                    "name": "Рычаги и сайлентблоки",
                    "services": [
                        {"slug": "auto-ball-joint", "name": "Замена шаровых опор", "duration_minutes": 90},
                        {"slug": "auto-control-arm", "name": "Замена рычагов подвески", "duration_minutes": 120},
                        {"slug": "auto-silentblock", "name": "Замена сайлентблоков", "duration_minutes": 150},
                        {"slug": "auto-stabilizer", "name": "Замена стоек и втулок стабилизатора", "duration_minutes": 60},
                    ],
                },
                {
                    "slug": "auto-susp-steering",
                    "name": "Рулевое управление",
                    "services": [
                        {"slug": "auto-alignment", "name": "Развал-схождение", "duration_minutes": 60},
                        {"slug": "auto-steering-rack", "name": "Ремонт рулевой рейки", "duration_minutes": 240},
                        {"slug": "auto-tie-rods", "name": "Замена рулевых наконечников / тяг", "duration_minutes": 90},
                        {"slug": "auto-ps-pump", "name": "Ремонт насоса ГУР", "duration_minutes": 120},
                    ],
                },
            ],
        },
        {
            "slug": "auto-brakes",
            "name": "Тормозная система",
            "subcategories": [
                {
                    "slug": "auto-brakes-pads",
                    "name": "Колодки и диски",
                    "services": [
                        {"slug": "auto-brake-pads-front", "name": "Замена тормозных колодок (перед)", "duration_minutes": 60},
                        {"slug": "auto-brake-pads-rear", "name": "Замена тормозных колодок (зад)", "duration_minutes": 60},
                        {"slug": "auto-brake-discs-front", "name": "Замена тормозных дисков (перед)", "duration_minutes": 90},
                        {"slug": "auto-brake-discs-rear", "name": "Замена тормозных дисков (зад)", "duration_minutes": 90},
                        {"slug": "auto-brake-drum", "name": "Обслуживание барабанных тормозов", "duration_minutes": 90},
                    ],
                },
                {
                    "slug": "auto-brakes-system",
                    "name": "Гидравлика и механизмы",
                    "services": [
                        {"slug": "auto-brake-bleed", "name": "Прокачка тормозной системы", "duration_minutes": 45},
                        {"slug": "auto-brake-caliper", "name": "Ремонт суппорта", "duration_minutes": 90},
                        {"slug": "auto-brake-handbrake", "name": "Регулировка / ремонт ручника", "duration_minutes": 60},
                        {"slug": "auto-brake-abs", "name": "Диагностика и ремонт ABS", "duration_minutes": 120},
                    ],
                },
            ],
        },
        {
            "slug": "auto-electrical",
            "name": "Электрика и электроника",
            "subcategories": [
                {
                    "slug": "auto-elec-power",
                    "name": "Питание и запуск",
                    "services": [
                        {"slug": "auto-battery", "name": "Замена аккумулятора", "duration_minutes": 20},
                        {"slug": "auto-alternator", "name": "Ремонт генератора", "duration_minutes": 120},
                        {"slug": "auto-starter", "name": "Ремонт стартера", "duration_minutes": 120},
                        {"slug": "auto-wiring", "name": "Ремонт проводки", "duration_minutes": 180},
                    ],
                },
                {
                    "slug": "auto-elec-lighting",
                    "name": "Освещение",
                    "services": [
                        {"slug": "auto-lights-adjust", "name": "Регулировка фар", "duration_minutes": 30},
                        {"slug": "auto-lights-replace", "name": "Замена ламп / LED", "duration_minutes": 30},
                        {"slug": "auto-lights-repair", "name": "Ремонт фар (полировка, запотевание)", "duration_minutes": 90},
                    ],
                },
                {
                    "slug": "auto-elec-comfort",
                    "name": "Комфорт и безопасность",
                    "services": [
                        {"slug": "auto-alarm", "name": "Установка / ремонт сигнализации", "duration_minutes": 180},
                        {"slug": "auto-parking-sensors", "name": "Установка парктроников / камеры", "duration_minutes": 120},
                        {"slug": "auto-multimedia", "name": "Установка магнитолы / мультимедиа", "duration_minutes": 90},
                        {"slug": "auto-srs", "name": "Диагностика подушек безопасности", "duration_minutes": 60},
                    ],
                },
            ],
        },
        {
            "slug": "auto-climate",
            "name": "Кондиционер и отопление",
            "subcategories": [
                {
                    "slug": "auto-ac-service",
                    "name": "Обслуживание кондиционера",
                    "services": [
                        {"slug": "auto-ac-fill", "name": "Заправка кондиционера", "duration_minutes": 45},
                        {"slug": "auto-ac-diagnose", "name": "Диагностика кондиционера", "duration_minutes": 60},
                        {"slug": "auto-ac-compressor", "name": "Ремонт компрессора кондиционера", "duration_minutes": 180},
                        {"slug": "auto-ac-radiator", "name": "Замена радиатора кондиционера", "duration_minutes": 150},
                        {"slug": "auto-heater", "name": "Ремонт печки / отопителя", "duration_minutes": 180},
                    ],
                },
            ],
        },
        {
            "slug": "auto-exhaust",
            "name": "Выхлопная система",
            "subcategories": [
                {
                    "slug": "auto-exhaust-repair",
                    "name": "Ремонт выхлопа",
                    "services": [
                        {"slug": "auto-muffler", "name": "Замена глушителя", "duration_minutes": 60},
                        {"slug": "auto-catalyst", "name": "Замена / удаление катализатора", "duration_minutes": 120},
                        {"slug": "auto-exhaust-pipe", "name": "Ремонт / замена участка трубы", "duration_minutes": 90},
                        {"slug": "auto-exhaust-weld", "name": "Сварка выхлопной системы", "duration_minutes": 60},
                    ],
                },
            ],
        },
        {
            "slug": "auto-body",
            "name": "Кузовной ремонт и покраска",
            "subcategories": [
                {
                    "slug": "auto-body-repair",
                    "name": "Кузовные работы",
                    "services": [
                        {"slug": "auto-dent-removal", "name": "Удаление вмятин без покраски (PDR)", "duration_minutes": 120},
                        {"slug": "auto-body-panel", "name": "Рихтовка и ремонт кузовных элементов", "duration_minutes": 240},
                        {"slug": "auto-body-weld", "name": "Сварочные кузовные работы", "duration_minutes": 180},
                        {"slug": "auto-rust", "name": "Антикоррозийная обработка", "duration_minutes": 240},
                    ],
                },
                {
                    "slug": "auto-body-paint",
                    "name": "Покраска",
                    "services": [
                        {"slug": "auto-paint-element", "name": "Покраска элемента", "duration_minutes": 480},
                        {"slug": "auto-paint-full", "name": "Полная покраска автомобиля", "duration_minutes": 4320},
                        {"slug": "auto-paint-touch", "name": "Локальная подкраска", "duration_minutes": 120},
                        {"slug": "auto-polish", "name": "Полировка кузова", "duration_minutes": 180},
                    ],
                },
            ],
        },
        {
            "slug": "auto-glass",
            "name": "Автостекло",
            "subcategories": [
                {
                    "slug": "auto-glass-service",
                    "name": "Стёкла",
                    "services": [
                        {"slug": "auto-windshield-chip", "name": "Ремонт сколов и трещин", "duration_minutes": 45},
                        {"slug": "auto-windshield-replace", "name": "Замена лобового стекла", "duration_minutes": 120},
                        {"slug": "auto-side-glass", "name": "Замена бокового / заднего стекла", "duration_minutes": 90},
                        {"slug": "auto-tint", "name": "Тонировка стёкол", "duration_minutes": 180},
                    ],
                },
            ],
        },
        {
            "slug": "auto-tires",
            "name": "Шиномонтаж и колёса",
            "subcategories": [
                {
                    "slug": "auto-tire-service",
                    "name": "Шиномонтаж",
                    "services": [
                        {"slug": "auto-tire-change", "name": "Сезонная переобувка (4 колеса)", "duration_minutes": 45},
                        {"slug": "auto-tire-balance", "name": "Балансировка колёс", "duration_minutes": 30},
                        {"slug": "auto-tire-repair", "name": "Ремонт прокола", "duration_minutes": 30},
                        {"slug": "auto-tire-storage", "name": "Сезонное хранение шин", "duration_minutes": 15},
                    ],
                },
                {
                    "slug": "auto-tire-extra",
                    "name": "Дополнительно",
                    "services": [
                        {"slug": "auto-tire-pressure", "name": "Проверка и накачка шин", "duration_minutes": 15},
                        {"slug": "auto-rim-repair", "name": "Правка дисков", "duration_minutes": 60},
                        {"slug": "auto-tpms", "name": "Программирование датчиков давления", "duration_minutes": 30},
                    ],
                },
            ],
        },
        {
            "slug": "auto-detailing",
            "name": "Мойка и детейлинг",
            "subcategories": [
                {
                    "slug": "auto-wash",
                    "name": "Мойка",
                    "services": [
                        {"slug": "auto-wash-body", "name": "Мойка кузова", "duration_minutes": 30},
                        {"slug": "auto-wash-complex", "name": "Комплексная мойка", "duration_minutes": 60},
                        {"slug": "auto-wash-engine", "name": "Мойка двигателя", "duration_minutes": 45},
                        {"slug": "auto-wash-dry", "name": "Химчистка салона", "duration_minutes": 240},
                    ],
                },
                {
                    "slug": "auto-detail",
                    "name": "Детейлинг",
                    "services": [
                        {"slug": "auto-detail-polish", "name": "Полировка + защитное покрытие", "duration_minutes": 300},
                        {"slug": "auto-detail-ceramic", "name": "Керамическое покрытие", "duration_minutes": 360},
                        {"slug": "auto-detail-coating", "name": "Антидождь / защита стёкол", "duration_minutes": 60},
                        {"slug": "auto-detail-odor", "name": "Удаление запахов (озонирование)", "duration_minutes": 90},
                    ],
                },
            ],
        },
        {
            "slug": "auto-tuning",
            "name": "Тюнинг и дооснащение",
            "subcategories": [
                {
                    "slug": "auto-tune-ext",
                    "name": "Внешний тюнинг",
                    "services": [
                        {"slug": "auto-tune-bodykit", "name": "Установка обвеса", "duration_minutes": 240},
                        {"slug": "auto-tune-spoiler", "name": "Установка спойлера / антикрыла", "duration_minutes": 90},
                        {"slug": "auto-tune-lights", "name": "Установка LED / ксенона", "duration_minutes": 60},
                    ],
                },
                {
                    "slug": "auto-tune-int",
                    "name": "Внутренний тюнинг и удобство",
                    "services": [
                        {"slug": "auto-tune-seat-covers", "name": "Установка чехлов / перетяжка салона", "duration_minutes": 480},
                        {"slug": "auto-tune-heater-seat", "name": "Установка подогрева сидений", "duration_minutes": 180},
                        {"slug": "auto-tune-towbar", "name": "Установка фаркопа", "duration_minutes": 180},
                    ],
                },
                {
                    "slug": "auto-tune-chip",
                    "name": "Чип-тюнинг",
                    "services": [
                        {"slug": "auto-chip-stage1", "name": "Чип-тюнинг Stage 1", "duration_minutes": 120},
                        {"slug": "auto-chip-disable", "name": "Отключение EGR / DPF / AdBlue", "duration_minutes": 90},
                    ],
                },
            ],
        },
        {
            "slug": "auto-emergency",
            "name": "Аварийные и выездные услуги",
            "subcategories": [
                {
                    "slug": "auto-roadside",
                    "name": "Выезд и эвакуация",
                    "services": [
                        {"slug": "auto-tow", "name": "Эвакуация автомобиля", "duration_minutes": 60},
                        {"slug": "auto-jumpstart", "name": "Прикурить / запуск с бустером", "duration_minutes": 30},
                        {"slug": "auto-roadside-repair", "name": "Выездная диагностика и мелкий ремонт", "duration_minutes": 90},
                        {"slug": "auto-lock-open", "name": "Вскрытие автомобиля", "duration_minutes": 45},
                    ],
                },
            ],
        },
        {
            "slug": "auto-extra",
            "name": "Дополнительные услуги",
            "subcategories": [
                {
                    "slug": "auto-extra-misc",
                    "name": "Прочее",
                    "services": [
                        {"slug": "auto-prep-sale", "name": "Предпродажная подготовка", "duration_minutes": 240},
                        {"slug": "auto-inspection-prep", "name": "Подготовка к техосмотру", "duration_minutes": 120},
                        {"slug": "auto-parts-pick", "name": "Подбор и заказ запчастей", "duration_minutes": 30},
                        {"slug": "auto-consult", "name": "Консультация мастера", "duration_minutes": 30},
                    ],
                },
            ],
        },
    ],
}

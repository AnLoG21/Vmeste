"""Каталог гайдов Вмагнитоле по моделям Geely / Belgee (кроме Coolray-дорест — см. seed_vmagnitol_coolray)."""

from django.core.management.base import BaseCommand

from vmagnitol.management.commands.seed_vmagnitol_coolray import upsert_guide
from vmagnitol.models import Brand, CarModel


def ensure_brand():
    brand, _ = Brand.objects.get_or_create(
        slug="geely",
        defaults={
            "name": "Geely",
            "notes": "Линейка Coolray / Atlas / Tugella / Monjaro / Emgrand / Preface / Okavango.",
            "sort_order": 10,
        },
    )
    brand.notes = (
        "Каталог ГУ: дорест Coolray Community (USB), рест Coolray GeeOption/MTK, "
        "Atlas/Tugella GMC и DIY, Monjaro ADB/Vite/Flyme, Emgrand Lunaris/SP Flash. "
        "Каналы: garage.geely.su (список TG DevBlog)."
    )
    brand.save(update_fields=["notes", "updated_at"])
    return brand


def ensure_model(brand, slug, name, years, head_unit, notes, sort_order):
    model, _ = CarModel.objects.get_or_create(
        brand=brand,
        slug=slug,
        defaults={
            "name": name,
            "years": years,
            "head_unit": head_unit,
            "notes": notes,
            "sort_order": sort_order,
        },
    )
    model.years = years
    model.head_unit = head_unit
    model.notes = notes
    model.sort_order = sort_order
    model.save(update_fields=["years", "head_unit", "notes", "sort_order", "updated_at"])
    return model


CATALOG = {
    "title": "Карта моделей Geely: какой путь прошивки",
    "summary": (
        "Обзор платформ ГУ и куда идти за файлами: Community / GeeOption / Lunaris / GMC / ADB. "
        "Источники: 4PDA, Coolray Wiki, Lunaris Wiki, gmcust.su, garage.geely.su."
    ),
    "source_url": "https://garage.geely.su/tpost/0suoll6dl1-poleznie-kanali-telegram-po-proshivke-gu",
    "steps": [
        {
            "order": 1,
            "title": "Сначала определите поколение ГУ",
            "body": (
                "Дорест Coolray / Belgee X50 Android 4.3 (H30/H40/H50) → USB-пакет Community.\n"
                "Рест Coolray / Binyue Cool Android 9 (IHU535/516/715, Ecarx E02) → GeeOption Community через MTK.\n"
                "Belgee X50 новое ГУ IHU730 → Lunaris (не Community).\n"
                "Atlas Pro / Belgee X70 / Tugella дорест E01 Android 5.1 → GMC или DIY UART/скрипты USB.\n"
                "Tugella рест IHU520G (чёрный UI) / IHU717P (белый) → инженерка по времени + GMC/DIY.\n"
                "Monjaro ОД/ПИ → коды инженерки + ADB / Monjaro Vite / народный ADB-скрипт / GMC.\n"
                "Monjaro 2026 Flyme Auto → USB-апдейт DHU + ADB + установщик русификации.\n"
                "Emgrand / Belgee S50 IHU718 → Lunaris / DIY SP Flash + дамп.\n"
                "Preface / Okavango / Cityray / Atlas New → в основном коммерческий GMC (TG DevBlog)."
            ),
            "warning": "Образы и пакеты чужой ревизии/платформы = высокий риск кирпича.",
        },
        {
            "order": 2,
            "title": "Telegram DevBlog по моделям (ориентир)",
            "body": (
                "Coolray/Belgee X50 дорест: t.me/gmcust + бот @Coolray_Community_helper_bot\n"
                "Coolray Rest: t.me/DevBlog_CoolRay_rest23 (+ 4PDA topic 1085149)\n"
                "Belgee X50 рест: t.me/GMC_x50\n"
                "Atlas: t.me/gmc_atlas · Atlas PRO: t.me/AtlasPRO_GMC · Atlas New/Boyue L: t.me/AtlasNew_L\n"
                "Tugella дорест: t.me/gmctugella · Rest: t.me/TugellaNew · Rest2 white: t.me/TugellaNew2\n"
                "Monjaro: t.me/DevBlog_Monjaro · Rest 2025: t.me/Monjaro_Rest2025\n"
                "Okavango: t.me/GMCust_Okavango · Preface: t.me/GMCpreface\n"
                "Cityray/Boyue Cool: t.me/gmc_cityraycool\n\n"
                "Сводка: garage.geely.su → «Полезные каналы Telegram по прошивке ГУ»."
            ),
            "warning": "DevBlog — анонсы; техподдержка у установщика/автора пакета.",
        },
        {
            "order": 3,
            "title": "Общие правила безопасности",
            "body": (
                "1. Фото экрана «О системе» / версия ПО / HW до любых действий.\n"
                "2. Полный дамп разделов (без userdata при огромном размере) перед MTK/SP Flash.\n"
                "3. Питание стабильное: двигатель или надёжный ACC; не рвать USB на записи.\n"
                "4. FAT32+MBR для USB-скриптов старых ГУ; один пакет на флешку.\n"
                "5. Перед дилером по ГУ — откат/псевдо-сток, если доступен."
            ),
            "warning": "",
        },
    ],
}

COOLRAY_REST = [
    {
        "title": "Рестайлинг Coolray (SX11-A3): платформы IHU535 / 516 / 715",
        "summary": (
            "Android 9 / Ecarx E02. Community Edition (GeeOption): русификация, APK, Wi‑Fi ADB. "
            "Не путать с USB-Community дореста."
        ),
        "source_url": "https://4pda.to/forum/index.php?showtopic=1085149",
        "steps": [
            {
                "order": 1,
                "title": "Известные стоковые сборки",
                "body": (
                    "Платформа Android 9, 4/64, экран 1920×720, обычно один USB.\n\n"
                    "Примеры с отладкой Wi‑Fi: SW0SX110207…1194, …0308…1203, …0525…1206, …0930…1169.\n"
                    "Без отладки: …1006…1229.\n"
                    "IHU535G (с ~2024): …1113…1362 (есть Wi‑Fi ADB), …0527…1389 (нет).\n\n"
                    "Кастом: Community Edition — русификация, установка приложений, отладка Wi‑Fi.\n"
                    "Также: официальные/ОД-обновления под CarPlay, набор фиксов, LunarisApp (Magisk)."
                ),
                "warning": "Берите образ строго под свой блок (535/516/715) и номер сборки.",
            },
            {
                "order": 2,
                "title": "Установка GeeOption Community (MTK, кратко)",
                "body": (
                    "Нужен LiveUSB Xubuntu с MTK Client 2.0beta (2.1 часто не unlock'ает).\n"
                    "1. Доступ к блоку (бардачок/крепления), сервисный разъём JST 1.25.\n"
                    "2. Ноут в левый USB, MTK запущен; питание/качелька по мануалу блока "
                    "(на 535 часто достаточно перезагрузки качелькой; на 715 — замыкание пинов + "
                    "перетык питания при Port-Hint).\n"
                    "3. Unlock bootloader → Read partitions (все кроме userdata) → Write "
                    "boot/system/(vendor)/(lk) из пакета под ваш IHU.\n"
                    "4. При смене ревизии иногда erase userdata.\n"
                    "5. Собрать, настроить; при скачках времени на части сборок помогает образ "
                    "с vendor от …1113 и lk без orange state."
                ),
                "warning": "Чужой образ / без unlock = brick или незагрузка. Работа на свой риск.",
            },
            {
                "order": 3,
                "title": "LunarisApp поверх Community",
                "body": (
                    "На стоке сначала Community (инструкция GeeOption / 4PDA).\n"
                    "Потом Magisk-модуль LunarisApp: zip на ГУ → Magisk → Модули → из хранилища → "
                    "перезагрузка → выдать ROOT в LunarisApp → настроить.\n"
                    "Не обновлять Magisk «до 29–31» если просит; «обновить для завершения установки» — да.\n"
                    "Макросы Macrodroid на кнопки перед установкой отключить."
                ),
                "warning": "",
            },
        ],
    },
]

ATLAS_PRO = [
    {
        "title": "Atlas Pro / Belgee X70: обзор платформы E01",
        "summary": "Android 5.1 MTK6735, 3/32. Нет штатного CarPlay/AA на сборках 86/93/115 — только QDLink или донгл.",
        "source_url": "https://4pda.to/forum/index.php?showtopic=1068514",
        "steps": [
            {
                "order": 1,
                "title": "Что за ГУ",
                "body": (
                    "Процессор MTK6735, Android 5.1, до 3 ГБ RAM / 32 ГБ.\n"
                    "Популярные сток-сборки: 86, 93, 115 (и ветки вроде 1.5.3 на 2022–23).\n"
                    "Нативная CarPlay/AA отсутствует; типичный обход — CPC200-CCPA + установка APK-клиента "
                    "или полная кастом-прошивка (GMC)."
                ),
                "warning": "",
            },
            {
                "order": 2,
                "title": "USB-скрипт установки ES (новая ветка)",
                "body": (
                    "По отчётам 4PDA для части новых прошивок Atlas:\n"
                    "1. FAT32-флешка\n"
                    "2. Распаковать архив в корень\n"
                    "3. Дождаться полной загрузки ГУ\n"
                    "4. Вставить в левый USB\n"
                    "5. Ничего не нажимать — ГУ перезагрузится само, вынуть флешку\n\n"
                    "Альтернатива без кастома: разбор ГУ + UART и ручная установка ES/APK Installer."
                ),
                "warning": "На части Tugella/новых меню метод может не сработать — смотрите свою сборку.",
            },
            {
                "order": 3,
                "title": "GMC Atlas PRO (коммерческий путь)",
                "body": (
                    "gmcust.su/atlaspro: FM+RDS, ViperFX, Я.Навигатор, тёплые опции, навибар, OTA, "
                    "голосовой ассистент, установка APK под Android 5, стрелки на приборку.\n"
                    "Есть режим «К дилеру» / псевдо-сток для ТО и возврат обратно (видео на сайте).\n"
                    "После factory reset настройка с нуля обязательна; восстановление мастером — платно.\n"
                    "Канал: t.me/AtlasPRO_GMC"
                ),
                "warning": "",
            },
            {
                "order": 4,
                "title": "Установка APK после GMC",
                "body": (
                    "Флешка → Apkinstaller на ГУ → галочка → Установить "
                    "(для Atlas / Atlas Pro / Tugella по FAQ GMC).\n"
                    "Удаление: Настройки Android → Приложения → очистить данные → удалить."
                ),
                "warning": "",
            },
        ],
    },
]

ATLAS = [
    {
        "title": "Geely Atlas (NL-3): ориентиры",
        "summary": "Отдельная ветка от Atlas Pro. Кастом обычно через GMC; DIY обсуждения на 4PDA/Drive2.",
        "source_url": "http://gmcust.su/vopros",
        "steps": [
            {
                "order": 1,
                "title": "Куда смотреть",
                "body": (
                    "Не путать с Atlas PRO (NL-3B / E01) и Atlas New / Boyue L.\n"
                    "Коммерческий путь: t.me/gmc_atlas\n"
                    "Установка APK после кастома: Apkinstaller с флешки (как у Atlas/Tugella в FAQ GMC).\n"
                    "Перед работой зафиксируйте версию ПО/HW и комплектацию мультимедиа."
                ),
                "warning": "",
            },
        ],
    },
    {
        "title": "Atlas New / Boyue L",
        "summary": "Новое поколение Atlas. Файлы и анонсы — DevBlog AtlasNew_L.",
        "source_url": "https://t.me/AtlasNew_L",
        "steps": [
            {
                "order": 1,
                "title": "Старт",
                "body": (
                    "Канал GMC: t.me/AtlasNew_L\n"
                    "Перед любыми действиями сверьте поколение кузова/ГУ с Atlas PRO и старым Atlas — "
                    "пакеты несовместимы.\n"
                    "Рабочий порядок тот же: фото версий → выбор пакета под платформу → бэкап → прошивка → проверка."
                ),
                "warning": "",
            },
        ],
    },
]

TUGELLA = [
    {
        "title": "Tugella дорест E01 (Android 5.1)",
        "summary": "Железо близко к Atlas Pro. GMC или DIY через разбор/UART.",
        "source_url": "http://gmcust.su/tugella",
        "steps": [
            {
                "order": 1,
                "title": "Платформа и GMC",
                "body": (
                    "Тема 4PDA общая с Atlas-PRO (MTK6735).\n"
                    "GMC Tugella: FM+RDS, Viper, навигация, тёплые опции, OTA, APK под Android 5, "
                    "режим «К дилеру».\n"
                    "Канал: t.me/gmctugella · сайт gmcust.su/tugella\n"
                    "Установка APK: Apkinstaller с флешки."
                ),
                "warning": "",
            },
        ],
    },
    {
        "title": "Tugella рест IHU520G (чёрный UI, E02)",
        "summary": "Android 9 / ECARX E02, 4/64, 12.3\". Инженерка по дате/времени. Не путать с белорестом IHU717P.",
        "source_url": "https://4pda.to/forum/index.php?showtopic=1091464",
        "steps": [
            {
                "order": 1,
                "title": "Инженерные меню",
                "body": (
                    "Приложение Телефон → Клавиатура.\n"
                    "1-е меню: #*(месяц+5)(день)(час 12h) по времени на ГУ.\n"
                    "Пример 15.07 04:30 → #*121504\n"
                    "2-е меню: #*(месяц+10)(день)(час) → #*171504\n\n"
                    "Для режима прошивки на плате замыкают пины 3 и 6 сервисного разъёма (осторожно, мелкий шаг)."
                ),
                "warning": "Белорест IHU717P / Knewstar 001 — другая тема 4PDA, другие пакеты.",
            },
            {
                "order": 2,
                "title": "Кастом и DIY",
                "body": (
                    "Бесплатной массовой установки APK на стоке долго не было — смотрите актуальную шапку 4PDA.\n"
                    "GMC Rest1: gmcust.su/tugellarest — APK под Android 9, split-screen, навигация на приборку, OTA.\n"
                    "Канал: t.me/TugellaNew\n"
                    "Также в теме: разбор панели, UART, GPS, ОД-обновления AA/CarPlay."
                ),
                "warning": "",
            },
        ],
    },
    {
        "title": "Tugella Rest2 White / IHU717P",
        "summary": "Светлый интерфейс с ~2023, также Knewstar 001. Отдельный DevBlog.",
        "source_url": "https://t.me/TugellaNew2",
        "steps": [
            {
                "order": 1,
                "title": "Ориентиры",
                "body": (
                    "Не использовать пакеты IHU520G (чернорест).\n"
                    "Канал: t.me/TugellaNew2\n"
                    "На 4PDA — отдельная ветка IHU717P.\n"
                    "Порядок: идентификация платформы по UI/версии ПО → бэкап → пакет под 717P."
                ),
                "warning": "",
            },
        ],
    },
]

MONJARO = [
    {
        "title": "Monjaro: инженерка и включение ADB",
        "summary": "Коды зависят от происхождения прошивки (ОД, Китай, GMC, Hi-P). Без ADB APK на сток не ставятся.",
        "source_url": "https://www.monjaro-vite.ru/install",
        "steps": [
            {
                "order": 1,
                "title": "Коды инженерного меню (Телефон → Клавиатура)",
                "body": (
                    "ОД и прошитых GMC: #*32279\n"
                    "Прошитых из Китая (ENcars / Tesla / Ксанави): *1220*\n"
                    "«Ворованная» GMC (Watchdogs splash, «Geely Custom»): **5656#\n"
                    "Hi-P русификация Цезарь / прошивка 2.0+: #*89757\n"
                    "Сток 1.5: #*(месяц+10)(день)(час 12h), напр. 9 янв 19:00 → #*110907\n"
                    "Китай с уже разблокированным ADB: #*(месяц+5)(день)(час), напр. #*60907\n\n"
                    "В инженерке: выключить «Аутентификация при установке», включить USB=ADB, "
                    "при необходимости CarPlay. Перезагрузка ГУ длинным удержанием питания."
                ),
                "warning": "На чистом китайце без разблокировки ADB включить нельзя — нужна прошивка/сервис.",
            },
            {
                "order": 2,
                "title": "Установка APK через ADB / Monjaro Vite",
                "body": (
                    "Нужны: Win10/11, data USB (часто USB-A↔A под консолью; гибрид — левый порт), интернет на ноуте.\n"
                    "Monjaro Vite Install: скачать APK-набор → в машине подключить ноут → подтвердить установку → "
                    "перезагрузка ГУ → Wi‑Fi на ГУ → активация лицензии (1 ГУ = 1 TG-аккаунт @monjaro_vite).\n"
                    "Часовой пояс: Android → Система → Дата и время → выкл. сетевой TZ → Москва.\n\n"
                    "Народный вариант: github.com/dE1l/geely-monjaro — ADB-скрипт для ОД и уже прошитых ПИ "
                    "(не для заблокированного чистого Китая)."
                ),
                "warning": "",
            },
            {
                "order": 3,
                "title": "CarPlay на официальных машинах 2024",
                "body": (
                    "Если есть кнопка голосового вызова (Siri) на руле и VIN/дата в диапазоне ОД — "
                    "просите обновление блоков IHU 1201/1202 по гарантии.\n"
                    "Беспроводной AA/CP — отдельный адаптер или сервисная активация."
                ),
                "warning": "",
            },
        ],
    },
    {
        "title": "Monjaro 2026 Rest: русификация Flyme Auto",
        "summary": "Чистый Китай, Flyme 1.9–2.3. USB-апдейт DHU → ADB → установщик. Не для уже русифицированных без сброса.",
        "source_url": "https://snick.pro/guide-monjaro-2026/",
        "steps": [
            {
                "order": 1,
                "title": "Подготовка",
                "body": (
                    "Win10/11, стабильный интернет на ноуте, data USB-A↔A, пакет установщика.\n"
                    "Только чистые китайские авто; при чужой русификации — сначала factory reset планшета.\n"
                    "Для полного набора ассистентов (кроме NOA) — аккаунт МА/Гостевой до установки."
                ),
                "warning": "Установка на свой риск; несоответствие версий ломает систему.",
            },
            {
                "order": 2,
                "title": "USB-апдейт Flyme до 1.9.1.5",
                "body": (
                    "Если уже ≥1.9.1.5 / 2.3 — шаг пропустить.\n"
                    "Флешка FAT32 ≥4 ГБ: только папка DHU с 8 файлами.\n"
                    "Инженерка → Начать обновление (ADB выключен!) → Select USB package → Confirm → 15–20 мин.\n"
                    "После: 15–20 сек держать колёсико громкости + кнопку ассистента на руле.\n"
                    "Номер версии в настройках может не смениться — ориентир: появление CarPlay в приложениях."
                ),
                "warning": "",
            },
            {
                "order": 3,
                "title": "Установщик русификации",
                "body": (
                    "Включить ADB (коды инженерки — актуальные для UTC+8 в пакете).\n"
                    "Ноут к USB планшета → программа → скопировать серийный № → активация у поставщика → Обновить.\n"
                    "На планшете на время установки интернет выключить; на ноуте — включить.\n"
                    "Сначала «Удалить китайские приложения», далее пункты слева направо (~20 мин, несколько ребутов).\n"
                    "Спец-RuStore для Monjaro — не обновлять, когда предложит.\n"
                    "После: отключить ADB (ассистент «Инженерное меню» / ADB Activator), чтобы снова работали флешки."
                ),
                "warning": "Яндекс-приложения — только из магазина поставщика; RuStore сам не обновлять.",
            },
        ],
    },
]

EMGRAND = [
    {
        "title": "Emgrand / Belgee S50: ревизии IHU718 и Lunaris",
        "summary": "Новое ГУ IHU718. Ревизии по хвосту версии и буквам ALH/AYH. Lunaris через MTKClient.",
        "source_url": "https://lunaris-firmware.ru/wiki/ustanovka-proshivki-emgrand-s50",
        "steps": [
            {
                "order": 1,
                "title": "Какой образ брать",
                "body": (
                    "1-я ревизия: хвосты 45, 60 (актуальная ветка).\n"
                    "Другая ветка: 60/63 с буквами ALH — отдельная сборка на облаке; до 63 ради локализации "
                    "других стран обновляться не обязательно.\n"
                    "S50 май 2025–фев 2026 часто 60 AYH; Emgrand 70/35 и S50 45/60 AYH → образ 60 AYH.\n"
                    "С ~фев 2026: разъём есть, но если с завода 60 ALH — только образ ALH.\n"
                    "Между ревизиями прошивки несовместимы → brick / потеря USB / чёрный экран.\n"
                    "После мая 2025 на части S50 инженерного разъёма нет."
                ),
                "warning": "Пути MTK/прошивки — только латиница, без кириллицы в папках.",
            },
            {
                "order": 2,
                "title": "Доступ и MTK (кратко)",
                "body": (
                    "Инструменты: USB-A↔A, JST GH 1.25 6pin с перемычками (3+6 и 1+2), драйвера, MTKClient GUI 2.0.\n"
                    "Доступ: бардачок → боковая крышка → блок → инженерный разъём под верхним кронштейном "
                    "(или прищепка снизу, если разъёма нет) / альтернатива — предохранитель 15А слева от руля.\n"
                    "ACC или заведённый ДВС → кабель в USB у селектора → Port-Hint → подать питание → "
                    "дамп (без userdata) → Unlock bootloader → Write boot/system/vendor/lk → Done.\n"
                    "Erase userdata — если до прошивки НЕ была 60 AYH.\n"
                    "Далее Magisk advanced → модули из /system/preinstall2/magisk_modules "
                    "(LunarisApp, LSPosed, WebView) → Zygisk → перезагрузка."
                ),
                "warning": "Без unlock после записи ГУ может не стартовать — повторите unlock.",
            },
            {
                "order": 3,
                "title": "DIY Emgrand Flagship (SP Flash, Drive2 / emgrand.by)",
                "body": (
                    "Альтернатива сообществу: полный дамп → правка разделов → заливка SP Flash Tool.\n"
                    "ПО: BuildTools, MTK drivers, Python, MTKClient, SP Flash, UsbDk, MinimalBy, "
                    "MTK Auth Bypass, WwR.\n"
                    "Unlock удобнее с LiveUSB Ubuntu+MTKClient → затем Windows: Auth Bypass → SP Flash "
                    "Download Only по scatter MT6771; галку preloader снять; писать boot/lk/system.\n"
                    "Готовые моды под IHU718P-00-ALH / ARH / AYH — сверять буквы; чужая буква рискованна "
                    "(хотя часть гайдов допускает up/down версии на своём железе).\n"
                    "Двигатель заведён на время Download; процесс не прерывать (~7–8 мин)."
                ),
                "warning": "Файлы «как есть» только при совпадении версии ПО; иначе высокий риск brick.",
            },
        ],
    },
]

PREFACE = [
    {
        "title": "Preface: русификация GMC",
        "summary": "Китай/ОД. Wi‑Fi, Я.Навигатор, мультимедиа, RuStore. Коммерческий пакет.",
        "source_url": "http://gmcust.su/proshivkapreface",
        "steps": [
            {
                "order": 1,
                "title": "Что даёт пакет",
                "body": (
                    "Полный перевод ГУ, раздача интернета по Wi‑Fi, Яндекс Навигатор, медиа-приложения, "
                    "установка из RuStore / с флешки через Root Explorer (/storage → флешка → APK).\n"
                    "Канал: t.me/GMCpreface · обзоры на gmcust.su/proshivkapreface\n"
                    "После сброса — настройка с нуля; восстановление мастером платное."
                ),
                "warning": "",
            },
        ],
    },
]

OKAVANGO = [
    {
        "title": "Okavango: русификация GMC",
        "summary": "Китай/ОД от 2023, рест 2.0. Для рестайлинга ПИ от 2024 прошивки у GMC нет.",
        "source_url": "http://gmcust.su/proshivkaokavango",
        "steps": [
            {
                "order": 1,
                "title": "Совместимость и состав",
                "body": (
                    "Пакет: перевод ГУ, Wi‑Fi, Я.Навигатор, медиа, RuStore/APK с флешки.\n"
                    "ВНИМАНИЕ (gmcust): для рестайлинга ПИ от 2024 г. прошивки НЕТ.\n"
                    "Канал: t.me/GMCust_Okavango\n"
                    "Перед оплатой/визитом сверьте год, ПИ/ОД и рест по фото версии ПО."
                ),
                "warning": "ПИ rest 2024+ — уточняйте актуальность в канале, не ставьте чужие образы.",
            },
        ],
    },
]

CITYRAY = [
    {
        "title": "Cityray / Boyue Cool",
        "summary": "Отдельный DevBlog GMC. Не путать с Coolray Rest (Binyue Cool на SX11-A3).",
        "source_url": "https://t.me/gmc_cityraycool",
        "steps": [
            {
                "order": 1,
                "title": "Старт",
                "body": (
                    "Канал: t.me/gmc_cityraycool\n"
                    "Binyue Cool на платформе рест-Coolray часто идёт по ветке SX11-A3 / GeeOption "
                    "(см. модель Coolray Rest) — сверяйте VIN/платформу ГУ.\n"
                    "Cityray как отдельная модель РФ — пакеты и инструкции только из своего DevBlog."
                ),
                "warning": "",
            },
        ],
    },
]

GMC_APK = {
    "title": "Установка приложений на прошивках GMC (общая)",
    "summary": "Разница портов/приложений между Atlas-семейством и Coolray; Rustore на новых Android.",
    "source_url": "http://gmcust.su/vopros",
    "steps": [
        {
            "order": 1,
            "title": "По моделям",
            "body": (
                "Общее: APK на флешку → USB data.\n"
                "Atlas / Atlas Pro / Tugella: Apkinstaller → галочка → Установить.\n"
                "Coolray (дорест/кастом со ES): ES Проводник → флешка → APK → Установить.\n"
                "Новые Android (Preface/Okavango/Monjaro и т.п.): RuStore или Root Explorer → /storage → флешка.\n\n"
                "OTA GMC: раздавайте интернет на ГУ и проверяйте обновления; архивы у установщиков "
                "хранят ограниченное время (часто ~6 мес)."
            ),
            "warning": "",
        },
    ],
}


class Command(BaseCommand):
    help = "Seed Geely lineup guides for Вмагнитоле (Atlas, Tugella, Monjaro, Emgrand, …)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-force",
            action="store_true",
            help="Не перезаписывать шаги существующих гайдов",
        )

    def handle(self, *args, **options):
        force = not options["no_force"]
        brand = ensure_brand()
        written = 0

        def seed(model, guides):
            nonlocal written
            for g in guides:
                _, changed = upsert_guide(
                    model, g["title"], g["summary"], g["source_url"], g["steps"], force=force
                )
                if changed:
                    written += 1
                    self.stdout.write(self.style.SUCCESS(f"{model.slug}: {g['title']}"))

        coolray = ensure_model(
            brand,
            "coolray",
            "Coolray",
            "2018–2024 (дорест)",
            "Android 4.3 H30/H40/H50",
            "USB Community. См. также seed_vmagnitol_coolray.",
            10,
        )
        seed(coolray, [CATALOG, GMC_APK])

        coolray_rest = ensure_model(
            brand,
            "coolray-rest",
            "Coolray Rest / SX11-A3",
            "2023+",
            "IHU535 / IHU516 / IHU715 · Android 9 E02",
            "GeeOption Community + LunarisApp. 4PDA 1085149.",
            15,
        )
        seed(coolray_rest, COOLRAY_REST)

        atlas_pro = ensure_model(
            brand,
            "atlas-pro",
            "Atlas Pro",
            "2021–2023",
            "E01 MTK6735 Android 5.1",
            "Belgee X70 — то же семейство. GMC / USB ES / UART.",
            30,
        )
        seed(atlas_pro, ATLAS_PRO)

        belgee_x70 = ensure_model(
            brand,
            "belgee-x70",
            "Belgee X70",
            "2023+",
            "E01 MTK6735 Android 5.1 (как Atlas Pro)",
            "Смотрите гайды Atlas Pro — железо/ветки те же.",
            35,
        )
        seed(belgee_x70, ATLAS_PRO)

        atlas = ensure_model(
            brand,
            "atlas",
            "Atlas",
            "2018–2022",
            "NL-3 штатная мультимедиа",
            "Не путать с Atlas Pro / Atlas New.",
            25,
        )
        seed(atlas, [ATLAS[0]])

        atlas_new = ensure_model(
            brand,
            "atlas-new",
            "Atlas New / Boyue L",
            "2023+",
            "Новое поколение ГУ",
            "DevBlog AtlasNew_L.",
            28,
        )
        seed(atlas_new, [ATLAS[1]])

        tugella = ensure_model(
            brand,
            "tugella",
            "Tugella",
            "2020–2022",
            "E01 Android 5.1",
            "Дорест. Близко к Atlas Pro.",
            40,
        )
        seed(tugella, [TUGELLA[0]])

        tugella_rest = ensure_model(
            brand,
            "tugella-rest",
            "Tugella Rest (IHU520G)",
            "2022–2023",
            "ECARX E02 Android 9 · чёрный UI",
            "Чернорест. Не путать с IHU717P.",
            45,
        )
        seed(tugella_rest, [TUGELLA[1]])

        tugella_white = ensure_model(
            brand,
            "tugella-rest2",
            "Tugella Rest2 White / IHU717P",
            "2023+",
            "IHU717P светлый UI",
            "Также Knewstar 001. t.me/TugellaNew2",
            48,
        )
        seed(tugella_white, [TUGELLA[2]])

        monjaro = ensure_model(
            brand,
            "monjaro",
            "Monjaro",
            "2022–2025",
            "Штатный планшет · коды инженерки / ADB",
            "Vite, народный ADB, GMC, активация CP у ОД.",
            50,
        )
        seed(monjaro, [MONJARO[0]])

        monjaro_2026 = ensure_model(
            brand,
            "monjaro-2026",
            "Monjaro 2026 Rest (Flyme)",
            "2025–2026",
            "Flyme Auto 1.9–2.3",
            "USB DHU + ADB + установщик русификации.",
            55,
        )
        seed(monjaro_2026, [MONJARO[1]])

        emgrand = ensure_model(
            brand,
            "emgrand",
            "Emgrand",
            "2023+",
            "IHU718 Android 9",
            "Lunaris / SP Flash DIY. Belgee S50 — рядом.",
            60,
        )
        seed(emgrand, EMGRAND)

        belgee_s50 = ensure_model(
            brand,
            "belgee-s50",
            "Belgee S50",
            "2023+",
            "IHU718 (как Emgrand)",
            "См. гайды Emgrand / Lunaris Wiki S50.",
            65,
        )
        seed(belgee_s50, EMGRAND)

        preface = ensure_model(
            brand,
            "preface",
            "Preface",
            "2023+",
            "Штатное ГУ Китай/ОД",
            "GMC Preface.",
            70,
        )
        seed(preface, PREFACE)

        okavango = ensure_model(
            brand,
            "okavango",
            "Okavango",
            "2023+",
            "Штатное ГУ Китай/ОД",
            "GMC; ПИ rest 2024 — уточнять наличие.",
            75,
        )
        seed(okavango, OKAVANGO)

        cityray = ensure_model(
            brand,
            "cityray",
            "Cityray / Boyue Cool",
            "2024+",
            "Уточнять платформу ГУ",
            "Отдельный DevBlog; Binyue Cool может быть SX11-A3.",
            80,
        )
        seed(cityray, CITYRAY)

        self.stdout.write(self.style.SUCCESS(f"Geely catalog done. Guides written/updated: {written}"))

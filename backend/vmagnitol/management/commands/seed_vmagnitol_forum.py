"""Версионные гайды по темам 4PDA: Coolray Rest/2025, Haval Jolion, Chery Tiggo 7 PRO, Changan CS35 Plus New."""

from django.core.management.base import BaseCommand

from vmagnitol.management.commands.seed_vmagnitol_coolray import upsert_guide
from vmagnitol.management.commands.seed_vmagnitol_geely import ensure_brand, ensure_model
from vmagnitol.models import Brand, CarModel


def ensure_other_brand(slug, name, notes, sort_order):
    brand, _ = Brand.objects.get_or_create(
        slug=slug,
        defaults={"name": name, "notes": notes, "sort_order": sort_order},
    )
    brand.notes = notes
    brand.sort_order = sort_order
    brand.save(update_fields=["notes", "sort_order", "updated_at"])
    return brand


# --- Geely Coolray Rest SX11-A3: отдельные пути под каждую аппаратную платформу ---

COOLRAY_REST_MATRIX = {
    "title": "SX11-A3: матрица платформ (715P / 516G / 535G)",
    "summary": (
        "Прошивки разных аппаратных платформ несовместимы — кирпич. "
        "ОД = IHU715P, ПИ = IHU516G или IHU535G. Источник: 4PDA t1085149."
    ),
    "source_url": "https://4pda.to/forum/index.php?showtopic=1085149",
    "steps": [
        {
            "order": 1,
            "title": "Как понять свой блок",
            "body": (
                "Смотрите маркировку на блоке / в «О системе» / build string.\n\n"
                "• IHU715P — официальный дилер (ОД)\n"
                "• IHU516G — параллельный импорт (ПИ), ранние ресты\n"
                "• IHU535G — ПИ с ~2024 года (отдельная модификация)\n\n"
                "Общее железо: Ecarx E02 / MT6771, Android 9, 4/64, 1920×720, обычно 1 USB.\n"
                "Кастом: GeeOption Community Edition (русификация, APK, Wi‑Fi ADB) + опционально LunarisApp."
            ),
            "warning": "Образ 516 на 535 / 715 на 516 = гарантированный риск brick.",
        },
        {
            "order": 2,
            "title": "Чем пути отличаются",
            "body": (
                "IHU715P (ОД): другие контакты сервисного разъёма при входе в MTK; есть ОД-пакет под CarPlay.\n"
                "IHU516G: список сток-сборок с/без Wi‑Fi ADB; «откатанная» сток с разблокированной отладкой.\n"
                "IHU535G: на части машин вход в MTK проще (качелька питания); сборки …1113 vs …0527 ведут себя по-разному "
                "(таймзона, Eco/G-Clean, люк).\n\n"
                "Дальше — отдельные гайды под каждую платформу в этой модели."
            ),
            "warning": "",
        },
    ],
}

COOLRAY_IHU715 = {
    "title": "IHU715P (ОД): GeeOption / MTK",
    "summary": "Дилерский блок. CarPlay-апдейт ОД + кастом Community. Вход в BootROM — свои пины разъёма.",
    "source_url": "https://4pda.to/forum/index.php?showtopic=1085149",
    "steps": [
        {
            "order": 1,
            "title": "Что доступно",
            "body": (
                "Официально: обновление для установки CarPlay (ветка ОД в шапке 4PDA).\n"
                "Кастом: GeeOption Community (dizz74 / @GeeOption) — Я.Навигатор/Музыка, Wi‑Fi, DTS в инженерке, "
                "далее Magisk-модуль LunarisApp.\n"
                "Каналы: t.me/GeeOptionNews, t.me/DevBlog_CoolRay_rest23"
            ),
            "warning": "",
        },
        {
            "order": 2,
            "title": "Порядок MTK (отличие от 535)",
            "body": (
                "LiveUSB Xubuntu + MTK Client 2.0beta (2.1 часто не unlock'ает).\n"
                "1. Бардачок → доступ к блоку → отключить питание → вставить перемычку в сервисный разъём "
                "(на 715 пины другие, чем на 535 — сверяйте мануал GeeOption/4PDA под 715).\n"
                "2. Ноут в левый USB, MTK запущен → подать питание → при Port-Hint быстро вынуть/вставить питание.\n"
                "3. Повтор до стабильного коннекта (иногда 3–5 раз).\n"
                "4. Unlock bootloader → Read partitions (без userdata) → Write boot/system/(vendor)/(lk) "
                "строго из пакета IHU715.\n"
                "5. Питание вынуть, перемычку снять, собрать, настроить."
            ),
            "warning": "Чужой пакет 516/535 на 715 — brick. Без unlock после записи ГУ может не стартовать.",
        },
    ],
}

COOLRAY_IHU516 = {
    "title": "IHU516G (ПИ): сток-сборки и Community",
    "summary": "Ранний ПИ-рест. Сборки с/без Wi‑Fi ADB. Community Edition под 516.",
    "source_url": "https://4pda.to/forum/index.php?showtopic=1085149",
    "steps": [
        {
            "order": 1,
            "title": "Известные стоковые сборки",
            "body": (
                "С отладкой Wi‑Fi (можно ставить сторонние APK без полного кастома на «откатанной»):\n"
                "• SW0SX110207H119400000\n"
                "• SW0SX110308H120300000\n"
                "• SW0SX110525H120600000\n"
                "• SW0SX110930H116900000\n\n"
                "Без отладки:\n"
                "• SW0SX111006H122900000\n\n"
                "В шапке также: «откатанная» официальная с разблокированной Wi‑Fi отладкой.\n"
                "Кастом: Community Edition — русификация, установка приложений, Wi‑Fi ADB."
            ),
            "warning": "Не лить пакеты IHU535G / IHU715P.",
        },
        {
            "order": 2,
            "title": "Установка Community",
            "body": (
                "Тот же контур MTK, что у рест-Coolray: LiveUSB + MTK 2.0beta → unlock → бэкап → "
                "write разделов из пакета именно для 516.\n"
                "После — при необходимости LunarisApp через Magisk.\n"
                "Для стрелок на приборке: Launch + Geely Customize (~23.42) — отдельно от прошивки ГУ."
            ),
            "warning": "",
        },
    ],
}

COOLRAY_IHU535 = {
    "title": "IHU535G (ПИ с ~2024): …1113 vs …0527",
    "summary": "Две ключевые сборки ведут себя по-разному. Вход в MTK часто через качельку, не как на 715.",
    "source_url": "https://4pda.to/forum/index.php?showtopic=1085149",
    "steps": [
        {
            "order": 1,
            "title": "Сборки",
            "body": (
                "• SW0SX111113H136200000 — есть Wi‑Fi ADB\n"
                "• SW0SX110527H138900000 — нет отладки\n\n"
                "Кастом Community под 535. Практика владельцев: на …0527 после кастома часто скачет время / "
                "нет смены TZ; переход на образ …1113 + vendor от него + lk без orange state чинит TZ, "
                "возвращает Eco/G-Clean, убирает китайский контент, чинит кнопки руля — но на части машин "
                "пропадает управление люком (на доноре …1113 люка могло не быть)."
            ),
            "warning": "Выбор донора …1113 vs …0527 — осознанный компромисс, не «просто новее».",
        },
        {
            "order": 2,
            "title": "Вход в MTK (отличие)",
            "body": (
                "Частый короткий путь на 535:\n"
                "1. Доступ к блоку / сервисный разъём JST 1.25 (два контакта; на части гайдов — "
                "не вынимая питание).\n"
                "2. Ноут с Xubuntu+MTK 2.0beta в левый USB.\n"
                "3. Перезапуск ГУ качелькой — MTK часто подхватывает сам без перетыка питания "
                "(в отличие от типичного сценария 715).\n"
                "4. Unlock → бэкап без userdata → flash boot/system/(vendor)/(lk) пакета 535.\n"
                "5. При смене ревизии иногда erase userdata."
            ),
            "warning": "MTK Client 2.1 для unlock на этих блоках обычно не подходит — берите 2.0beta.",
        },
    ],
}

# --- Coolray 2025 / SX11-A5 / IHU624G ---

COOLRAY_2025 = [
    {
        "title": "IHU624G Flyme Auto: что это за ГУ",
        "summary": (
            "Coolray Rest 2025 / CoolRay New 2025 / Binyue L / SX11-A5. "
            "6/64, 1920×1080, Flyme Auto, Android 9. Не путать с SX11-A3 (535/516/715)."
        ),
        "source_url": "https://4pda.to/forum/index.php?showtopic=1109487",
        "steps": [
            {
                "order": 1,
                "title": "Железо и границы",
                "body": (
                    "Модель ГУ: IHU624G\n"
                    "ОС: Android 9 API 28, оболочка Flyme Auto\n"
                    "SoC: Ecarx E02 / MT6771, 6 ГБ RAM / 64 ГБ, 1 USB, экран 1920×1080\n\n"
                    "Пакеты Community/GeeOption от SX11-A3 (535/516/715) сюда не ставить.\n"
                    "На момент темы 4PDA: полного «залей и забудь» кастом-образа нет — сообщество "
                    "снимает дампы и ставит перевод APK; заливка кастома через MTK = эксперимент с риском bootloop."
                ),
                "warning": "Чужой образ A3 / без понимания unlock = высокий риск brick.",
            },
            {
                "order": 2,
                "title": "Дамп через MTK (Linux) — да; заливка — осторожно",
                "body": (
                    "Снять полный/частичный дамп можно MTKClient, но не любой версией и не из Windows "
                    "(в отчётах Windows ГУ не видит — нужен свежий LiveUSB Linux, не тот же образ, что для 535).\n"
                    "1. Загрузочная флешка с проверенным образом из шапки t1109487.\n"
                    "2. Перемычка по инструкции «Активация ADB» из той же темы.\n"
                    "3. USB в левый порт авто + ноут → MTK → перезагрузка ГУ (экран может не светиться).\n"
                    "4. Read Partition — полный дамп ~1 час+.\n\n"
                    "Автор шапки прямо не советует пока заливать кастом тем же методом: "
                    "неясно unlock, поведение Magisk-patched boot, откат в bootloop."
                ),
                "warning": "Эксперименты с Write — только со своим дампом и пониманием риска.",
            },
            {
                "order": 3,
                "title": "ADB: перемычка на экране-блоке",
                "body": (
                    "Блок = сам экран (не «за бардачком» как на A3).\n"
                    "Снять экран (пластик + 3 Torx) → заглушка → перемычка между контактами 5 и 6 "
                    "(по аналогии с IHU535G) → экран можно вернуть → USB ADB.\n"
                    "Установка: ADB AppControl.\n"
                    "В настройки Android: поставить Settings.apk + SettingsApp.apk (ярлык), "
                    "ребут удержанием центра кнопки громкости на руле → язык/TZ приложений.\n"
                    "RuStore без root приложения из него часто не ставит — APK через ADB.\n"
                    "В шапке также: перевод основных приложений (TG Geely Coolray L), root/Magisk, "
                    "замена eSIM на физическую SIM (пайка)."
                ),
                "warning": "Без своего дампа откат после неудачного эксперимента затруднён.",
            },
        ],
    },
]

# --- Haval Jolion Harman Gwmv2 ---

HAVAL_JOLION = [
    {
        "title": "Harman Gwmv2: платформа и ограничения",
        "summary": "Intel Atom A3940 x86, Android 8.1, 4/16. APK только x86/x86_64. Google Services — почти нет.",
        "source_url": "https://4pda.to/forum/index.php?showtopic=1047354",
        "steps": [
            {
                "order": 1,
                "title": "Железо",
                "body": (
                    "CPU: Intel Atom A3940 (x86)\n"
                    "GPU: Intel HD 500 (Broxton)\n"
                    "RAM/ROM: 4 / 16 ГБ\n"
                    "AOSP on Harman, Android 8.1\n\n"
                    "Ранние ГУ: в инженерке был Debug → Settings.\n"
                    "С ~2022 на части прошивок пункта Settings в Debug нет — вход через терминал (следующий гайд).\n"
                    "Официальные образы (напр. R6.2) в шапке 4PDA; полного публичного root/бэкапа долго не было."
                ),
                "warning": "Телефонные ARM-APK не встанут. Google-аккаунт / GApps — обычно не работают.",
            },
            {
                "order": 2,
                "title": "Инженерка → Settings → установка APK",
                "body": (
                    "1. Зажать левый нижний угол экрана, многократно тапать правый нижний → инженерное меню.\n"
                    "2. Launch Debug App → GWMV2Terminal.\n"
                    "3. EN-раскладка, команда точно:\n"
                    "   am start --user 0 com.android.settings\n"
                    "   (двойное тире перед user, пробелы как в примере) → Enter.\n"
                    "4. Откроются настройки Android 8.1: Wi‑Fi, неизвестные источники, хранилище.\n"
                    "5. FAT32-флешка (часто нижний USB; верхний занят CarPlay) → File Manager → APK x86.\n\n"
                    "Рабочие лаунчеры: Smart/Nova, CarLauncher, CarWebGuru (штатные области оболочки не убрать).\n"
                    "Яндекс-приложения под x86 — ок. RuStore на чистом стоке без DiMagisk часто не встаёт."
                ),
                "warning": "Не удалять системные файлы внутри ГУ — путь к brick. Factory reset обычно спасает, если не трогали разделы.",
            },
            {
                "order": 3,
                "title": "DiMagisk (отдельный контур)",
                "body": (
                    "Сообщество ставит DiMagisk (беспроводной AA, звук, кнопка Home и т.д.) установщиком под Windows "
                    "с ADB — см. актуальные посты Drive2 / шапку 4PDA.\n\n"
                    "КРИТИЧНО: Magisk НЕЛЬЗЯ удалять через само приложение Magisk — brick.\n"
                    "Обновление 0.1.0→0.1.1 — отдельным updater.bat, пути без кириллицы."
                ),
                "warning": "Удаление Magisk «изнутри» = кирпич. Только штатный uninstall-путь сообщества.",
            },
        ],
    },
]

# --- Chery Tiggo 7 PRO ---

CHERY_TIGGO7 = [
    {
        "title": "Tiggo 7 PRO: прошивка только по номеру блока",
        "summary": (
            "Не по году и не по шильдику Max/Prime. Блоки 737/738/570/573/2573 — разные файлы. "
            "4PDA t1022106."
        ),
        "source_url": "https://4pda.to/forum/index.php?showtopic=1022106",
        "steps": [
            {
                "order": 1,
                "title": "Снять номер блока",
                "body": (
                    "В сведениях о системе / версии ПО: артикул вида 703000738AA, 703000737AA, "
                    "703002570AA, 703002573AA и т.п.\n"
                    "Ранние ГУ: Android 4.4.3 / imx6 / product t1e_intl (база общая с Tiggo 8 в build.prop).\n"
                    "Новые Max/рест — другие блоки Desay, свои ветки 02.0x.\n\n"
                    "Правило форума: нашли номер блока → ищете прошивку на этот номер. "
                    "Файл «для 7 Pro 2023» без артикула — лотерея."
                ),
                "warning": "Чужой артикул блока = brick / не стартующее обновление.",
            },
            {
                "order": 2,
                "title": "Ориентиры версий (меняются — сверяйте шапку)",
                "body": (
                    "Примеры из обсуждений/сводок (не догма — сверяйте дату в теме):\n"
                    "• 703000738AA (дорест Max) — ветки 02.04 / 02.06 / 02.08…\n"
                    "• 703000737AA — отдельный поиск, не подставлять 738 «наугад»\n"
                    "• 703002570AA (рест Prime/Ultra, также 7L/Tenet) — 02.07 / 02.09…, голос/навигация зависят от кодировки\n"
                    "• 703002573AA — свои сборки; Cherry Inside без разбора иногда с USB\n\n"
                    "После USB-апдейта голос может встать на EN → сброс/ребут/отдельный VR-пакет из той же ветки.\n"
                    "Папку vr в архиве иногда чистят/урезают перед прошивкой — читайте пост автора архива."
                ),
                "warning": "",
            },
            {
                "order": 3,
                "title": "Сервисное меню и пароль",
                "body": (
                    "Код в сервисное меню у машин разный.\n"
                    "Частая схема из темы: Настройки → информация о версии → под передним колесом "
                    "нажать ~12 раз → на экране ID (логин).\n"
                    "Пароль: семь последних цифр логина × 802018 → взять 6 последних цифр результата. "
                    "Пароль постоянный — сохранить.\n\n"
                    "Установка APK / Cherry Inside: на части блоков 2573 — с флешки без разбора; "
                    "навигация на приборку может требовать правки VCM (Launch)."
                ),
                "warning": "Официальные OTA лучше гонять по VIN у дилера, если открыт бюллетень.",
            },
        ],
    },
]

# --- Changan CS35 Plus New ---

CHANGAN_CS35 = [
    {
        "title": "CS35 Plus New (Allwinner T7): ADB и лимит памяти",
        "summary": "T7, ~2 ГБ RAM, ~1 ГБ под приложения. Я.Навигатор на ГУ часто убивает память. 4PDA t1098045.",
        "source_url": "https://4pda.to/forum/index.php?showtopic=1098045",
        "steps": [
            {
                "order": 1,
                "title": "Включение ADB",
                "body": (
                    "1. Приложение «Телефон» → набрать *#*#888 → Вызов\n"
                    "2. Пароль 369875\n"
                    "3. Второй пункт слева в инженерке → кнопка ADB\n"
                    "4. Подключить data-кабель; если не видит — вынуть кабель, снова ADB, вставить; "
                    "вынуть флешку регистратора; ребут громкость «−» ~10 сек; USB default = передача данных.\n\n"
                    "Альтернативы сообщества: сервисы вроде changan-guides.humanbait.ru / Hackchan — "
                    "удалённая установка подписанных APK."
                ),
                "warning": "Места под APK/кэш очень мало (~1 ГБ). Забитая память → ГУ не стартует, нужен ремонт.",
            },
            {
                "order": 2,
                "title": "Установка приложений (версия прошивки важна)",
                "body": (
                    "На прошивках ~2023 каждый APK часто нужно подписывать/сертифицировать под ГУ, "
                    "иначе с флешки не встанет.\n"
                    "Рабочие примеры из темы: подписанные Я.Карты, Я.Музыка, Simple Control, AVG Cleaner, "
                    "KillApps, VK Music — сборки с суффиксом cs35plus / sign.\n"
                    "Рекомендация сообщества при нехватке места: CarPlay / Android Auto (AutoKit + Carlinkit "
                    "для iPhone; HUR/оболочка для AA) вместо тяжёлого Я.Навигатора на ГУ.\n\n"
                    "Дилерские/китайские USB-OTA существуют; FEL/программатор — аварийный контур "
                    "(заводской OTA ≠ FEL; неверный uboot уже кирпичил блоки в теме)."
                ),
                "warning": "Не экспериментировать с FEL/uboot без дампа и опыта — в теме есть «мёртвые» T7.",
            },
            {
                "order": 3,
                "title": "Практический порядок",
                "body": (
                    "1. Фото версии ПО / build.\n"
                    "2. Включить ADB, проверить `adb devices`.\n"
                    "3. Ставить только лёгкие/подписанные APK; чистить кэш KillApps/cleaner.\n"
                    "4. Для навигации предпочтительно телефон+AA/CP.\n"
                    "5. Полную замену оболочки/прошивки — только из проверенного источника под ваш год "
                    "с инструкцией бэкапа."
                ),
                "warning": "",
            },
        ],
    },
]


class Command(BaseCommand):
    help = "Seed version-specific 4PDA forum guides (Coolray Rest/2025, Haval, Chery, Changan)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-force",
            action="store_true",
            help="Не перезаписывать шаги существующих гайдов",
        )

    def handle(self, *args, **options):
        force = not options["no_force"]
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

        geely = ensure_brand()

        coolray_rest = ensure_model(
            geely,
            "coolray-rest",
            "Coolray Rest / SX11-A3",
            "2023–2025",
            "IHU715P / IHU516G / IHU535G · Android 9",
            "Версии платформ несовместимы. 4PDA t1085149.",
            15,
        )
        seed(
            coolray_rest,
            [COOLRAY_REST_MATRIX, COOLRAY_IHU715, COOLRAY_IHU516, COOLRAY_IHU535],
        )

        coolray_2025 = ensure_model(
            geely,
            "coolray-2025",
            "Coolray Rest 2025 / New 2025",
            "2025+",
            "IHU624G Flyme Auto · 6/64 · 1920×1080",
            "SX11-A5 / Binyue L. Не путать с A3. 4PDA t1109487.",
            18,
        )
        seed(coolray_2025, COOLRAY_2025)

        haval = ensure_other_brand(
            "haval",
            "Haval",
            "Jolion Harman Gwmv2 (x86 Android 8.1) и др.",
            20,
        )
        jolion = ensure_model(
            haval,
            "jolion-gwmv2",
            "Jolion (Harman Gwmv2)",
            "2021+",
            "Intel Atom A3940 · Android 8.1 x86 · 4/16",
            "Инженерка углами + терминал. 4PDA t1047354.",
            10,
        )
        seed(jolion, HAVAL_JOLION)

        chery = ensure_other_brand(
            "chery",
            "Chery",
            "Tiggo 7 PRO / Max — прошивка строго по артикулу блока.",
            30,
        )
        tiggo7 = ensure_model(
            chery,
            "tiggo-7-pro",
            "Tiggo 7 PRO / Max",
            "2021+",
            "Блоки 70300073x / 70300257x (Desay и др.)",
            "Не по году — по номеру блока. 4PDA t1022106.",
            10,
        )
        seed(tiggo7, CHERY_TIGGO7)

        changan = ensure_other_brand(
            "changan",
            "Changan",
            "CS35 Plus New Allwinner T7 и др.",
            40,
        )
        cs35 = ensure_model(
            changan,
            "cs35-plus-new",
            "CS35 Plus New",
            "2022+",
            "Allwinner T7 · ~2/1 ГБ под APK",
            "ADB *#*#888 / 369875. 4PDA t1098045.",
            10,
        )
        seed(cs35, CHANGAN_CS35)

        self.stdout.write(self.style.SUCCESS(f"Forum version guides done. Written/updated: {written}"))

from django.core.management.base import BaseCommand

from vmagnitol.models import Brand, CarModel, Guide, GuideStep


def upsert_guide(car_model, title, summary, source_url, steps, force=True):
    """Создаёт или синхронизирует curated-гайд. По умолчанию перезаписывает шаги."""
    guide, created = Guide.objects.get_or_create(
        car_model=car_model,
        title=title,
        defaults={
            "summary": summary,
            "status": Guide.Status.PUBLISHED,
            "source_url": source_url,
        },
    )
    if not created:
        guide.summary = summary
        guide.status = Guide.Status.PUBLISHED
        guide.source_url = source_url
        guide.save(update_fields=["summary", "status", "source_url", "updated_at"])

    if not force and not created and guide.steps.count() > 0:
        return guide, False

    wanted_orders = {step["order"] for step in steps}
    if force and not created:
        guide.steps.exclude(order__in=wanted_orders).delete()
    for step in steps:
        GuideStep.objects.update_or_create(
            guide=guide,
            order=step["order"],
            defaults={
                "title": step["title"],
                "body": step["body"],
                "warning": step.get("warning", ""),
            },
        )
    return guide, True


# --- Coolray / Belgee X50 дорест (Android 4.3) ---

GUIDE_REVISION = {
    "title": "Определение ревизии ГУ и совместимость",
    "summary": (
        "Как прочитать версию ПО (H30/H40/H50), какие последние цифры допускают Community, "
        "а какие нужно сначала поднять. Источники: Coolray Wiki, Geely-Club, 4PDA."
    ),
    "source_url": "https://qttc.github.io/pages/community/",
    "steps": [
        {
            "order": 1,
            "title": "Где смотреть версию ПО",
            "body": (
                "На ГУ: Настройки → вкладка «Система» → «О системе» → «Версия ПО».\n\n"
                "Пример: 05.05.10300.H30.00084 — ревизия H30, версия 84.\n"
                "Пример: …H50.00032 — ревизия H50, версия 32.\n\n"
                "Важны символы после буквы H (ревизия блока) и последние цифры (сборка)."
            ),
            "warning": "",
        },
        {
            "order": 2,
            "title": "Матрица совместимости Community (дорест Android 4.3)",
            "body": (
                "Community — пакет модификаций поверх стока (не полноценная прошивка вроде GMC/Lunaris).\n\n"
                "Можно ставить Community на сток с последними цифрами: 22, 84, 93, 96.\n"
                "Нельзя ставить пакеты Community на версии 53 и 77 — сначала поднять до 84 или 93.\n\n"
                "Пакет Community один для всех совместимых версий; особые условия только у H30 младше 84 "
                "(см. бот и гайд «Подъём стоковой версии»).\n\n"
                "Belgee X50 дорест со старым ГУ (Android 4.3) — тот же путь, что Coolray.\n"
                "Новое ГУ (Android 9, бело/синий UI, IHU730) — Community не подходит, см. гайд Lunaris."
            ),
            "warning": "Рестайлинг / новое ГУ / китайский Binyue с другой мультимедиа — другие инструкции.",
        },
        {
            "order": 3,
            "title": "Русскоязычные vs китайские сборки (справка 4PDA)",
            "body": (
                "Известные русскоязычные ревизии/сборки: 00056, 00077, 084, 093.\n"
                "Китайские примеры: 00017, 00037, 000091, 00096, 00108 и GKUI 19 0.3.5.\n\n"
                "В китайской 037 в инженерке есть пункт APK для замены системных apk — "
                "на экспортных версиях такого пункта обычно нет.\n\n"
                "Актуальные файлы и проверка совместимости: Telegram-бот @Coolray_Community_helper_bot "
                "(тема 4PDA по Community считается устаревшей)."
            ),
            "warning": "",
        },
        {
            "order": 4,
            "title": "Флешка для любых USB-пакетов",
            "body": (
                "Требования: FAT32 + разметка MBR, объём лучше 2/4/8 ГБ.\n"
                "Современные флешки часто GPT — старое железо ГУ с ними дружит хуже.\n"
                "На одну флешку — только один пакет (не смешивать Community, откат и сток-zip)."
            ),
            "warning": "Неверный формат носителя — частая причина «ничего не происходит».",
        },
    ],
}

GUIDE_STOCK_UPGRADE = {
    "title": "Подъём стоковой версии (53/77 → 84/93) через инженерку",
    "summary": (
        "Смена стокового образа через engineering menu (код jh3280). "
        "Обязательный сброс, запрет прошивки той же версии на ту же."
    ),
    "source_url": "https://geely-club.com/forums/topic/15155-originalnye-versiya-stokovaya-proshivki-geely-coolray-84-i-93/",
    "steps": [
        {
            "order": 1,
            "title": "Критические запреты",
            "body": (
                "Если у вас 77 или 53 — перед установкой Community поднимите версию до 84 или 93.\n\n"
                "Никогда не прошивайте одну и ту же версию поверх себя:\n"
                "нельзя 84→84, 93→93.\n"
                "Это гарантированно ведёт к выходу ГУ из строя (бутлуп); самостоятельное восстановление "
                "по отчётам сообщества невозможно."
            ),
            "warning": "84 на 84 / 93 на 93 = бутлуп. Версии на флешке и на ГУ должны отличаться.",
        },
        {
            "order": 2,
            "title": "Подготовка",
            "body": (
                "1. Скачайте стоковый zip той версии, на которую переходите (84 или 93).\n"
                "2. Обязательно сделайте сброс на заводские настройки.\n"
                "3. Отформатируйте флешку в FAT32 (MBR), положите zip в корень не распаковывая.\n"
                "4. Вставьте флешку в правый USB-порт."
            ),
            "warning": "Сброс на заводские перед сменой стока — обязателен.",
        },
        {
            "order": 3,
            "title": "Вход в инженерное меню",
            "body": (
                "Настройки → О системе → зажать значок Geely → на экранной клавиатуре ввести jh3280.\n"
                "Откроется инженерка."
            ),
            "warning": "",
        },
        {
            "order": 4,
            "title": "Прошивка образа",
            "body": (
                "Выберите первый пункт: там текущая версия на ГУ и версия с флешки — "
                "убедитесь, что они НЕ совпадают.\n\n"
                "Далее: единственная кнопка на экране → правая кнопка → левая кнопка.\n"
                "Дождитесь окончания прошивки, не выключая питание."
            ),
            "warning": "Не отключайте АКБ/зажигание до полного завершения.",
        },
    ],
}

GUIDE_COMMUNITY_FULL = {
    "title": "Community Full — установка пакета",
    "summary": (
        "Полный пакет Community: SysApps, UserApps, ViperFX, VoiceAssistant, tzdata, лаунчер Home. "
        "Актуальные архивы — через @Coolray_Community_helper_bot."
    ),
    "source_url": "https://qttc.github.io/pages/community/",
    "steps": [
        {
            "order": 1,
            "title": "Что ставит Community Full",
            "body": (
                "Пакет — конструктор на done.sh: компоненты можно убрать, удалив файлы с флешки "
                "(имена в квадратных скобках).\n\n"
                "Системные настройки: меню разработчика, сторонние APK, USB-отладка принудительно off, "
                "часовой пояс GMT+8 → Москва GMT+3, tzdata 2021a [tzdata], "
                "рингтон [ANDROMEDA.ogg], bootanimation [bootanimation.mp4].\n\n"
                "SysApps:\n"
                "• KC2_EngineerMode.apk — русифицированная инженерка\n"
                "• KC2_statusbar.apk — дата/время/Wi‑Fi в статусбаре\n"
                "• KC2_SystemUI.apk — нижний бар (обогревы, Назад, Навигация→Я.Навигатор, "
                "настройки Geely/Android, меню), отключение автовсплытия климата + автоподогревы\n"
                "• KC2_EcarxSettingWidget.apk + XCControlBoard.apk — панель BT/Wi‑Fi/Hotspot\n"
                "• KC2_popview.apk — корректный последний источник, без ПДД/флешка-попапов\n"
                "• XCLauncher3.apk — лаунчер Home (стоковый Launcher3 замораживается)\n"
                "• XCNaviService.apk / Community.apk (+ IPKServer) — виджет навигации и стрелки на приборке "
                "(приборку нужно отдельно закодировать)\n\n"
                "UserApps: ES.apk, XCAutoSecure.apk, CoolWidget_1.4.apk, QuickPic_4.7.4_Geely.apk "
                "(стоковая галерея замораживается).\n"
                "Также: ViperFX 2.4.0.1 без root, VoiceAssistant, Data, Wallpapers.\n"
                "Лог установки пишется на флешку: ГГГГММДД-ЧЧММ.log."
            ),
            "warning": "Community снимает гарантийные риски по ГУ — перед дилером делайте откат в сток.",
        },
        {
            "order": 2,
            "title": "Скачивание",
            "body": (
                "1. Проверьте версию ПО (гайд «Определение ревизии»).\n"
                "2. Откройте @Coolray_Community_helper_bot → «У меня сток» → ваша версия ГУ.\n"
                "3. Скачайте актуальный архив (на 4PDA пакеты по Community устарели).\n"
                "4. При необходимости положите доп. APK в UserApps до установки "
                "(GNSS Commander, KeyRemap, Яндекс Навигатор и т.д.)."
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Установка",
            "body": (
                "1. Распакуйте архив в корень флешки FAT32/MBR (файлы в корне, не вложенная папка архива).\n"
                "2. Заведите двигатель, дождитесь полной загрузки ГУ.\n"
                "3. Вставьте флешку в любой передний USB (для Community порт не критичен).\n"
                "4. Ничего не нажимайте. Установка 5–10 минут, ГУ перезагрузится само.\n"
                "5. Сохраните лог с флешки.\n\n"
                "После установки: первый Home предложит выбрать лаунчер — поставьте Home по умолчанию.\n"
                "Дату/время выставляйте на приборке кнопками руля — иначе ГУ снова уйдёт в 2016 и "
                "сломает активации (QDLink и др.)."
            ),
            "warning": "Не кладите несколько пакетов на одну флешку.",
        },
        {
            "order": 4,
            "title": "Кастомизация и обновление",
            "body": (
                "Удаление файла компонента с флешки отключает его установку.\n"
                "Рингтон/анимацию можно заменить своими файлами с теми же именами.\n"
                "Повторная установка Community обновляет существующую: бывшие системные доп. APK "
                "переезжают в пользовательские."
            ),
            "warning": "",
        },
    ],
}

GUIDE_COMMUNITY_LITE = {
    "title": "Community Lite — Android Auto и CarPlay",
    "summary": (
        "Облегчённые пакеты под телефон: Lite AA (HUR/KeyRemap) и Lite CP (AutoKit + Carlinkit). "
        "Установка как у Full; откат — пакетом to stock."
    ),
    "source_url": "https://qttc.github.io/pages/community/",
    "steps": [
        {
            "order": 1,
            "title": "Общий состав Lite",
            "body": (
                "От Full Lite оставляет:\n"
                "• системные настройки Android\n"
                "• tzdata\n"
                "• ANDROMEDA.ogg\n"
                "• KC2_statusbar.apk\n"
                "• KC2_SystemUI.apk (бар, климат, автоподогревы)\n"
                "• KC2_popview.apk\n\n"
                "Стрелка в нижнем баре открывает HUR (AA) или AutoKit (CP) — не Яндекс Навигатор."
            ),
            "warning": "",
        },
        {
            "order": 2,
            "title": "Lite для Android Auto",
            "body": (
                "Дополнительно:\n"
                "• ES.apk\n"
                "• Headunit Reloaded (в пакетах встречаются HUR_7.0.4 / HUR_7.1.4)\n"
                "• KetRemap_1.24.1.apk — переназначение кнопок\n\n"
                "Актуально: HUR для Android 4 устарел; сообщество чаще рекомендует OHU / OH Coolray "
                "(см. гайд по приложениям). Если AA отваливается через 10–15 сек — меняйте HUR на OHU."
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Lite для Apple CarPlay",
            "body": (
                "Дополнительно:\n"
                "• ES.apk\n"
                "• AutoKit (в пакетах: 2023.12… / 2024.02… — берите актуальный из бота/чата)\n\n"
                "Нужен донгл Carlinkit CCPx. Без донгла экспериментально — coorlay "
                "(otnep.github.io/coorlay)."
            ),
            "warning": "",
        },
        {
            "order": 4,
            "title": "Установка и откат",
            "body": (
                "Порядок как у Community Full: распаковать в корень FAT32/MBR → USB → ждать перезагрузку.\n"
                "Откат в сток — стандартным пакетом «H… to stock» для вашей версии."
            ),
            "warning": "",
        },
    ],
}

GUIDE_ROLLBACK = {
    "title": "Откат Community в сток (по версиям H30/H40/H50)",
    "summary": (
        "Полный и частичный откат. Архивы «H… to stock.zip» под конкретную сборку. "
        "Перед дилером по ГУ — сначала сток."
    ),
    "source_url": "https://qttc.github.io/pages/rollback/",
    "steps": [
        {
            "order": 1,
            "title": "Когда откатываться",
            "body": (
                "• Гарантийный визит по ГУ (камеры, экран и т.п.)\n"
                "• Продажа / передача авто\n"
                "• Глюки после экспериментов"
            ),
            "warning": "",
        },
        {
            "order": 2,
            "title": "Полный откат",
            "body": (
                "1. Узнайте версию после H (пример H50.00032).\n"
                "2. Скачайте «H… to stock.zip» из бота: Community → «Откатиться в сток».\n"
                "3. Если стоит KingRoot — сначала снимите root "
                "(KingRoot → ⋮ → Настройки → Удалить Root-права → без «Сохр. резервн. копию root»).\n"
                "4. Распакуйте архив в корень FAT32-флешки → любой USB → 5–7 минут."
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Известные архивы полного отката",
            "body": (
                "H30.00071 → H30.00071 to stock.zip (~73 МБ)\n"
                "H30.00096 → H30.00096 to stock.zip (~69 МБ)\n"
                "H30.00108 → H30.00108 to stock.zip (~75 МБ)\n"
                "H40.00022 → H40.00022 to stock.zip (~71 МБ)\n"
                "H50.00009 → H50.00009 to stock.zip (~71 МБ)\n"
                "H50.00020 / H50.00022 / H50.00032 → соответствующие to stock.zip (~71 МБ)\n\n"
                "Нет вашей версии — уточните в боте/чате."
            ),
            "warning": "",
        },
        {
            "order": 4,
            "title": "Частичный откат",
            "body": (
                "Удаление ES.zip — ES Проводник\n"
                "Удаление ViperFX.zip — ViPER4Android\n"
                "Удаление AutoKit.zip — AutoKit\n"
                "Откат IPKServer.zip — стоковый сервис навигации на приборке\n\n"
                "Ставятся так же: корень флешки → USB. После ES/AutoKit ГУ перезагрузится само.\n"
                "Откат IPKServer: только H40.00022 и H50.00009/20/22/32; на H30 не работает.\n"
                "На части H50 стрелки на приборке чинятся именно откатом IPKServer при сохранённом Community."
            ),
            "warning": "",
        },
    ],
}

GUIDE_APPS = {
    "title": "Приложения после Community: навигатор, AA, звук",
    "summary": (
        "Яндекс Навигатор/Музыка, выбор AA-клиента (OHU vs HUR), ViperFX, CarPlay без донгла."
    ),
    "source_url": "https://qttc.github.io/pages/apps/",
    "steps": [
        {
            "order": 1,
            "title": "Установка APK с флешки",
            "body": (
                "Скопируйте APK на флешку → USB → ES Проводник → флешка → установить.\n"
                "Можно заранее кинуть APK в UserApps до установки Community."
            ),
            "warning": "",
        },
        {
            "order": 2,
            "title": "Яндекс Навигатор и стрелки на приборке",
            "body": (
                "Ставят APK навигатора (в чатах часто фигурирует 4.84 с 9-м звуковым каналом).\n"
                "Кнопка навигации в баре Community Full открывает Яндекс Навигатор.\n"
                "Стрелки на приборке: Community Full (IPKServer) + кодировка приборки сканером "
                "(Launch + Geely Customize). Без кодировки стрелок не будет.\n"
                "Стрелки видны, когда навигатор свёрнут. CarPlay/AA через донгл стрелки обычно не даёт."
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Android Auto / CarPlay клиенты",
            "body": (
                "OHU (HeadUnit Revived) — предпочтительно: быстрее, кнопки руля.\n"
                "OH Coolray — беспроводной AA через 5 ГГц hotspot ГУ.\n"
                "HUR — устарел для Android 4.\n"
                "AutoKit — только Carlinkit CCPx.\n"
                "CarPlay без донгла: экспериментальный coorlay."
            ),
            "warning": "",
        },
        {
            "order": 4,
            "title": "ViperFX",
            "body": (
                "В Community Full ViPER4Android FX 2.4.0.1 ставится системно с профилями, "
                "драйвер регистрируется скриптом — root не нужен."
            ),
            "warning": "",
        },
    ],
}

GUIDE_CLUSTER = {
    "title": "Стрелки навигации на приборной панели",
    "summary": (
        "Community Full + Яндекс Навигатор + кодировка приборки. "
        "Без кодировки стрелок не будет. Через донгл AA/CP стрелки обычно не идут."
    ),
    "source_url": "https://qttc.github.io/pages/cluster-navigation/",
    "steps": [
        {
            "order": 1,
            "title": "Что нужно",
            "body": (
                "1. Community Full (IPKServer / XCNaviService) — в Lite кнопка навигации ведёт в HUR/AutoKit.\n"
                "2. Яндекс Навигатор на ГУ.\n"
                "3. Нормальный GPS (часто USB u-blox).\n"
                "4. Кодировка приборки сканером Launch + Geely Customize (на 4PDA — пакет от ~23.42).\n\n"
                "Стрелки: Я.Навигатор на ГУ (свёрнут) — да; CarPlay via coorlay — да при кодировке; "
                "Carlinkit/AutoKit и HUR/OHU — нет."
            ),
            "warning": "Community только ставит сервис; без кодировки приборки стрелок не будет.",
        },
        {
            "order": 2,
            "title": "Кодировка",
            "body": (
                "Меняют один байт в кодировке блока приборки (пример с Drive2: …5E… → …3F… — "
                "два символа на позиции 12-го байта). Код у каждой машины свой — "
                "не копируйте строку целиком, правьте только этот байт в своём дампе.\n"
                "Перед правкой сохраните исходную кодировку. Для аналоговой приборки код другой."
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Если «маршрут не определён»",
            "body": (
                "1. Сверните навигатор (на полный экран стрелки не идут).\n"
                "2. Переключите уведомления Я.Навигатора off/on.\n"
                "3. Разрешите работу в фоне.\n"
                "4. Проверьте GPS.\n"
                "5. На H50: частичный «Откат IPKServer.zip» (стоковый сервис), остальное Community оставить.\n"
                "Подсказки на EN: язык приборки EN→RU и перезагрузка ГУ."
            ),
            "warning": "",
        },
    ],
}

# --- Belgee X50 новое ГУ (Android 9 / IHU730) ---

GUIDE_LUNARIS = {
    "title": "Belgee X50 новое ГУ (IHU730): Lunaris",
    "summary": (
        "Для Android 9 (бело/синий UI). Community не подходит. "
        "Две ревизии блоков (…56/23/86 vs …66) — прошивки несовместимы. MTKClient + инженерный разъём."
    ),
    "source_url": "https://lunaris-firmware.ru/wiki/ustanovka-proshivki-lunaris",
    "steps": [
        {
            "order": 1,
            "title": "Ревизии и риски",
            "body": (
                "Отличие по последним цифрам версии ПО:\n"
                "• 1-я ревизия: 56, 23, 86 (актуальная цель — 86)\n"
                "• 2-я ревизия: 66\n\n"
                "Прошивки между ревизиями несовместимы → кирпич, потеря USB, чёрный экран.\n"
                "1-ю ревизию перед Lunaris обновляют до 86.\n"
                "Полный сброс на 86: на стоке риск слета MCU; на Lunaris — откат фикса подсветки.\n"
                "После марта 2025 на части машин 1-й ревизии нет инженерного разъёма."
            ),
            "warning": "Нельзя ставить образ чужой ревизии. Нельзя ставить Community на IHU730.",
        },
        {
            "order": 2,
            "title": "Инструменты",
            "body": (
                "• USB Type-A ↔ Type-A (~1 м)\n"
                "• Разъём JST GH 1.25, 6 pin (папа) с перемычками:\n"
                "  (3) USB + (6) 3.3V; (1) GND + (2) Recovery; остальные изолировать\n"
                "• Ноутбук Win10/11, MTKClient GUI, драйвера (Driver Auto Installer + UsbDk)\n"
                "• Образ Lunaris строго под вашу ревизию + крест.отвёртка, ключ на 8"
            ),
            "warning": "",
        },
        {
            "order": 3,
            "title": "Доступ к блоку",
            "body": (
                "Пассажирское сиденье назад → снять барашки бардачка → панель с плафоном → "
                "открутить блок (4 болта, два утоплены) → с правой стороны под кронштейном "
                "инженерный разъём → вставить подготовленный JST."
            ),
            "warning": "Работа при ACC/зажигании/заведённом ДВС, чтобы ГУ не выключилось.",
        },
        {
            "order": 4,
            "title": "MTKClient: бэкап → unlock → запись",
            "body": (
                "1. Кабель в левый USB авто; отключить питание ГУ (нижний разъём сзади).\n"
                "2. Запустить MTKClient; при «Port - Hint» подать питание.\n"
                "3. Read partition(s): Select all, снять userdata → сохранить дамп.\n"
                "4. Flash Tools → Unlock bootloader (без unlock после прошивки ГУ не стартует).\n"
                "5. Write partition(s): boot.bin, system.bin, vendor.bin, lk.bin → Done.\n"
                "6. Снять питание, вынуть перемычку и USB, подать питание снова.\n"
                "7. После установки приложений: Magisk (advanced) → модули из "
                "/system/preinstall2/magisk_modules (LunarisApp, LSPosed, WebView; Viper/удаление QDLink опционально) "
                "→ включить Zygisk → перезагрузка."
            ),
            "warning": "Без дампа userdata-разделов и unlock восстановление сильно усложняется.",
        },
    ],
}


class Command(BaseCommand):
    help = "Seed Geely Coolray / Belgee guides for Вмагнитоле from public wiki/forum sources"

    def add_arguments(self, parser):
        parser.add_argument(
            "--no-force",
            action="store_true",
            help="Не перезаписывать шаги уже существующих гайдов",
        )

    def handle(self, *args, **options):
        force = not options["no_force"]
        brand, _ = Brand.objects.get_or_create(
            slug="geely",
            defaults={
                "name": "Geely",
                "notes": "Coolray / Belgee: дорест Android 4.3 (Community) и новое ГУ Android 9 (Lunaris).",
                "sort_order": 10,
            },
        )
        brand.notes = (
            "Coolray / Belgee SX11: дорест Android 4.3 — Community; "
            "новое ГУ Android 9 IHU730 — Lunaris/GMC. Актуальные файлы: @Coolray_Community_helper_bot."
        )
        brand.save(update_fields=["notes", "updated_at"])

        coolray, _ = CarModel.objects.get_or_create(
            brand=brand,
            slug="coolray",
            defaults={
                "name": "Coolray",
                "years": "2018–2024 (дорест)",
                "head_unit": "Штатное ГУ Android 4.3 (H30/H40/H50)",
                "notes": "Community / сток / откат. Не путать с рестайлингом Android 9.",
                "sort_order": 10,
            },
        )
        coolray.years = "2018–2024 (дорест)"
        coolray.head_unit = "Штатное ГУ Android 4.3 (H30/H40/H50)"
        coolray.notes = (
            "Дорестайлинг SX11. Версия ПО: Настройки → Система → О системе. "
            "Community на 22/84/93/96; 53/77 сначала поднять. Источник-каркас: qttc.github.io + Geely-Club/4PDA."
        )
        coolray.save(update_fields=["years", "head_unit", "notes", "updated_at"])

        belgee, _ = CarModel.objects.get_or_create(
            brand=brand,
            slug="belgee-x50",
            defaults={
                "name": "Belgee X50",
                "years": "2023+",
                "head_unit": "Дорест Android 4.3 или новое IHU730 Android 9",
                "notes": "Дорест = путь Coolray/Community. Новое ГУ = Lunaris.",
                "sort_order": 20,
            },
        )
        belgee.head_unit = "Дорест Android 4.3 или новое IHU730 Android 9"
        belgee.notes = (
            "Дорест со старым ГУ — те же гайды Community, что у Coolray. "
            "Новое ГУ (бело/синий UI) — Lunaris; Community не ставить."
        )
        belgee.save(update_fields=["head_unit", "notes", "updated_at"])

        # Replace generic starter if it still exists under the old title
        old = Guide.objects.filter(
            car_model=coolray,
            title="Прошивка и русификация штатной магнитолы",
        ).first()
        if old:
            old.title = GUIDE_REVISION["title"]
            old.save(update_fields=["title", "updated_at"])

        seeded = 0
        for spec in (
            GUIDE_REVISION,
            GUIDE_STOCK_UPGRADE,
            GUIDE_COMMUNITY_FULL,
            GUIDE_COMMUNITY_LITE,
            GUIDE_ROLLBACK,
            GUIDE_APPS,
            GUIDE_CLUSTER,
        ):
            _, changed = upsert_guide(
                coolray,
                spec["title"],
                spec["summary"],
                spec["source_url"],
                spec["steps"],
                force=force,
            )
            if changed:
                seeded += 1
                self.stdout.write(self.style.SUCCESS(f"Coolray: {spec['title']}"))
            else:
                self.stdout.write(f"Coolray skip (exists): {spec['title']}")

        # Belgee: pointer guides + Lunaris
        _, changed = upsert_guide(
            belgee,
            GUIDE_REVISION["title"],
            "Для дореста Belgee X50 — та же матрица, что у Coolray. Для нового ГУ смотрите Lunaris.",
            GUIDE_REVISION["source_url"],
            GUIDE_REVISION["steps"],
            force=force,
        )
        if changed:
            seeded += 1
        _, changed = upsert_guide(
            belgee,
            GUIDE_COMMUNITY_FULL["title"],
            "Только дорест Android 4.3. На IHU730 не ставить.",
            GUIDE_COMMUNITY_FULL["source_url"],
            GUIDE_COMMUNITY_FULL["steps"],
            force=force,
        )
        if changed:
            seeded += 1
        _, changed = upsert_guide(
            belgee,
            GUIDE_LUNARIS["title"],
            GUIDE_LUNARIS["summary"],
            GUIDE_LUNARIS["source_url"],
            GUIDE_LUNARIS["steps"],
            force=force,
        )
        if changed:
            seeded += 1
            self.stdout.write(self.style.SUCCESS(f"Belgee: {GUIDE_LUNARIS['title']}"))

        self.stdout.write(self.style.SUCCESS(f"Done. Guides written/updated: {seeded}"))

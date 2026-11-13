"""Подробные поэтапные гайды по разделам + манифесты файлов. Анти-кирпич чеклисты."""

from django.core.management.base import BaseCommand

from vmagnitol.management.commands.seed_vmagnitol_geely import ensure_brand, ensure_model
from vmagnitol.models import Guide, GuideFile
from vmagnitol.seed_utils import upsert_guide
from vmagnitol.management.commands.seed_vmagnitol_forum import (
    ensure_other_brand,
)


G = Guide.Category
R = Guide.RiskLevel
V = Guide.Verified
FR = GuideFile.Role


def _manifest(lines):
    return "\n".join(lines)


def seed_coolray_dorest(coolray, force):
    n = 0

    # --- IDENTIFY ---
    _, ch = upsert_guide(
        coolray,
        "0. Определить ревизию ГУ (обязательно до любых действий)",
        "Без точной ревизии H30/H40/H50 и последних цифр сборки любой пакет = риск кирпича.",
        "https://qttc.github.io/pages/community/",
        [
            {
                "order": 1,
                "title": "Сфотографировать экран «О системе»",
                "body": (
                    "На ГУ: Настройки → вкладка «Система» → «О системе» → «Версия ПО».\n\n"
                    "Сделайте фото всего экрана. Запишите строку целиком.\n\n"
                    "Пример: 05.05.10300.H30.00084\n"
                    "• H30 — ревизия блока\n"
                    "• 00084 / 84 — номер сборки (последние цифры)"
                ),
                "warning": "",
                "stop_if": "Не можете найти «Версия ПО» или строка не содержит букву H — STOP, не качайте пакеты.",
            },
            {
                "order": 2,
                "title": "Проверить совместимость Community",
                "body": (
                    "Дорест Android 4.3 ONLY.\n\n"
                    "Можно Community на сток: последние цифры 22, 84, 93, 96.\n"
                    "НЕЛЬЗЯ ставить Community на 53 и 77 — сначала поднять сток до 84 или 93 "
                    "(отдельный гайд «Сток через инженерку»).\n\n"
                    "Новое ГУ Android 9 / бело-синий UI / IHU730 — это НЕ этот раздел "
                    "(смотрите Belgee X50 Lunaris / Coolray Rest)."
                ),
                "warning": "Пакет дореста на рест/новое ГУ = кирпич.",
                "stop_if": "Ревизия не H30/H40/H50 дорест Android 4.3 — STOP.",
            },
            {
                "order": 3,
                "title": "Выбрать цель работы",
                "body": (
                    "Дальше открывайте раздел по цели:\n"
                    "• Подготовка и флешка\n"
                    "• Сток / подъём версии (если 53/77)\n"
                    "• Community Full\n"
                    "• Community Lite AA / CarPlay\n"
                    "• Откат в сток\n"
                    "• Приложения после Community"
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.LOW,
        verified=V.CROSSCHECKED,
        brick_warning="Не скачивайте и не копируйте на флешку пакеты, пока не подтвердили Hxx и последние цифры.",
        file_manifest=_manifest(
            [
                "[ ] Фото экрана «О системе» (сохранить у себя)",
                "[ ] Запись: ревизия H__  сборка ____",
            ]
        ),
        sort_order=10,
        attachments=[
            {
                "title": "Чеклист: определение версии",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "coolray-dorest-identify-checklist.txt",
                "content": (
                    "Coolray / Belgee X50 ДОРЕСТ — чеклист идентификации\n"
                    "=================================================\n"
                    "1. Настройки → Система → О системе → Версия ПО\n"
                    "2. Фото экрана сохранено: ДА / НЕТ\n"
                    "3. Полная строка: ________________________________\n"
                    "4. Ревизия (H30/H40/H50): ______\n"
                    "5. Последние цифры: ______\n"
                    "6. Android 4.3 (дорест)? ДА / НЕТ\n"
                    "7. Если 53 или 77 — сначала гайд стока до 84/93\n"
                    "8. Если Android 9 / новый UI — УЙТИ в другой раздел модели\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    # --- PREP ---
    _, ch = upsert_guide(
        coolray,
        "1. Подготовка флешки и питания (анти-кирпич)",
        "Неверный носитель — частая причина «ничего не произошло» или сбоя записи.",
        "https://qttc.github.io/pages/community/",
        [
            {
                "order": 1,
                "title": "Требования к флешке",
                "body": (
                    "• Объём лучше 2 / 4 / 8 ГБ (старое железо лучше дружит со старыми флешками)\n"
                    "• Файловая система: FAT32\n"
                    "• Разметка: MBR (не GPT)\n"
                    "• На флешке — ТОЛЬКО один пакет (не смешивать Community + откат + сток-zip)\n\n"
                    "Windows: «Управление дисками» / Rufus / DiskGenius — убедиться MBR+FAT32."
                ),
                "warning": "GPT на современных флешках — частая ошибка.",
                "stop_if": "Не можете подтвердить FAT32+MBR — STOP, переформатируйте.",
            },
            {
                "order": 2,
                "title": "Питание автомобиля",
                "body": (
                    "Двигатель заведён или гарантированно стабильный ACC на всё время операции "
                    "(Community 5–10 мин; сток через инженерку — дольше).\n"
                    "Не глушить, не открывать двери так, чтобы ГУ ушло в sleep mid-flash."
                ),
                "warning": "Обрыв питания во время записи сток-образа — высокий риск brick.",
                "stop_if": "АКБ слабая / машина глохнет — STOP, зарядите/заведите.",
            },
            {
                "order": 3,
                "title": "Бэкап того, что можно сохранить без разбора",
                "body": (
                    "• Фото всех экранов версии\n"
                    "• Список установленных приложений / настроек\n"
                    "• Коды активации онлайн-сервисов, если есть\n"
                    "Полный EMMC-дамп на доресте обычно не делают для USB-Community — "
                    "но откат возможен только пакетом «H… to stock» вашей версии."
                ),
                "warning": "Без пакета отката вашей H-версии возврат к стоку может быть недоступен.",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.PREP,
        risk_level=R.MEDIUM,
        verified=V.CROSSCHECKED,
        brick_warning="Один пакет на флешку. FAT32+MBR. Стабильное питание.",
        file_manifest=_manifest(
            [
                "[ ] Флешка 2–8 ГБ, FAT32, MBR",
                "[ ] Пустая (один пакет)",
            ]
        ),
        sort_order=20,
        attachments=[
            {
                "title": "Чеклист флешки",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "coolray-dorest-usb-checklist.txt",
                "content": (
                    "Флешка для Coolray дорест\n"
                    "========================\n"
                    "Объём: ____ ГБ (рекоменд. 2/4/8)\n"
                    "FAT32: ДА / НЕТ\n"
                    "MBR (не GPT): ДА / НЕТ\n"
                    "На флешке только один пакет: ДА / НЕТ\n"
                    "Двигатель/ACC стабилен: ДА / НЕТ\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    # --- FIRMWARE stock ---
    _, ch = upsert_guide(
        coolray,
        "2. Сток: поднять 53/77 → 84 или 93 (инженерка jh3280)",
        "Только если Community нельзя на текущей сборке. Повтор той же версии на ту же = бутлуп.",
        "https://geely-club.com/forums/topic/15155-originalnye-versiya-stokovaya-proshivki-geely-coolray-84-i-93/",
        [
            {
                "order": 1,
                "title": "ЖЁСТКИЙ ЗАПРЕТ (прочитайте дважды)",
                "body": (
                    "НЕЛЬЗЯ прошивать:\n"
                    "• 84 поверх уже установленной 84\n"
                    "• 93 поверх уже установленной 93\n"
                    "• любую версию поверх ТОЧНО такой же\n\n"
                    "По многократным отчётам сообщества это ГАРАНТИРОВАННО ведёт к бутлупу. "
                    "Самостоятельное восстановление обычно невозможно."
                ),
                "warning": "84→84 / 93→93 = кирпич (бутлуп).",
                "stop_if": "Целевая версия на флешке СОВПАДАЕТ с текущей на ГУ — STOP НЕМЕДЛЕННО.",
            },
            {
                "order": 2,
                "title": "Скачать целевой сток-zip",
                "body": (
                    "Скачайте zip стока 84 ИЛИ 93 (другую, чем стоит сейчас).\n"
                    "Источник: посты Geely-Club / материалы 4PDA (ориентир в source_url гайда).\n"
                    "Файл кладётся в корень флешки НЕ распаковывая."
                ),
                "warning": "",
                "stop_if": "Не уверены, что zip именно сток нужной версии — STOP, сверьте имя/описание.",
            },
            {
                "order": 3,
                "title": "Обязательный сброс на заводские",
                "body": (
                    "Перед сменой стока сделайте factory reset штатными средствами ГУ.\n"
                    "Без сброса сообщество фиксирует сбои установки."
                ),
                "warning": "Сброс обязателен.",
                "stop_if": "Сброс не выполнен — STOP.",
            },
            {
                "order": 4,
                "title": "Инженерное меню и прошивка",
                "body": (
                    "1. Флешка FAT32/MBR, zip в корне, правый USB.\n"
                    "2. Настройки → О системе → зажать значок Geely → код jh3280.\n"
                    "3. Первый пункт: сверить текущую версию и версию с флешки — они ДОЛЖНЫ отличаться.\n"
                    "4. Единственная кнопка → правая → левая.\n"
                    "5. Ждать окончания. Не трогать питание."
                ),
                "warning": "Не совпали версии на экране инженерки — не жмите кнопки.",
                "stop_if": "В инженерке версии совпадают — STOP, выньте флешку.",
            },
            {
                "order": 5,
                "title": "После успеха",
                "body": (
                    "Проверьте «Версия ПО». Только после этого переходите к Community.\n"
                    "Если 53/77 успешно стали 84/93 — можно ставить Community Full/Lite."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.FIRMWARE,
        risk_level=R.CRITICAL,
        verified=V.CROSSCHECKED,
        brick_warning=(
            "КРИТИЧНО: запрет прошивки той же версии на ту же (84→84, 93→93) — бутлуп без "
            "самостоятельного восстановления. Версии на ГУ и на флешке обязаны отличаться."
        ),
        file_manifest=_manifest(
            [
                "[REQUIRED] stock_Hxx_00084.zip ИЛИ stock_…093.zip (не распаковывать)",
                "[ ] НЕ тот же номер, что уже на ГУ",
            ]
        ),
        sort_order=30,
        attachments=[
            {
                "title": "STOP: запрет same-to-same",
                "role": FR.DOC,
                "is_required": True,
                "filename": "STOP-same-firmware.txt",
                "content": (
                    "STOP — ПРОШИВКА ТОЙ ЖЕ ВЕРСИИ НА ТУ ЖЕ\n"
                    "=====================================\n"
                    "84 на 84 = БУТЛУП\n"
                    "93 на 93 = БУТЛУП\n"
                    "Восстановление самостоятельно по отчётам сообщества НЕВОЗМОЖНО.\n"
                    "Перед кнопкой в инженерке СВЕРЬТЕ два номера на экране.\n"
                ),
            },
            {
                "title": "Где взять сток 84/93",
                "role": FR.FIRMWARE,
                "is_required": True,
                "external_url": "https://geely-club.com/forums/topic/15155-originalnye-versiya-stokovaya-proshivki-geely-coolray-84-i-93/",
                "notes": "Скачайте zip целевой версии и загрузите в этот гайд кнопкой «+ Файл» к шагу 2.",
            },
        ],
    )
    if ch:
        n += 1

    # --- COMMUNITY FULL ---
    _, ch = upsert_guide(
        coolray,
        "3. Community Full — установка (USB)",
        "Пакет модификаций поверх стока 22/84/93/96. Актуальный архив — только из бота.",
        "https://qttc.github.io/pages/community/",
        [
            {
                "order": 1,
                "title": "Предусловия",
                "body": (
                    "✓ Ревизия дорест H30/H40/H50 подтверждена\n"
                    "✓ Сборка 22 / 84 / 93 / 96 (если 53/77 — сначала сток-гайд)\n"
                    "✓ Флешка FAT32+MBR, пустая\n"
                    "✓ Двигатель/ACC\n"
                    "✓ Скачан АКТУАЛЬНЫЙ пакет из @Coolray_Community_helper_bot "
                    "(тема 4PDA по Community устарела)"
                ),
                "warning": "4PDA-архивы Community могут быть старыми — используйте бота.",
                "stop_if": "Сборка не из списка совместимых — STOP.",
            },
            {
                "order": 2,
                "title": "Распаковать пакет в корень флешки",
                "body": (
                    "1. Скачанный zip распаковать в папку на ПК.\n"
                    "2. Содержимое (done.sh, SysApps, UserApps, …) скопировать в КОРЕНЬ флешки "
                    "(не оставить вложенную папку с именем архива).\n"
                    "3. Кастомизация: удалите с флешки файлы компонентов в [скобках] из описания, "
                    "если не нужны; свои APK — в UserApps."
                ),
                "warning": "Несколько пакетов на одной флешке — нельзя.",
                "stop_if": "В корне нет скрипта/папок пакета — STOP, проверьте распаковку.",
            },
            {
                "order": 3,
                "title": "Установка в машине",
                "body": (
                    "1. Завести, дождаться полной загрузки ГУ.\n"
                    "2. Вставить флешку в любой передний USB.\n"
                    "3. НИЧЕГО не нажимать. 5–10 минут. ГУ перезагрузится само.\n"
                    "4. Вынуть флешку. Сохранить лог ГГГГММДД-ЧЧММ.log с флешки.\n"
                    "5. При выборе лаунчера — Home по умолчанию.\n"
                    "6. Дату/время — на ПРИБОРКЕ кнопками руля (не в настройках ГУ)."
                ),
                "warning": "Если >15 мин тишины — не паникуйте сразу; не выдёргивайте на середине записи.",
                "stop_if": "",
            },
            {
                "order": 4,
                "title": "Что должно появиться (краткий чеклист)",
                "body": (
                    "Статусбар с датой/Wi‑Fi, нижний бар с обогревами/навигацией, лаунчер Home, "
                    "ES, QuickPic, ViperFX, отключённые попапы ПДД/флешки.\n"
                    "Подробный состав — в манифесте файлов гайда."
                ),
                "warning": "Community влияет на гарантию по ГУ — перед дилером откат.",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.COMMUNITY,
        risk_level=R.HIGH,
        verified=V.CROSSCHECKED,
        brick_warning=(
            "Только дорест 22/84/93/96. Не ставить на 53/77 и не на Android 9. "
            "Один пакет на флешку. Актуальный архив — из бота."
        ),
        file_manifest=_manifest(
            [
                "[REQUIRED] Community Full zip → распаковать в корень (done.sh, SysApps, UserApps…)",
                "[ ] Источник: Telegram @Coolray_Community_helper_bot",
                "[ ] После установки: сохранить *.log с флешки",
                "Компоненты (можно удалить с флешки до установки):",
                "  tzdata, ANDROMEDA.ogg, bootanimation.mp4,",
                "  KC2_EngineerMode.apk, KC2_statusbar.apk, KC2_SystemUI.apk,",
                "  KC2_EcarxSettingWidget.apk, XCControlBoard.apk, KC2_popview.apk,",
                "  XCLauncher3.apk, XCNaviService.apk, Community.apk,",
                "  ES.apk, XCAutoSecure.apk, CoolWidget_1.4.apk, QuickPic_…,",
                "  ViperFX/, VoiceAssistant/, Data/, Wallpapers/",
            ]
        ),
        sort_order=40,
        attachments=[
            {
                "title": "Манифест Community Full",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "community-full-manifest.txt",
                "content": (
                    "COMMUNITY FULL — манифест файлов\n"
                    "================================\n"
                    "Скачать: @Coolray_Community_helper_bot → У меня сток → ваша версия\n"
                    "Загрузить бинарник в этот гайд после скачивания (+ Файл).\n\n"
                    "Распаковать в КОРЕНЬ флешки FAT32/MBR.\n"
                    "Не ставить на 53/77. Не ставить на Android 9.\n"
                ),
            },
            {
                "title": "Бот актуальных пакетов",
                "role": FR.PACKAGE,
                "is_required": True,
                "external_url": "https://t.me/Coolray_Community_helper_bot",
                "notes": "Единственный рекомендуемый источник актуального Community.",
            },
            {
                "title": "Wiki: установка Community",
                "role": FR.DOC,
                "external_url": "https://qttc.github.io/pages/community/",
            },
        ],
    )
    if ch:
        n += 1

    # --- CARPLAY LITE ---
    _, ch = upsert_guide(
        coolray,
        "4. Community Lite — Apple CarPlay (AutoKit + донгл)",
        "Облегчённый пакет под iPhone. Нужен Carlinkit CCPx. Установка как Full.",
        "https://qttc.github.io/pages/community/",
        [
            {
                "order": 1,
                "title": "Когда выбирать Lite CP, а не Full",
                "body": (
                    "Нужен упор на телефон + донгл CarPlay, без полного набора Full "
                    "(лаунчер/Viper/виджеты).\n"
                    "Стрелка в баре откроет AutoKit, не Яндекс Навигатор."
                ),
                "warning": "",
                "stop_if": "Нет донгла Carlinkit и не планируете coorlay — CarPlay на ГУ не появится из воздуха.",
            },
            {
                "order": 2,
                "title": "Установка",
                "body": (
                    "Те же предусловия, что Full (сборка 22/84/93/96, FAT32/MBR).\n"
                    "Бот → пакет Lite CarPlay → распаковать в корень → USB → ждать ребут.\n"
                    "В составе: ES + AutoKit (+ общие правки statusbar/SystemUI/popview/tzdata)."
                ),
                "warning": "",
                "stop_if": "",
            },
            {
                "order": 3,
                "title": "Донгл и проверка",
                "body": (
                    "Подключить Carlinkit CCPx, открыть AutoKit, проверить связь с iPhone.\n"
                    "Откат — пакет «H… to stock» вашей версии."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.CARPLAY,
        risk_level=R.HIGH,
        verified=V.COMMUNITY,
        brick_warning="Те же ограничения платформы, что у Community Full.",
        file_manifest=_manifest(
            [
                "[REQUIRED] Community Lite CarPlay zip (из бота)",
                "[REQUIRED] Донгл Carlinkit CCPx (железо)",
                "[ ] AutoKit актуальный APK если обновляете отдельно",
            ]
        ),
        sort_order=50,
        attachments=[
            {
                "title": "Манифест Lite CarPlay",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "community-lite-carplay-manifest.txt",
                "content": (
                    "LITE CARPLAY\n"
                    "===========\n"
                    "Пакет: бот → Lite CarPlay\n"
                    "Донгл: Carlinkit CCPx\n"
                    "Файлы пакета обычно: ES.apk, AutoKit_….apk + общие SysApps\n"
                    "После скачивания загрузите zip в гайд (+ Файл).\n"
                ),
            },
            {
                "title": "Бот пакетов",
                "role": FR.PACKAGE,
                "is_required": True,
                "external_url": "https://t.me/Coolray_Community_helper_bot",
            },
        ],
    )
    if ch:
        n += 1

    # --- ANDROID AUTO LITE ---
    _, ch = upsert_guide(
        coolray,
        "5. Community Lite — Android Auto (HUR / лучше OHU)",
        "Lite AA ставит HUR+KeyRemap. Сообщество часто рекомендует заменить HUR на OHU после установки.",
        "https://qttc.github.io/pages/apps/",
        [
            {
                "order": 1,
                "title": "Предусловия и установка Lite AA",
                "body": (
                    "Сборка 22/84/93/96, FAT32/MBR, пакет Lite Android Auto из бота → корень → USB → ждать.\n"
                    "В пакете: ES, HUR (7.0.x/7.1.x), KetRemap."
                ),
                "warning": "HUR для Android 4 устарел; отвалы через 10–15 сек — типичная жалоба.",
                "stop_if": "Несовместимая сборка стока — STOP.",
            },
            {
                "order": 2,
                "title": "Рекомендуемая замена: OHU / OH Coolray",
                "body": (
                    "После Lite (или вместо HUR): поставить Open Headunit / OH Coolray с чата/Wiki apps.\n"
                    "OHU: кнопки руля, активнее развивается.\n"
                    "OH Coolray: беспроводной AA через 5 ГГц hotspot ГУ."
                ),
                "warning": "",
                "stop_if": "",
            },
            {
                "order": 3,
                "title": "Проверка",
                "body": (
                    "Кабель качественный USB. Проверить рулевые кнопки. "
                    "Если AA рвётся — сначала кабель/OHU, не перепрошивка стока."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.ANDROID_AUTO,
        risk_level=R.HIGH,
        verified=V.COMMUNITY,
        brick_warning="Те же ограничения, что у Community. Не лейть Full и Lite подряд на одну флешку.",
        file_manifest=_manifest(
            [
                "[REQUIRED] Community Lite AA zip (бот)",
                "[рекоменд.] OHU / OH Coolray APK (после установки)",
                "[ ] KetRemap если нужен ремап кнопок",
            ]
        ),
        sort_order=55,
        attachments=[
            {
                "title": "Манифест Lite AA",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "community-lite-aa-manifest.txt",
                "content": (
                    "LITE ANDROID AUTO\n"
                    "=================\n"
                    "Пакет: бот → Lite AA (ES + HUR + KetRemap)\n"
                    "Рекомендация Wiki: заменить HUR на OHU/OH Coolray\n"
                    "Страница apps: https://qttc.github.io/pages/apps/\n"
                ),
            },
            {
                "title": "Wiki apps (OHU vs HUR)",
                "role": FR.DOC,
                "external_url": "https://qttc.github.io/pages/apps/",
            },
        ],
    )
    if ch:
        n += 1

    # --- ROLLBACK ---
    _, ch = upsert_guide(
        coolray,
        "6. Откат Community → сток (по вашей H-версии)",
        "Перед дилером по ГУ / продажей. Архив строго «H… to stock» вашей сборки.",
        "https://qttc.github.io/pages/rollback/",
        [
            {
                "order": 1,
                "title": "Узнать точную H-версию",
                "body": (
                    "Снова «О системе» → часть после H, напр. H50.00032.\n"
                    "Скачать ИМЕННО «H50.00032 to stock.zip» (или ваш номер) из бота: "
                    "Community → Откатиться в сток."
                ),
                "warning": "Чужой H-архив может не подойти или навредить.",
                "stop_if": "Нет архива именно вашей H-версии — STOP, спросите в боте/чате.",
            },
            {
                "order": 2,
                "title": "Снять KingRoot если есть",
                "body": (
                    "KingRoot → ⋮ → Настройки → Удалить Root-права → без «Сохр. резервн. копию root»."
                ),
                "warning": "",
                "stop_if": "",
            },
            {
                "order": 3,
                "title": "Установка отката",
                "body": (
                    "Распаковать to stock в корень FAT32 → любой USB → 5–7 мин.\n"
                    "Частичный откат (ES/Viper/AutoKit/IPKServer) — отдельные маленькие архивы, "
                    "не для полного возврата к стоку."
                ),
                "warning": "Откат IPKServer только для части H40/H50; на H30 не работает.",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.ROLLBACK,
        risk_level=R.HIGH,
        verified=V.CROSSCHECKED,
        brick_warning="Только архив своей H-версии. Сначала снять root.",
        file_manifest=_manifest(
            [
                "[REQUIRED] Hxx.xxxxx to stock.zip — ТОЛЬКО ваша версия",
                "Известные в Wiki: H30.00071/96/108, H40.00022, H50.00009/20/22/32",
            ]
        ),
        sort_order=60,
        attachments=[
            {
                "title": "Таблица to stock (Wiki)",
                "role": FR.DOC,
                "is_required": True,
                "external_url": "https://qttc.github.io/pages/rollback/",
            },
            {
                "title": "Чеклист отката",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "rollback-checklist.txt",
                "content": (
                    "ОТКАТ COMMUNITY\n"
                    "===============\n"
                    "Моя версия H__:______\n"
                    "Архив скачан с ТОЧНО таким именем: ДА / НЕТ\n"
                    "KingRoot снят: ДА / НЕТ / не было\n"
                    "Флешка FAT32, только этот пакет: ДА / НЕТ\n"
                ),
            },
        ],
    )
    if ch:
        n += 1

    return n


def seed_coolray_rest_sections(model, force):
    """Разделы для SX11-A3 с упором на анти-кирпич платформ."""
    n = 0
    _, ch = upsert_guide(
        model,
        "0. Идентификация платформы 715P / 516G / 535G",
        "Прошивки платформ НЕСОВМЕСТИМЫ. Ошибка платформы = кирпич.",
        "https://4pda.to/forum/index.php?showtopic=1085149",
        [
            {
                "order": 1,
                "title": "Снять маркировку блока",
                "body": (
                    "ОД: IHU715P\n"
                    "ПИ: IHU516G или IHU535G (535 с ~2024)\n\n"
                    "Запишите полный SW0SX11… номер. Сверьте с шапкой 4PDA t1085149."
                ),
                "warning": "Пакет 516 на 535 / 715 на 516 = brick.",
                "stop_if": "Платформа не определена однозначно — STOP, не скачивайте образы.",
            },
            {
                "order": 2,
                "title": "Выбрать раздел по цели",
                "body": (
                    "• Кастом GeeOption Community (прошивка разделов MTK) — риск CRITICAL\n"
                    "• Русификация / APK после кастома\n"
                    "• CarPlay (ОД-апдейт на 715 / кастом)\n"
                    "• Android Auto (после разблокировки установки APK)\n"
                    "• LunarisApp (Magisk-модуль поверх Community)"
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.LOW,
        verified=V.CROSSCHECKED,
        brick_warning="НИКОГДА не пишите образ чужой аппаратной платформы.",
        file_manifest="[ ] Фото маркировки IHU + полный SW string",
        sort_order=10,
        attachments=[
            {
                "title": "STOP: чужая платформа",
                "role": FR.DOC,
                "is_required": True,
                "filename": "STOP-wrong-platform-A3.txt",
                "content": (
                    "SX11-A3: IHU715P ≠ IHU516G ≠ IHU535G\n"
                    "Образ другой платформы = КИРПИЧ\n"
                    "Тема: https://4pda.to/forum/index.php?showtopic=1085149\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Community GeeOption (MTK) — общий безопасный порядок",
        "LiveUSB + MTK 2.0beta → unlock → бэкап → write ТОЛЬКО своего пакета. Питание стабильно.",
        "https://4pda.to/forum/index.php?showtopic=1085149",
        [
            {
                "order": 1,
                "title": "Инструменты",
                "body": (
                    "• Флешка LiveUSB Xubuntu с MTK Client 2.0beta (2.1 часто НЕ unlock'ает)\n"
                    "• USB-A↔A в левый порт\n"
                    "• JST 1.25 перемычка (пины зависят от 715 vs 535 — сверьте мануал платформы)\n"
                    "• Образ Community ИМЕННО вашей платформы + место на диске под бэкап без userdata"
                ),
                "warning": "MTK 2.1 — частая причина «не unlock».",
                "stop_if": "Нет LiveUSB 2.0beta или нет пакета своей платформы — STOP.",
            },
            {
                "order": 2,
                "title": "Бэкап ДО записи",
                "body": (
                    "Unlock bootloader → Read partitions (все КРОМЕ userdata) → сохранить дамп.\n"
                    "Без дампа откат при неудаче крайне сложен."
                ),
                "warning": "",
                "stop_if": "Дамп не завершён успешно — STOP, не пишите кастом.",
            },
            {
                "order": 3,
                "title": "Запись",
                "body": (
                    "Write boot/system/(vendor)/(lk) из пакета вашей платформы.\n"
                    "535: часто вход качелькой; 715: другие пины + перетык питания на Port-Hint.\n"
                    "После Done: снять питание/перемычку, собрать, проверить загрузку."
                ),
                "warning": "Без unlock после записи ГУ может не стартовать — повторите unlock.",
                "stop_if": "На экране Write выбран не тот каталог образа — STOP.",
            },
        ],
        force=force,
        category=G.COMMUNITY,
        risk_level=R.CRITICAL,
        verified=V.COMMUNITY,
        brick_warning=(
            "CRITICAL: чужая платформа, пропуск бэкапа, MTK 2.1, обрыв питания на Write — пути к кирпичу."
        ),
        file_manifest=_manifest(
            [
                "[REQUIRED] LiveUSB образ с MTK 2.0beta",
                "[REQUIRED] Community bin-пакет ТОЛЬКО своей IHU",
                "[REQUIRED] Папка бэкапа разделов (без userdata)",
            ]
        ),
        sort_order=40,
        attachments=[
            {
                "title": "Чеклист MTK до Write",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "mtk-pre-write-checklist.txt",
                "content": (
                    "Перед Write partition\n"
                    "=====================\n"
                    "Платформа подтверждена (715/516/535): ____\n"
                    "Пакет с именем этой платформы: ДА / НЕТ\n"
                    "MTK Client 2.0beta: ДА / НЕТ\n"
                    "Unlock bootloader Done: ДА / НЕТ\n"
                    "Read dump без userdata сохранён: ДА / НЕТ\n"
                    "Двигатель/ACC: ДА / НЕТ\n"
                    "Если хоть одно НЕТ — НЕ ЖАТЬ Write\n"
                ),
            },
            {
                "title": "4PDA SX11-A3",
                "role": FR.DOC,
                "is_required": True,
                "external_url": "https://4pda.to/forum/index.php?showtopic=1085149",
            },
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "CarPlay / Android Auto после разблокировки",
        "На ОД 715 — смотреть официальный CarPlay-апдейт. На кастоме — APK клиентов + донглы.",
        "https://4pda.to/forum/index.php?showtopic=1085149",
        [
            {
                "order": 1,
                "title": "CarPlay",
                "body": (
                    "IHU715P ОД: в шапке есть «Обновление для установки CarPlay» — отдельный официальный пакет, "
                    "не путать с Community.\n"
                    "После Community: клиенты/донгла по гайдам чата GeeOption."
                ),
                "warning": "",
                "stop_if": "Не смешивать ОД-CarPlay пакет с Write Community в одной сессии без бэкапа.",
            },
            {
                "order": 2,
                "title": "Android Auto",
                "body": (
                    "После кастома с установкой APK — HUR/OHU/AutoKit по необходимости.\n"
                    "Сверяйте Android 9-совместимые сборки APK."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.CARPLAY,
        risk_level=R.MEDIUM,
        verified=V.COMMUNITY,
        brick_warning="Официальный CarPlay-апдейт — только для своей ветки ОД.",
        file_manifest="[ ] ОД CarPlay update (715) ИЛИ APK клиентов после Community",
        sort_order=50,
        attachments=[],
    )
    if ch:
        n += 1

    return n


def seed_coolray_2025(model, force):
    n = 0
    _, ch = upsert_guide(
        model,
        "0. IHU624G: что можно и чего НЕЛЬЗЯ",
        "Дамп MTK — да. Заливка кастома через MTK — пока НЕ рекомендуется (риск bootloop).",
        "https://4pda.to/forum/index.php?showtopic=1109487",
        [
            {
                "order": 1,
                "title": "Границы безопасности",
                "body": (
                    "Модель: IHU624G, Flyme Auto, Android 9, 6/64, 1920×1080.\n"
                    "НЕ ставить пакеты SX11-A3 (535/516/715).\n"
                    "Автор шапки 4PDA: снять дамп можно; заливать кастом/даже сток тем же методом — "
                    "не советует, пока не ясен unlock и откат."
                ),
                "warning": "Write без ясного unlock = высокий риск bootloop.",
                "stop_if": "Планируете Write partition «на удачу» — STOP. Сначала только дамп + ADB APK.",
            },
            {
                "order": 2,
                "title": "Безопасный путь: ADB + перевод APK",
                "body": (
                    "1. Снять экран (блок=экран), 3 Torx, перемычка контакты 5–6.\n"
                    "2. USB ADB → AppControl.\n"
                    "3. Settings.apk + SettingsApp.apk → ребут удержанием громкости на руле.\n"
                    "4. Файлы перевода из TG Coolray L / шапка темы.\n"
                    "5. По возможности снять дамп LiveUSB (отдельный Linux-образ из шапки, не от 535) "
                    "ДО экспериментов с root."
                ),
                "warning": "RuStore без root часто не ставит приложения — APK через ADB.",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.CRITICAL,
        verified=V.CROSSCHECKED,
        brick_warning=(
            "BLOCKED по умолчанию: заливка кастом-образа через MTK на IHU624G без подтверждённого "
            "unlock/отката. Разрешённый путь: ADB APK + дамп."
        ),
        file_manifest=_manifest(
            [
                "[REQUIRED] Перемычка JST / инструкция 5–6",
                "[REQUIRED] Settings.apk + SettingsApp.apk",
                "[рекоменд.] Дамп Read Partition до root",
                "[BLOCKED] Любой Write кастома без обновления шапки 4PDA",
            ]
        ),
        sort_order=10,
        attachments=[
            {
                "title": "BLOCKED: MTK Write на 624",
                "role": FR.DOC,
                "is_required": True,
                "filename": "BLOCKED-ihu624-write.txt",
                "content": (
                    "IHU624G — ЗАПРЕТ ЗАЛИВКИ КАСТОМА ЧЕРЕЗ MTK (пока)\n"
                    "================================================\n"
                    "По шапке 4PDA t1109487: дамп OK, write НЕ рекомендован\n"
                    "(неясен unlock, Magisk-boot, откат → bootloop).\n"
                    "Безопасный путь: перемычка 5-6 → ADB → APK / перевод.\n"
                    "Не использовать образы IHU535/516/715.\n"
                ),
            },
            {
                "title": "Тема 4PDA IHU624G",
                "role": FR.DOC,
                "is_required": True,
                "external_url": "https://4pda.to/forum/index.php?showtopic=1109487",
            },
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Русификация / приложения через ADB",
        "Перемычка 5–6, AppControl, переводные APK. Без Write разделов.",
        "https://4pda.to/forum/index.php?showtopic=1109487",
        [
            {
                "order": 1,
                "title": "Включить ADB перемычкой",
                "body": (
                    "Снять экран → заглушка → перемычка 5–6 → вернуть экран → кабель в левый USB → ADB."
                ),
                "warning": "",
                "stop_if": "ADB devices пусто после перемычки — не переходите к экспериментам с root.",
            },
            {
                "order": 2,
                "title": "Поставить настройки и перевод",
                "body": (
                    "Settings.apk + SettingsApp.apk → ребут → язык приложений/TZ.\n"
                    "Пакет перевода основных приложений из шапки/TG.\n"
                    "Навигатор — сборки, проверенные на Android 9 (как для 535)."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.RUSSIFY,
        risk_level=R.MEDIUM,
        verified=V.COMMUNITY,
        brick_warning="Не переходите к Magisk/Write без полного дампа.",
        file_manifest="[REQUIRED] Settings.apk, SettingsApp.apk, пакет перевода",
        sort_order=40,
        attachments=[
            {
                "title": "Манифест APK русификации 624",
                "role": FR.MANIFEST,
                "is_required": True,
                "filename": "ihu624-russify-manifest.txt",
                "content": (
                    "IHU624G русификация без Write\n"
                    "==============================\n"
                    "[ ] Settings.apk\n"
                    "[ ] SettingsApp.apk\n"
                    "[ ] Пакет перевода из шапки t1109487 / TG Coolray L\n"
                    "[ ] ADB AppControl на ПК\n"
                    "Загрузите APK в этот гайд после скачивания.\n"
                ),
            }
        ],
    )
    if ch:
        n += 1
    return n


def seed_haval(force):
    brand = ensure_other_brand(
        "haval", "Haval", "Jolion Harman Gwmv2 x86 Android 8.1", 20
    )
    model = ensure_model(
        brand,
        "jolion-gwmv2",
        "Jolion (Harman Gwmv2)",
        "2021+",
        "Atom A3940 · Android 8.1 x86 · 4/16",
        "Только x86 APK. 4PDA t1047354.",
        10,
    )
    n = 0
    _, ch = upsert_guide(
        model,
        "0. Платформа x86 — что ставить нельзя",
        "ARM-APK с телефона не встанут. GApps обычно нет.",
        "https://4pda.to/forum/index.php?showtopic=1047354",
        [
            {
                "order": 1,
                "title": "Проверка",
                "body": (
                    "CPU Intel Atom A3940, Android 8.1, архитектура x86/x86_64.\n"
                    "Любой APK должен быть сборкой под x86 и Android 8.1."
                ),
                "warning": "Удаление системных файлов внутри ГУ → brick.",
                "stop_if": "APK только arm64-v8a без x86 — STOP, не устанавливать.",
            }
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.MEDIUM,
        verified=V.CROSSCHECKED,
        brick_warning="Не удалять Magisk через само приложение Magisk (DiMagisk) — brick.",
        file_manifest="[ ] Только x86/x86_64 APK под Android 8.1",
        sort_order=10,
        attachments=[
            {
                "title": "STOP: DiMagisk uninstall",
                "role": FR.DOC,
                "is_required": True,
                "filename": "STOP-dimagisk-uninstall.txt",
                "content": (
                    "DiMagisk / Magisk на Jolion\n"
                    "===========================\n"
                    "НЕЛЬЗЯ удалять Magisk через UI Magisk — КИРПИЧ\n"
                    "Только штатный uninstall-путь сообщества / установщик.\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Русификация / установка приложений (Settings через терминал)",
        "Углы экрана → GWMV2Terminal → am start settings → FAT32 APK.",
        "https://4pda.to/forum/index.php?showtopic=1047354",
        [
            {
                "order": 1,
                "title": "Открыть настройки Android",
                "body": (
                    "1. Зажать левый нижний угол, тапать правый нижний → инженерка.\n"
                    "2. Launch Debug App → GWMV2Terminal.\n"
                    "3. Команда ТОЧНО:\n"
                    "   am start --user 0 com.android.settings\n"
                    "4. Wi‑Fi, неизвестные источники, хранилище."
                ),
                "warning": "Двойное тире перед user. Ошибка набора = команда не сработает.",
                "stop_if": "",
            },
            {
                "order": 2,
                "title": "Поставить APK с флешки",
                "body": (
                    "FAT32 → USB (часто нижний) → File Manager → установить x86 APK.\n"
                    "Типичный набор: FileManager, RuStore (на стоке может не встать без DiMagisk), "
                    "Я.Навигатор x86 под 8.1, WiFi Connection."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.RUSSIFY,
        risk_level=R.MEDIUM,
        verified=V.CROSSCHECKED,
        brick_warning="Не чистить системные разделы вручную.",
        file_manifest="[REQUIRED] Подборка x86 APK; команда settings в чеклисте",
        sort_order=40,
        attachments=[
            {
                "title": "Команда Settings",
                "role": FR.DOC,
                "is_required": True,
                "filename": "jolion-am-start-settings.txt",
                "content": "am start --user 0 com.android.settings\n",
            },
            {
                "title": "4PDA Harman Gwmv2",
                "role": FR.DOC,
                "external_url": "https://4pda.to/forum/index.php?showtopic=1047354",
            },
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Android Auto (после приложений / DiMagisk)",
        "Беспроводной AA стабильнее на DiMagisk 0.1.1+. Не удалять Magisk из UI.",
        "https://4pda.to/forum/index.php?showtopic=1047354",
        [
            {
                "order": 1,
                "title": "DiMagisk",
                "body": (
                    "Установщик Windows из постов сообщества. Пути без кириллицы.\n"
                    "Читать вывод bat. Для обновления 0.1.0→0.1.1 — updater, не полный installer."
                ),
                "warning": "Удаление Magisk через Magisk = brick.",
                "stop_if": "Не поняли пункт uninstall в инструкции — не ставьте DiMagisk.",
            }
        ],
        force=force,
        category=G.ANDROID_AUTO,
        risk_level=R.HIGH,
        verified=V.COMMUNITY,
        brick_warning="CRITICAL при неправильном удалении Magisk.",
        file_manifest="[REQUIRED] DiMagisk_installer / updater (загрузить после скачивания)",
        sort_order=55,
        attachments=[],
    )
    if ch:
        n += 1
    return n


def seed_chery(force):
    brand = ensure_other_brand(
        "chery", "Chery", "Tiggo 7 PRO — только по артикулу блока", 30
    )
    model = ensure_model(
        brand,
        "tiggo-7-pro",
        "Tiggo 7 PRO / Max",
        "2021+",
        "Блоки 70300073x / 70300257x",
        "Прошивка по номеру блока. 4PDA t1022106.",
        10,
    )
    n = 0
    _, ch = upsert_guide(
        model,
        "0. Найти артикул блока (иначе не прошивать)",
        "Год и шильдик Max не определяют файл. Только 7030…AA.",
        "https://4pda.to/forum/index.php?showtopic=1022106",
        [
            {
                "order": 1,
                "title": "Снять номер",
                "body": (
                    "Сведения о системе / версия ПО → артикул вида 703000738AA, 703000737AA, "
                    "703002570AA, 703002573AA.\n"
                    "Запишите. Ищите прошивку ТОЛЬКО на этот номер."
                ),
                "warning": "Файл «для 7 Pro 2023» без артикула — лотерея.",
                "stop_if": "Артикул блока неизвестен — STOP.",
            }
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.LOW,
        verified=V.CROSSCHECKED,
        brick_warning="Чужой артикул блока при USB-апдейте = brick / нестартующее обновление.",
        file_manifest="[ ] Фото экрана с артикулом 7030…",
        sort_order=10,
        attachments=[
            {
                "title": "STOP: чужой блок",
                "role": FR.DOC,
                "is_required": True,
                "filename": "STOP-wrong-chery-block.txt",
                "content": (
                    "Chery Tiggo 7 PRO\n"
                    "Прошивка ТОЛЬКО на свой 7030xxxxxAA\n"
                    "737 ≠ 738 ≠ 570 ≠ 573\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Сток / OTA-прошивка по блоку",
        "USB-обновление файла своей ветки. После — проверить голос/VR.",
        "https://4pda.to/forum/index.php?showtopic=1022106",
        [
            {
                "order": 1,
                "title": "Подбор файла",
                "body": (
                    "В теме/у дилера по VIN найдите архив для вашего 7030…\n"
                    "Примеры веток (сверяйте актуальность в шапке): 02.04 / 02.06 / 02.07 / 02.08 / 02.09.\n"
                    "Папку vr иногда нужно урезать — читайте пост автора архива."
                ),
                "warning": "",
                "stop_if": "Имя архива не содержит ваш артикул / явное «для 570 и 573» без вашего номера — STOP.",
            },
            {
                "order": 2,
                "title": "Установка",
                "body": (
                    "Следовать инструкции конкретного архива (USB, инженерка).\n"
                    "После апдейта голос на EN → ребут / сброс / отдельный VR.\n"
                    "Официальный путь: звонок по VIN, есть ли бюллетень."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.FIRMWARE,
        risk_level=R.CRITICAL,
        verified=V.COMMUNITY,
        brick_warning="CRITICAL при чужом блоке.",
        file_manifest="[REQUIRED] Firmware zip строго для вашего 7030…AA",
        sort_order=30,
        attachments=[
            {
                "title": "4PDA Tiggo 7 PRO",
                "role": FR.DOC,
                "is_required": True,
                "external_url": "https://4pda.to/forum/index.php?showtopic=1022106",
            }
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "Приложения / Cherry Inside (если доступно для блока)",
        "На части 2573 — USB без разбора. Навигация на приборку может требовать Launch.",
        "https://4pda.to/forum/index.php?showtopic=1022106",
        [
            {
                "order": 1,
                "title": "Проверить поддержку блока",
                "body": (
                    "Cherry Inside без разбора анонсировали для части 2573.\n"
                    "Не ставить пакеты «с Авито» без совпадения блока и отчётов в теме."
                ),
                "warning": "",
                "stop_if": "Нет подтверждения для вашего артикула — STOP.",
            }
        ],
        force=force,
        category=G.APPS,
        risk_level=R.HIGH,
        verified=V.COMMUNITY,
        brick_warning="Только при подтверждённой совместимости блока.",
        file_manifest="[ ] Пакет Cherry Inside под ваш блок (если есть)",
        sort_order=45,
        attachments=[],
    )
    if ch:
        n += 1
    return n


def seed_changan(force):
    brand = ensure_other_brand(
        "changan", "Changan", "CS35 Plus New Allwinner T7", 40
    )
    model = ensure_model(
        brand,
        "cs35-plus-new",
        "CS35 Plus New",
        "2022+",
        "Allwinner T7 · мало места под APK",
        "ADB *#*#888. 4PDA t1098045.",
        10,
    )
    n = 0
    _, ch = upsert_guide(
        model,
        "0. Лимит памяти — главный риск «кирпича»",
        "~1 ГБ под приложения/кэш. Я.Навигатор на ГУ часто забивает память → ГУ не стартует.",
        "https://hackchan.ru/changan/cs35plusnew/",
        [
            {
                "order": 1,
                "title": "Правило",
                "body": (
                    "Рекомендуется CarPlay / Android Auto с телефона вместо тяжёлых APK на ГУ.\n"
                    "FEL/uboot эксперименты в теме уже приводили к мёртвым блокам — не повторять."
                ),
                "warning": "Забитая userdata/app partition → не включается, нужен ремонт.",
                "stop_if": "Собираетесь ставить полный Я.Навигатор + медиа без cleaner — пересмотрите план.",
            }
        ],
        force=force,
        category=G.IDENTIFY,
        risk_level=R.HIGH,
        verified=V.CROSSCHECKED,
        brick_warning="CRITICAL: нехватка места; FEL write без дампа.",
        file_manifest="[ ] План: AA/CP вместо тяжёлых APK",
        sort_order=10,
        attachments=[
            {
                "title": "STOP: память / FEL",
                "role": FR.DOC,
                "is_required": True,
                "filename": "STOP-cs35-memory-fel.txt",
                "content": (
                    "CS35 Plus New\n"
                    "1) Не забивать ~1ГБ тяжёлыми APK\n"
                    "2) Не шить FEL/uboot без опыта и дампа\n"
                    "3) Заводской OTA ≠ FEL\n"
                ),
            }
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "ADB и установка приложений",
        "*#*#888 / 369875 → ADB. На прошивках ~23 APK часто нужны подписанные.",
        "https://hackchan.ru/changan/cs35plusnew/",
        [
            {
                "order": 1,
                "title": "Включить ADB",
                "body": (
                    "Телефон → *#*#888 → Вызов → пароль 369875 → пункт ADB.\n"
                    "Если не видит: вынуть кабель → снова ADB → вставить; вынуть флешку регистратора; "
                    "ребут громкость −; USB = передача данных."
                ),
                "warning": "",
                "stop_if": "",
            },
            {
                "order": 2,
                "title": "APK",
                "body": (
                    "Только лёгкие/подписанные сборки (cs35plus sign из темы).\n"
                    "Держать KillApps/cleaner. Предпочтительно AutoKit+Carlinkit / HUR для телефона."
                ),
                "warning": "",
                "stop_if": "",
            },
        ],
        force=force,
        category=G.APPS,
        risk_level=R.MEDIUM,
        verified=V.COMMUNITY,
        brick_warning="Следить за свободным местом после каждой установки.",
        file_manifest="[REQUIRED] Подписанные APK; [рекоменд.] AutoKit/HUR",
        sort_order=40,
        attachments=[
            {
                "title": "Коды ADB",
                "role": FR.DOC,
                "is_required": True,
                "filename": "cs35-adb-codes.txt",
                "content": "*#*#888\nпароль: 369875\n",
            },
            {
                "title": "Hackchan CS35",
                "role": FR.DOC,
                "external_url": "https://hackchan.ru/changan/cs35plusnew/",
            },
        ],
    )
    if ch:
        n += 1

    _, ch = upsert_guide(
        model,
        "CarPlay / Android Auto (предпочтительный путь)",
        "Меньше риска для памяти ГУ, чем нативный тяжёлый софт.",
        "https://4pda.to/forum/index.php?showtopic=1098045",
        [
            {
                "order": 1,
                "title": "Схема",
                "body": (
                    "iPhone: Carlinkit CCPA + AutoKit (подписанный).\n"
                    "Android: HUR / оболочка AA без лишних APK на ГУ.\n"
                    "Установка через ADB/сервис после включения отладки."
                ),
                "warning": "",
                "stop_if": "",
            }
        ],
        force=force,
        category=G.CARPLAY,
        risk_level=R.MEDIUM,
        verified=V.COMMUNITY,
        brick_warning="",
        file_manifest="[ ] AutoKit signed, [ ] HUR signed, [ ] донгл при необходимости",
        sort_order=50,
        attachments=[],
    )
    if ch:
        n += 1
    return n


class Command(BaseCommand):
    help = "Подробные разделы гайдов + манифесты файлов и анти-кирпич STOP"

    def add_arguments(self, parser):
        parser.add_argument("--no-force", action="store_true")

    def handle(self, *args, **options):
        force = not options["no_force"]
        geely = ensure_brand()
        coolray = ensure_model(
            geely,
            "coolray",
            "Coolray",
            "2018–2024 (дорест)",
            "Android 4.3 H30/H40/H50",
            "Разделы: идентификация → подготовка → сток → Community → CP/AA → откат.",
            10,
        )
        coolray_rest = ensure_model(
            geely,
            "coolray-rest",
            "Coolray Rest / SX11-A3",
            "2023–2025",
            "IHU715P / 516G / 535G",
            "Платформы несовместимы.",
            15,
        )
        coolray_2025 = ensure_model(
            geely,
            "coolray-2025",
            "Coolray Rest 2025 / New 2025",
            "2025+",
            "IHU624G Flyme",
            "Write MTK заблокирован до ясности unlock.",
            18,
        )

        total = 0
        total += seed_coolray_dorest(coolray, force)
        total += seed_coolray_rest_sections(coolray_rest, force)
        total += seed_coolray_2025(coolray_2025, force)
        total += seed_haval(force)
        total += seed_chery(force)
        total += seed_changan(force)
        self.stdout.write(self.style.SUCCESS(f"Detailed guides written/updated: {total}"))

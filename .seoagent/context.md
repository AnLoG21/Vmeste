# Business Context

- **Name:** Вместе (Vmeste / vsevmeste)
- **Type:** ONLINE-only
- **Audience:** Владельцы и администраторы малого и среднего сервисного бизнеса в РФ — салоны красоты, автосервисы, кафе, мастера с онлайн-записью; также команды, которым нужны чаты, маркетплейсы, CRM-lite и сайты в одной платформе
- **Industry:** SaaS / online booking & business automation (онлайн-запись, клиентский кабинет, коммуникации)
- **Location:** Россия (онлайн-сервис; юр./поддержка указаны с Москвой)
- **Description:** Вместе — облачная платформа для онлайн-записи клиентов и автоматизации бизнеса: каталог услуг, кабинет, чаты, уведомления, интеграции календарей и эквайринга; бесплатная запись без срока, тариф «Бизнес» 990 ₽/мес. Один аккаунт — несколько сервисов платформы (запись, маркетплейсы, Vsayte и др.).

# Facts

- Домен продакшена: https://vsevmeste.space — source: .env.production.example, live site
- Онлайн-запись бесплатно без срока — source: frontend/src/LandingPage.jsx (pricing lead), frontend/index.html meta description
- Тариф «Бизнес» — 990 ₽/мес (сотрудники и приоритетная поддержка) — source: frontend/src/LandingPage.jsx, frontend/index.html
- Перед оплатой можно ввести промокод — source: frontend/src/LandingPage.jsx
- Оплата через ЮKassa — source: frontend/src/LandingPage.jsx
- Публичная оферта: /offer — source: frontend/src/LandingPage.jsx
- Вместе — облачный SaaS, физическая доставка не производится — source: frontend/src/LandingPage.jsx
- Email поддержки: vmesteofficialsupport@gmail.com — source: frontend/index.html JSON-LD
- Телефон поддержки: +7-967-074-46-76 — source: frontend/index.html JSON-LD
- Язык интерфейса/SEO: русский — source: frontend/index.html lang="ru"
- Yandex verification meta присутствует — source: frontend/index.html
- Интеграции (исходящие): Telegram, SMS, WhatsApp (Green-API), MAX, Google/Яндекс Календарь, эквайринг, push — source: frontend/src/LandingPage.jsx
- Отдельные пакеты минут SpeechKit / голосовой ассистент — source: frontend/src/LandingPage.jsx
- Поддомен конструктора сайтов: vsayte.vsevmeste.space — source: backend/config/settings.py VSAYTE_BASE_DOMAIN

# Writing Instructions

- Писать по-русски, конкретно, без англоязычного SaaS-жаргона ради жаргона
- Бренд в тексте: «Вместе»; домен/латиница — «vsevmeste» / vsevmeste.space где нужна узнаваемость в поиске
- Не обещать входящий WhatsApp/Telegram-чат, если продукт даёт только исходящие алерты (см. LandingPage integrations)
- Цены и тарифы только из Facts; не выдумывать планы
- Целевые запросы: онлайн-запись, запись клиентов онлайн, CRM для салона / автосервиса / кафе (по сценариям лендинга)

# Reference URLs

- https://vsevmeste.space/
- https://vsevmeste.space/#pricing
- https://vsevmeste.space/offer

# Topics to Avoid

- Сравнения с конкурентами без проверяемых фактов
- Обещания «полного WhatsApp/Telegram мессенджера» внутри Вместе
- Медицинские/юридические гарантии результата SEO или «гарантированный трафик»
- Выдуманные отзывы, цифры клиентов, кейсы без источника

# Content Tone

professional

# Additional Notes

Платформа шире одной «записи»: в экосистеме есть маркетплейсы, Vsayte и другие сервисы под одним аккаунтом. Для SEO приоритет — коммерческие запросы по онлайн-записи и автоматизации малого бизнеса в РФ; бренд «Вместе» / vsevmeste слабо известен в поиске, поэтому нужны посадочные под intent + техническая индексация.

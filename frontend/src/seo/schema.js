/** Shared SEO / Schema.org helpers for Yandex & Google. */

export const SITE_ORIGIN = "https://vsevmeste.space";
export const OG_IMAGE = `${SITE_ORIGIN}/og-cover.png`;

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "Вместе",
    alternateName: ["Vmeste", "vsevmeste"],
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.png`,
    image: OG_IMAGE,
    email: "vmesteofficialsupport@gmail.com",
    telephone: "+7-967-074-46-76",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Москва",
      addressCountry: "RU",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: "+7-967-074-46-76",
        contactType: "customer support",
        email: "vmesteofficialsupport@gmail.com",
        availableLanguage: ["Russian"],
      },
    ],
    sameAs: [SITE_ORIGIN],
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: "Вместе",
    url: SITE_ORIGIN,
    inLanguage: "ru-RU",
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

export function softwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Вместе",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    url: SITE_ORIGIN,
    image: OG_IMAGE,
    description:
      "Платформа для онлайн-записи клиентов, каталога услуг, чатов и карты организаций.",
    offers: [
      {
        "@type": "Offer",
        name: "Бесплатный",
        price: "0",
        priceCurrency: "RUB",
        description: "Онлайн-запись, каталог, чаты и карта без ограничения по сроку",
        url: `${SITE_ORIGIN}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "Бизнес",
        price: "990",
        priceCurrency: "RUB",
        description: "Сотрудники, аналитика и приоритетная поддержка",
        url: `${SITE_ORIGIN}/#pricing`,
      },
    ],
    provider: { "@id": `${SITE_ORIGIN}/#organization` },
  };
}

/**
 * @param {{ name: string, path: string }[]} crumbs Absolute path from site root, e.g. "/contacts"
 */
export function breadcrumbListJsonLd(crumbs) {
  const itemListElement = (crumbs || []).map((c, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: c.name,
    item: c.path.startsWith("http") ? c.path : `${SITE_ORIGIN}${c.path === "/" ? "/" : c.path}`,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement,
  };
}

/** @param {{ question: string, answer: string }[]} items */
export function faqPageJsonLd(items) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: (items || []).map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export const HOME_FAQ = [
  {
    question: "Что такое Вместе?",
    answer:
      "Вместе — облачная платформа (SaaS) для онлайн-записи клиентов, каталога услуг, чатов и карты организаций. Подходит салонам красоты, автосервисам, кафе и другим сервисным бизнесам.",
  },
  {
    question: "Чем вы отличаетесь от Yclients, Dikidi и других аналогов?",
    answer:
      "Фокус на простом запуске и честной цене: бесплатный тариф без срока для записи и базового кабинета, «Бизнес» — 990 ₽/мес за сотрудников, аналитику и приоритетную поддержку. Есть карта организаций для привлечения клиентов, встроенные чаты, роли сотрудников, аналитика и сценарий кафе (зал, QR, меню). Сложные интеграции и отраслевые доработки — через индивидуальную автоматизацию, без навязанного «пакета на всё».",
  },
  {
    question: "Можно ли работать со смартфона?",
    answer:
      "Да. Веб-версия адаптирована под мобильные браузеры, есть Android-приложение с push-уведомлениями. Кабинет мастера и запись клиента удобны с телефона.",
  },
  {
    question: "Как работает гео-поиск для клиентов?",
    answer:
      "Клиенты открывают карту, фильтруют организации по сфере и находят вас рядом. Дополнительно можно делиться прямой ссылкой на профиль и запись — для соцсетей и мессенджеров.",
  },
  {
    question: "Сколько стоит подписка?",
    answer:
      "Тариф «Бесплатный» — онлайн-запись, каталог, чаты и карта без ограничения по сроку. Тариф «Бизнес» — 990 ₽ в месяц: сотрудники, аналитика и приоритетная поддержка. Есть индивидуальная автоматизация по заявке.",
  },
  {
    question: "Как начать пользоваться?",
    answer:
      "Зарегистрируйтесь на сайте, подтвердите email — базовый доступ по бесплатному тарифу доступен сразу. При необходимости оплатите «Бизнес» через ЮKassa в разделе «Подписки». Базовый запуск: услуги → график → ссылка клиентам.",
  },
  {
    question: "Для каких бизнесов подходит сервис?",
    answer:
      "Уже есть готовые сценарии для салонов красоты, автосервисов (VIN, приёмка, статусы ремонта), кафе/ресторанов и продавцов маркетплейсов (Ozon и Wildberries). Другие сферы можно подключить через индивидуальную автоматизацию.",
  },
  {
    question: "Есть ли живое демо?",
    answer:
      "Да. На главной выберите сферу (салон, автосервис, кафе или маркетплейсы) и войдите в общий кабинет. Можно всё потыкать. При выходе из демо ваши новые данные удаляются, исходные остаются.",
  },
  {
    question: "Как клиент узнаёт, что запись подтверждена?",
    answer:
      "Сейчас — в личном кабинете, в чате с организацией и push в Android-приложении. SMS, Telegram-бот и WhatsApp — в подключении. Google Календарь и Яндекс Календарь синхронизируются отдельно, также в подключении.",
  },
  {
    question: "Есть ли предоплата и защита от неприходов?",
    answer:
      "Для кафе доступна онлайн-оплата заказов через ЮKassa организации. Защита от неприходов: в кабинете организации включается частичная или полная предоплата при записи — клиент оплачивает через ЮKassa, слот держится 10 минут.",
  },
];

export function toJsonLdScript(data) {
  return JSON.stringify(data);
}

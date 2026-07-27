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
        name: "Старт",
        price: "0",
        priceCurrency: "RUB",
        description: "Бесплатная неделя полного доступа (один раз)",
        url: `${SITE_ORIGIN}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "Бизнес",
        price: "990",
        priceCurrency: "RUB",
        description: "Полный функционал платформы",
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
      "Вместе — облачная платформа (SaaS) для онлайн-записи клиентов, каталога услуг, чатов и карты организаций. Подходит салонам красоты, сервисным центрам и другим сервисным бизнесам.",
  },
  {
    question: "Сколько стоит подписка?",
    answer:
      "Тариф «Старт» — бесплатная неделя полного доступа один раз. Тариф «Бизнес» — 990 ₽ в месяц. Есть индивидуальная автоматизация по заявке.",
  },
  {
    question: "Как начать пользоваться?",
    answer:
      "Зарегистрируйтесь на сайте, подтвердите email, активируйте «Старт» или оплатите «Бизнес» через ЮKassa в разделе «Подписки». Доступ появляется сразу после активации.",
  },
  {
    question: "Для каких бизнесов подходит сервис?",
    answer:
      "Уже есть готовые сценарии для салонов красоты и сервисных центров. Другие сферы можно подключить через индивидуальную автоматизацию.",
  },
];

export function toJsonLdScript(data) {
  return JSON.stringify(data);
}

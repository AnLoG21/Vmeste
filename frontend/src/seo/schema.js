/** Shared SEO / Schema.org helpers for Yandex & Google. */

export const SITE_ORIGIN = "https://vsevmeste.space";

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: "Вместе",
    alternateName: ["Vmeste", "vsevmeste"],
    url: SITE_ORIGIN,
    logo: `${SITE_ORIGIN}/favicon.png`,
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
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_ORIGIN}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
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
    description:
      "Платформа для онлайн-записи клиентов, каталога услуг, чатов и карты организаций.",
    offers: [
      {
        "@type": "Offer",
        name: "Старт",
        price: "990",
        priceCurrency: "RUB",
        url: `${SITE_ORIGIN}/#pricing`,
      },
      {
        "@type": "Offer",
        name: "Бизнес",
        price: "2990",
        priceCurrency: "RUB",
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

export function toJsonLdScript(data) {
  return JSON.stringify(data);
}

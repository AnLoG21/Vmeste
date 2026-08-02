import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";
import JsonLd from "../seo/JsonLd.jsx";
import { SITE_ORIGIN, breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import "../landing.css";

function localBusinessJsonLd(org) {
  const type =
    org.provider_sphere === "cafe_restaurant"
      ? "Restaurant"
      : org.provider_sphere === "hair_salon"
        ? "BeautySalon"
        : "LocalBusiness";
  const hours = org.working_hours || {};
  const dayMap = {
    mon: "Monday",
    tue: "Tuesday",
    wed: "Wednesday",
    thu: "Thursday",
    fri: "Friday",
    sat: "Saturday",
    sun: "Sunday",
  };
  const openingHoursSpecification = Object.entries(dayMap)
    .map(([key, day]) => {
      const row = hours[key] || {};
      if (row.closed || !row.open || !row.close) return null;
      return {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: day,
        opens: row.open,
        closes: row.close,
      };
    })
    .filter(Boolean);

  const entity = {
    "@context": "https://schema.org",
    "@type": type,
    name: org.organization_name,
    url: `${SITE_ORIGIN}/o/${org.slug}`,
    description:
      org.card_note ||
      `${org.organization_name} — ${org.sphere_label || "организация"} на платформе Вместе`,
    telephone: org.phones?.[0] || undefined,
    image: org.gallery_photos?.[0]?.url || undefined,
    sameAs: org.websites?.length ? org.websites : undefined,
    openingHoursSpecification: openingHoursSpecification.length ? openingHoursSpecification : undefined,
    aggregateRating:
      org.average_rating && org.reviews_count
        ? {
            "@type": "AggregateRating",
            ratingValue: org.average_rating,
            reviewCount: org.reviews_count,
          }
        : undefined,
  };
  if (org.organization_address) {
    entity.address = {
      "@type": "PostalAddress",
      streetAddress: org.organization_address,
      addressCountry: "RU",
    };
  }
  if (org.organization_latitude != null && org.organization_longitude != null) {
    entity.geo = {
      "@type": "GeoCoordinates",
      latitude: org.organization_latitude,
      longitude: org.organization_longitude,
    };
  }
  return entity;
}

export default function PublicOrgPage({ slug }) {
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    fetch(`${API_URL}/users/public-org/${encodeURIComponent(slug)}/`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.detail || "Не найдено");
        if (!cancelled) setOrg(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Ошибка загрузки");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!error) return;
    setPageMeta({
      title: "Организация не найдена — Вместе",
      description: "Такой организации нет на платформе Вместе.",
      path: `/o/${slug}`,
      robots: "noindex,nofollow",
    });
  }, [error, slug]);

  useEffect(() => {
    if (!org) return;
    const og = org.gallery_photos?.[0]?.url;
    setPageMeta({
      title: `${org.organization_name} — ${org.sphere_label || "Вместе"}`,
      description:
        org.card_note ||
        `${org.organization_name}${org.organization_address ? `, ${org.organization_address}` : ""}. Онлайн на Вместе.`,
      path: `/o/${org.slug}`,
      robots: "index,follow",
      image: og || undefined,
      imageAlt: org.organization_name,
    });
  }, [org]);

  const jsonLd = useMemo(() => {
    if (!org) return null;
    return [
      organizationJsonLd(),
      breadcrumbListJsonLd([
        { name: "Главная", path: "/" },
        { name: "Организации", path: "/businesses" },
        { name: org.organization_name, path: `/o/${org.slug}` },
      ]),
      localBusinessJsonLd(org),
    ];
  }, [org]);

  if (error) {
    return (
      <div className="landing legal-page">
        <main className="legal-page-body">
          <h1>Организация не найдена</h1>
          <p>{error}</p>
          <a href="/">На главную</a>
        </main>
      </div>
    );
  }

  if (!org) {
    return (
      <div className="landing legal-page">
        <main className="legal-page-body">
          <p>Загрузка…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="landing legal-page public-org-page">
      {jsonLd ? <JsonLd id="vmeste-public-org-jsonld" data={jsonLd} /> : null}
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <p className="muted">{org.sphere_label}</p>
        <h1>{org.organization_name}</h1>
        {org.average_rating != null ? (
          <p>
            ★ {org.average_rating} · {org.reviews_count} отзывов
          </p>
        ) : null}
      </header>
      <article className="legal-page-body">
        {org.organization_address ? <p>{org.organization_address}</p> : null}
        {org.card_note ? <p>{org.card_note}</p> : null}
        {org.phones?.length ? (
          <p>
            Тел.:{" "}
            {org.phones.map((ph) => (
              <a key={ph} href={`tel:${ph.replace(/[^\d+]/g, "")}`} style={{ marginRight: 8 }}>
                {ph}
              </a>
            ))}
          </p>
        ) : null}
        {org.gallery_photos?.length ? (
          <div className="public-org-gallery">
            {org.gallery_photos.map((p, i) => (
              <img
                key={p.id}
                src={p.url}
                alt={`${org.organization_name} — фото ${i + 1}`}
                width={280}
                height={200}
                loading="lazy"
              />
            ))}
          </div>
        ) : null}
        <div className="landing-hero-actions" style={{ marginTop: 24 }}>
          {org.is_cafe ? (
            <a className="landing-btn landing-btn--primary" href={`/m/${org.slug}`}>
              Открыть меню
            </a>
          ) : (
            <a className="landing-btn landing-btn--primary" href="/businesses">
              Онлайн-запись на Вместе
            </a>
          )}
          <a className="landing-btn landing-btn--outline" href="/">
            О платформе Вместе
          </a>
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          <a href="/city/moscow">Москва</a> · <a href="/city/spb">Санкт-Петербург</a> ·{" "}
          <a href="/businesses">Для бизнеса</a>
        </p>
      </article>
    </div>
  );
}

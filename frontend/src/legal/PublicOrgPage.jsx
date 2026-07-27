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
  return {
    "@context": "https://schema.org",
    "@type": type,
    name: org.organization_name,
    url: `${SITE_ORIGIN}/o/${org.slug}`,
    description: org.card_note || `${org.organization_name} — ${org.sphere_label || "организация"} на платформе Вместе`,
    address: org.organization_address
      ? { "@type": "PostalAddress", streetAddress: org.organization_address, addressCountry: "RU" }
      : undefined,
    telephone: org.phones?.[0] || undefined,
    image: org.gallery_photos?.[0]?.url || undefined,
    aggregateRating:
      org.average_rating && org.reviews_count
        ? {
            "@type": "AggregateRating",
            ratingValue: org.average_rating,
            reviewCount: org.reviews_count,
          }
        : undefined,
  };
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
    if (!org) return;
    setPageMeta({
      title: `${org.organization_name} — ${org.sphere_label || "Вместе"}`,
      description:
        org.card_note ||
        `${org.organization_name}${org.organization_address ? `, ${org.organization_address}` : ""}. Онлайн на Вместе.`,
      path: `/o/${org.slug}`,
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
            {org.gallery_photos.map((p) => (
              <img key={p.id} src={p.url} alt="" loading="lazy" />
            ))}
          </div>
        ) : null}
        <div className="landing-hero-actions" style={{ marginTop: 24 }}>
          {org.is_cafe ? (
            <a className="landing-btn landing-btn--primary" href={`/m/${org.slug}`}>
              Открыть меню
            </a>
          ) : (
            <a className="landing-btn landing-btn--primary" href="/map">
              Записаться на карте
            </a>
          )}
          <a className="landing-btn landing-btn--outline" href="/">
            О платформе Вместе
          </a>
        </div>
      </article>
    </div>
  );
}

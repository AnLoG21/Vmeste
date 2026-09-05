import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd, SITE_ORIGIN } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import { getCitySeo } from "../seo/citySeo.js";
import NotFoundPage from "./NotFoundPage.jsx";
import "../landing.css";

export default function CityPage({ cityKey }) {
  const seo = getCitySeo(cityKey);
  const [orgs, setOrgs] = useState([]);
  const [status, setStatus] = useState("Загрузка…");

  useEffect(() => {
    if (!seo) return;
    setPageMeta({
      title: seo.metaTitle,
      description: seo.metaDescription,
      path: `/city/${cityKey}`,
      robots: "index,follow",
    });
    fetch(`${API_URL}/users/public-orgs/`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.organizations) ? data.organizations : [];
        setOrgs(list);
        setStatus(list.length ? "" : "Пока нет опубликованных организаций.");
      })
      .catch(() => setStatus("Не удалось загрузить список."));
  }, [cityKey, seo]);

  const filtered = useMemo(() => {
    if (!seo) return [];
    const aliases = (seo.aliases || []).map((a) => String(a).toLowerCase());
    return orgs.filter((o) => {
      const addr = String(o.address || "").toLowerCase();
      return aliases.some((a) => addr.includes(a));
    });
  }, [orgs, seo]);

  const jsonLd = useMemo(() => {
    if (!seo) return null;
    return [
      organizationJsonLd(),
      breadcrumbListJsonLd([
        { name: "Главная", path: "/" },
        { name: "Для бизнеса", path: "/businesses" },
        { name: seo.title, path: `/city/${cityKey}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Вместе · ${seo.title}`,
        description: seo.metaDescription,
        url: `${SITE_ORIGIN}/city/${cityKey}`,
        about: seo.title,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: (seo.faqs || []).map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
    ];
  }, [seo, cityKey]);

  if (!seo) {
    return <NotFoundPage />;
  }

  return (
    <div className="landing legal-page">
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <h1>Вместе · {seo.title}</h1>
        <p className="muted">{seo.intro}</p>
        <p>
          <a className="landing-btn landing-btn--primary" href={`/map?city=${cityKey}`}>
            Открыть на карте
          </a>
        </p>
      </header>
      <article className="legal-page-body">
        <h2>Что доступно в городе</h2>
        <ul>
          {(seo.bullets || []).map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>

        <h2>Организации</h2>
        {status ? <p>{status}</p> : null}
        {!status && !filtered.length ? (
          <p className="muted">Пока нет организаций с адресом в городе {seo.title}.</p>
        ) : null}
        <ul>
          {filtered.map((o) => (
            <li key={o.slug}>
              <a href={`/o/${o.slug}`}>{o.name}</a>
              {o.sphere ? ` · ${o.sphere}` : ""}
              {o.menu_url ? (
                <>
                  {" · "}
                  <a href={o.menu_url}>меню</a>
                </>
              ) : null}
            </li>
          ))}
        </ul>

        {(seo.faqs || []).length ? (
          <section className="businesses-faq" aria-label="Частые вопросы">
            <h2>Частые вопросы</h2>
            {seo.faqs.map((item) => (
              <details key={item.q} className="landing-faq-item">
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </section>
        ) : null}

        <p>
          <a href="/businesses">Все сферы</a> · <a href="/city/moscow">Москва</a> ·{" "}
          <a href="/city/spb">Санкт-Петербург</a>
        </p>
      </article>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd, SITE_ORIGIN } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import { CITY_LIST, getCitySeo } from "../seo/citySeo.js";
import NotFoundPage from "./NotFoundPage.jsx";
import "../landing.css";

function normalizeCitySeo(raw, fallbackKey) {
  if (!raw) return null;
  return {
    title: raw.title || "",
    aliases: raw.aliases || [],
    metaTitle: raw.metaTitle || raw.meta_title || "",
    metaDescription: raw.metaDescription || raw.meta_description || "",
    intro: raw.intro || "",
    bullets: raw.bullets || [],
    faqs: raw.faqs || [],
    key: raw.key || fallbackKey,
  };
}

export default function CityPage({ cityKey }) {
  const localFallback = getCitySeo(cityKey);
  const [seo, setSeo] = useState(() => normalizeCitySeo(localFallback, cityKey));
  const [orgs, setOrgs] = useState([]);
  const [status, setStatus] = useState("Загрузка…");
  const [seoReady, setSeoReady] = useState(Boolean(localFallback));

  useEffect(() => {
    let cancelled = false;
    setSeoReady(false);
    setSeo(normalizeCitySeo(getCitySeo(cityKey), cityKey));

    (async () => {
      try {
        const res = await fetch(`${API_URL}/users/city-seo/${encodeURIComponent(cityKey)}/`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.ok && data) {
          setSeo(normalizeCitySeo(data, cityKey));
          setSeoReady(true);
          return;
        }
      } catch {
        /* fallback below */
      }
      if (!cancelled) {
        const fb = getCitySeo(cityKey);
        setSeo(normalizeCitySeo(fb, cityKey));
        setSeoReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cityKey]);

  useEffect(() => {
    if (!seo) return;
    setPageMeta({
      title: seo.metaTitle,
      description: seo.metaDescription,
      path: `/city/${cityKey}`,
      robots: "index,follow",
    });
    let cancelled = false;
    fetch(`${API_URL}/users/public-orgs/`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        const list = Array.isArray(data.organizations) ? data.organizations : [];
        setOrgs(list);
        setStatus(list.length ? "" : "Пока нет опубликованных организаций.");
      })
      .catch(() => {
        if (!cancelled) setStatus("Не удалось загрузить список.");
      });
    return () => {
      cancelled = true;
    };
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

  if (seoReady && !seo) {
    return <NotFoundPage />;
  }

  if (!seo) {
    return (
      <div className="landing legal-page">
        <main className="legal-page-body">
          <p className="muted">Загрузка…</p>
        </main>
      </div>
    );
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
          <a href="/businesses">Все сферы</a> · <a href="/blog">Блог</a>
          {CITY_LIST.map((c) => (
            <span key={c.key}>
              {" "}
              · <a href={`/city/${c.key}`}>{c.title}</a>
            </span>
          ))}
        </p>
      </article>
    </div>
  );
}

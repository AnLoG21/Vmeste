import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd, SITE_ORIGIN } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import NotFoundPage from "./NotFoundPage.jsx";
import "../landing.css";

const CITY_META = {
  moscow: { title: "Москва", aliases: ["москва", "moscow"] },
  spb: { title: "Санкт-Петербург", aliases: ["санкт-петербург", "петербург", "спб", "saint petersburg"] },
};

export default function CityPage({ cityKey }) {
  const meta = CITY_META[cityKey];
  const [orgs, setOrgs] = useState([]);
  const [status, setStatus] = useState("Загрузка…");

  useEffect(() => {
    if (!meta) return;
    setPageMeta({
      title: `Вместе в городе ${meta.title} — онлайн-запись и кафе`,
      description: `Организации на платформе Вместе в городе ${meta.title}: запись, меню, контакты.`,
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
  }, [cityKey, meta]);

  const filtered = useMemo(() => {
    if (!meta) return [];
    const aliases = (meta.aliases || []).map((a) => String(a).toLowerCase());
    return orgs.filter((o) => {
      const addr = String(o.address || "").toLowerCase();
      return aliases.some((a) => addr.includes(a));
    });
  }, [orgs, meta]);

  const jsonLd = useMemo(() => {
    if (!meta) return null;
    return [
      organizationJsonLd(),
      breadcrumbListJsonLd([
        { name: "Главная", path: "/" },
        { name: "Для бизнеса", path: "/businesses" },
        { name: meta.title, path: `/city/${cityKey}` },
      ]),
      {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: `Вместе · ${meta.title}`,
        url: `${SITE_ORIGIN}/city/${cityKey}`,
        about: meta.title,
        isPartOf: { "@id": `${SITE_ORIGIN}/#website` },
      },
    ];
  }, [meta, cityKey]);

  if (!meta) {
    return <NotFoundPage />;
  }

  return (
    <div className="landing legal-page">
      {jsonLd ? <JsonLd data={jsonLd} /> : null}
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <h1>Вместе · {meta.title}</h1>
        <p className="muted">Организации с адресом в этом городе.</p>
        <p>
          <a className="landing-btn landing-btn--primary" href={`/map?city=${cityKey}`}>
            Открыть на карте
          </a>
        </p>
      </header>
      <article className="legal-page-body">
        {status ? <p>{status}</p> : null}
        {!status && !filtered.length ? (
          <p className="muted">Пока нет организаций с адресом в городе {meta.title}.</p>
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
        <p>
          <a href="/businesses">Все сферы</a> · <a href="/city/moscow">Москва</a> · <a href="/city/spb">Санкт-Петербург</a>
        </p>
      </article>
    </div>
  );
}

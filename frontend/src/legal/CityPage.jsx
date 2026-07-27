import { useEffect, useMemo, useState } from "react";
import { API_URL } from "../config.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import "../landing.css";

const CITY_META = {
  moscow: { title: "Москва", aliases: ["москва", "moscow"] },
  spb: { title: "Санкт-Петербург", aliases: ["санкт-петербург", "петербург", "спб", "saint petersburg"] },
};

export default function CityPage({ cityKey }) {
  const meta = CITY_META[cityKey] || { title: cityKey, aliases: [cityKey] };
  const [orgs, setOrgs] = useState([]);
  const [status, setStatus] = useState("Загрузка…");

  useEffect(() => {
    setPageMeta({
      title: `Вместе в городе ${meta.title} — онлайн-запись и кафе`,
      description: `Организации на платформе Вместе в городе ${meta.title}.`,
      path: `/city/${cityKey}`,
    });
    fetch(`${API_URL}/users/public-orgs/`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data.organizations) ? data.organizations : [];
        setOrgs(list);
        setStatus(list.length ? "" : "Пока нет опубликованных организаций.");
      })
      .catch(() => setStatus("Не удалось загрузить список."));
  }, [cityKey, meta.title]);

  const filtered = useMemo(() => {
    const aliases = (meta.aliases || []).map((a) => String(a).toLowerCase());
    const matched = orgs.filter((o) => {
      const addr = String(o.address || "").toLowerCase();
      return aliases.some((a) => addr.includes(a));
    });
    return matched.length ? matched : orgs;
  }, [orgs, meta.aliases]);

  const usingFallback = filtered === orgs && orgs.length > 0;

  return (
    <div className="landing legal-page">
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <h1>Вместе · {meta.title}</h1>
        <p className="muted">
          {usingFallback
            ? "Пока мало адресов с этим городом — показываем все организации на платформе."
            : "Организации с адресом в этом городе."}
        </p>
      </header>
      <article className="legal-page-body">
        {status ? <p>{status}</p> : null}
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

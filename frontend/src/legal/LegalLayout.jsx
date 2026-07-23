import { useMemo } from "react";
import { SITE_LEGAL } from "./siteLegal.js";
import Breadcrumbs from "../seo/Breadcrumbs.jsx";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";

export default function LegalLayout({ title, path, children }) {
  const crumbs = useMemo(
    () => [
      { name: "Главная", href: "/", path: "/" },
      { name: title, path: path || "/" },
    ],
    [title, path]
  );

  const jsonLd = useMemo(
    () => [
      organizationJsonLd(),
      breadcrumbListJsonLd(crumbs.map((c) => ({ name: c.name, path: c.path }))),
    ],
    [crumbs]
  );

  return (
    <div className="landing legal-page">
      <JsonLd id="vmeste-legal-jsonld" data={jsonLd} />
      <header className="legal-page-header">
        <Breadcrumbs
          items={[
            { name: "Главная", href: "/" },
            { name: title },
          ]}
        />
        <a href="/" className="legal-page-home">
          ← {SITE_LEGAL.serviceName}
        </a>
        <h1>{title}</h1>
      </header>
      <article className="legal-page-body">{children}</article>
      <footer className="landing-footer legal-page-footer">
        <p>
          {SITE_LEGAL.serviceName} · ИНН {SITE_LEGAL.inn} ·{" "}
          <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>
        </p>
        <nav className="landing-footer-nav" aria-label="Разделы сайта">
          <a href="/">Главная</a>
          <a href="/#pricing">Тарифы</a>
          <a href="/contacts">Контакты</a>
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика конфиденциальности</a>
        </nav>
      </footer>
    </div>
  );
}

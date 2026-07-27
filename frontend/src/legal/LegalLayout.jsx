import { useEffect, useMemo } from "react";
import { SITE_LEGAL } from "./siteLegal.js";
import Breadcrumbs from "../seo/Breadcrumbs.jsx";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";

const PAGE_META = {
  "/offer": {
    title: "Публичная оферта — Вместе",
    description: "Публичная оферта сервиса Вместе: условия подписки, тарифы, порядок оказания услуг.",
  },
  "/privacy": {
    title: "Политика конфиденциальности — Вместе",
    description: "Политика конфиденциальности сервиса Вместе: обработка персональных данных пользователей.",
  },
  "/contacts": {
    title: "Контакты и реквизиты — Вместе",
    description: "Контакты и реквизиты сервиса Вместе: самозанятый Логинов А.А., ИНН 971500759750, Москва.",
  },
  "/businesses": {
    title: "Для бизнеса — онлайн-запись для салонов и сервисов | Вместе",
    description:
      "Вместе для салонов красоты и сервисных центров: готовые каталоги услуг, онлайн-запись, чаты, сотрудники и карта.",
  },
};

export default function LegalLayout({ title, path, description, children }) {
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

  useEffect(() => {
    const preset = PAGE_META[path] || {};
    setPageMeta({
      title: preset.title || `${title} — Вместе`,
      description: description || preset.description || `${title} — сервис Вместе.`,
      path: path || "/",
    });
  }, [title, path, description]);

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
          <a href="/businesses">Для бизнеса</a>
          <a href="/#pricing">Тарифы</a>
          <a href="/contacts">Контакты</a>
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика конфиденциальности</a>
        </nav>
      </footer>
    </div>
  );
}

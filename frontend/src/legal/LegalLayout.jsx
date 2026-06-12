import { SITE_LEGAL } from "./siteLegal.js";

export default function LegalLayout({ title, children }) {
  return (
    <div className="landing legal-page">
      <header className="legal-page-header">
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
        <nav className="landing-footer-nav" aria-label="Юридические документы">
          <a href="/offer">Публичная оферта</a>
          <a href="/privacy">Политика конфиденциальности</a>
          <a href="/contacts">Контакты и реквизиты</a>
        </nav>
      </footer>
    </div>
  );
}

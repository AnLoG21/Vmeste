import { useEffect } from "react";
import { setPageMeta } from "../seo/setPageMeta.js";
import "../landing.css";

/** Клиентская 404 (когда SPA всё же открылась на неизвестном пути). */
export default function NotFoundPage() {
  useEffect(() => {
    setPageMeta({
      title: "Страница не найдена — Вместе",
      description: "Запрашиваемая страница не существует на сайте Вместе.",
      path: window.location.pathname,
      robots: "noindex,nofollow",
    });
  }, []);

  return (
    <div className="landing legal-page">
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <h1>404 — Страница не найдена</h1>
        <p className="muted">Такой страницы нет. Проверьте адрес или вернитесь на главную.</p>
      </header>
      <article className="legal-page-body">
        <p>
          <a href="/">На главную</a> · <a href="/businesses">Для бизнеса</a> · <a href="/contacts">Контакты</a> ·{" "}
          <a href="/city/moscow">Москва</a> · <a href="/city/spb">Санкт-Петербург</a>
        </p>
      </article>
    </div>
  );
}

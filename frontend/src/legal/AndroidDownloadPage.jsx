import { useEffect } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";

/** Public install page for Capacitor Android APK (not PWA). */
export default function AndroidDownloadPage() {
  useEffect(() => {
    setPageMeta({
      title: "Скачать Android-приложение Вместе — push и виджет",
      description:
        "APK Вместе для Android: системные push-уведомления и виджет записей. Ярлык сайта в браузере (PWA) их не даёт.",
      path: "/android",
    });
  }, []);

  const apkUrl = "/downloads/vmeste-android.apk";

  return (
    <div className="landing legal-page">
      <JsonLd
        id="vmeste-android-jsonld"
        data={[
          organizationJsonLd(),
          breadcrumbListJsonLd([
            { name: "Главная", path: "/" },
            { name: "Android", path: "/android" },
          ]),
        ]}
      />
      <header className="legal-page-header">
        <a href="/" className="legal-page-home">
          ← Вместе
        </a>
        <h1>Приложение для Android</h1>
        <p className="landing-hero-lead">
          Настоящий APK (Capacitor): push-уведомления и виджет «сегодня / ближайшая запись». Установка «на экран
          Домой» из Chrome — это ярлык сайта, без виджета и системных push.
        </p>
      </header>
      <main className="legal-page-body">
        <p>
          <a className="landing-btn landing-btn--primary" href={apkUrl} download>
            Скачать APK
          </a>
        </p>
        <p className="muted small">
          Файл: <code>{apkUrl}</code>. Если ссылка 404 — положите свежий{" "}
          <code>app-debug.apk</code> / release APK на сервер в эту путь (см. docs/MOBILE-ANDROID.md).
        </p>
        <h2>Как установить</h2>
        <ol>
          <li>Скачайте APK на телефон.</li>
          <li>Разрешите установку из этого источника (файлы / браузер).</li>
          <li>Откройте приложение, войдите в аккаунт, разрешите уведомления.</li>
          <li>Виджет: долгий тап по пустому месту на рабочем столе → Виджеты → Вместе.</li>
        </ol>
        <h2>Google Play</h2>
        <p className="muted">
          Публикация в Play — после аккаунта разработчика Google. Пока раздаём APK напрямую.
        </p>
        <p>
          <a href="/apps">Сервисы платформы</a> · <a href="/businesses">Для бизнеса</a>
        </p>
      </main>
      <footer className="landing-footer">
        <p>
          {SITE_LEGAL.serviceName} · <a href={`mailto:${SITE_LEGAL.email}`}>{SITE_LEGAL.email}</a>
        </p>
      </footer>
    </div>
  );
}

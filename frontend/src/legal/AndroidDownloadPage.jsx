import { useEffect, useState } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";

const APK_URL = "/downloads/vmeste-android.apk";

/** Public install page: native APK vs browser home-screen shortcut. */
export default function AndroidDownloadPage() {
  const [apkReady, setApkReady] = useState(null);

  useEffect(() => {
    setPageMeta({
      title: "Скачать Android-приложение Вместе — не ярлык браузера",
      description:
        "APK Вместе: системные push и виджет записей. Ярлык «На экран Домой» из Chrome — это сайт, не приложение.",
      path: "/android",
    });
    let cancelled = false;
    fetch(APK_URL, { method: "HEAD", cache: "no-store" })
      .then((r) => {
        if (!cancelled) setApkReady(r.ok);
      })
      .catch(() => {
        if (!cancelled) setApkReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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
          Два разных способа «поставить на телефон». Путают часто: ярлык браузера выглядит как иконка,
          но это всё ещё сайт.
        </p>
      </header>
      <main className="legal-page-body">
        <div className="android-compare" role="list">
          <article className="android-compare-card android-compare-card--app" role="listitem">
            <h2>Приложение (APK)</h2>
            <ul>
              <li>Системные push-уведомления</li>
              <li>Виджет «сегодня / ближайшая запись»</li>
              <li>Отдельный значок Вместе</li>
            </ul>
            {apkReady === false ? (
              <p className="status">Файл APK на сервере пока недоступен — напишите на {SITE_LEGAL.email}.</p>
            ) : (
              <p>
                <a
                  className="landing-btn landing-btn--primary"
                  href={APK_URL}
                  download={apkReady ? "vmeste-android.apk" : undefined}
                  aria-disabled={apkReady === null ? true : undefined}
                >
                  {apkReady === null ? "Проверяем файл…" : "Скачать APK"}
                </a>
              </p>
            )}
          </article>
          <article className="android-compare-card android-compare-card--pwa" role="listitem">
            <h2>Ярлык браузера (PWA)</h2>
            <ul>
              <li>«Добавить на экран Домой» в Chrome</li>
              <li>Открывает сайт во весь экран</li>
              <li>Без системных push и без виджета</li>
            </ul>
            <p className="muted small">Удобно для быстрого входа, но это не приложение из APK.</p>
          </article>
        </div>

        <h2>Как установить APK</h2>
        <ol>
          <li>Скачайте файл на телефон.</li>
          <li>Разрешите установку из браузера / «Файлы» (неизвестный источник).</li>
          <li>Откройте Вместе, войдите, разрешите уведомления.</li>
          <li>Виджет: долгий тап по рабочему столу → Виджеты → Вместе.</li>
        </ol>

        <h2>Google Play</h2>
        <p className="muted">Пока раздаём APK напрямую. Публикация в Play — после аккаунта разработчика.</p>
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

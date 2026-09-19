import { useEffect, useState } from "react";
import "../landing.css";
import { SITE_LEGAL } from "./siteLegal.js";
import JsonLd from "../seo/JsonLd.jsx";
import { breadcrumbListJsonLd, organizationJsonLd } from "../seo/schema.js";
import { setPageMeta } from "../seo/setPageMeta.js";
import { ANDROID_APK_URL, RUSTORE_APP_URL, rustoreQrUrl } from "../mobileStores.js";

/** Public install page: RuStore first, APK fallback, vs browser home-screen shortcut. */
export default function AndroidDownloadPage() {
  const [apkReady, setApkReady] = useState(null);

  useEffect(() => {
    setPageMeta({
      title: "Скачать Android-приложение Вместе — RuStore и APK",
      description:
        "Приложение Вместе в RuStore: системные push и виджет записей. Ярлык «На экран Домой» из Chrome — это сайт, не приложение.",
      path: "/android",
    });
    let cancelled = false;
    fetch(ANDROID_APK_URL, { method: "HEAD", cache: "no-store" })
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
          Удобнее всего поставить из RuStore. Ярлык браузера выглядит как иконка, но это всё ещё сайт —
          без системных push и виджета.
        </p>
      </header>
      <main className="legal-page-body">
        <section className="android-store-block" aria-labelledby="android-rustore-title">
          <div className="android-store-copy">
            <h2 id="android-rustore-title">RuStore</h2>
            <p>
              Официальная витрина: обновления через магазин, без «неизвестных источников». Push-уведомления
              и виджет записей — в приложении.
            </p>
            <p>
              <a
                className="landing-btn landing-btn--primary"
                href={RUSTORE_APP_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Открыть в RuStore
              </a>
            </p>
            <p className="muted small">
              На телефоне ссылка откроет карточку приложения. С компьютера — отсканируйте QR.
            </p>
          </div>
          <figure className="android-store-qr">
            <img
              src={rustoreQrUrl(168)}
              width={168}
              height={168}
              alt="QR-код: скачать Вместе в RuStore"
              loading="lazy"
              decoding="async"
            />
            <figcaption className="muted small">QR → RuStore</figcaption>
          </figure>
        </section>

        <div className="android-compare" role="list">
          <article className="android-compare-card android-compare-card--app" role="listitem">
            <h2>Приложение</h2>
            <ul>
              <li>Системные push-уведомления</li>
              <li>Виджет «сегодня / ближайшая запись»</li>
              <li>Отдельный значок Вместе</li>
            </ul>
            <p className="muted small">Основной способ — RuStore выше. APK — запасной вариант.</p>
            {apkReady === false ? (
              <p className="status">Файл APK на сервере пока недоступен — напишите на {SITE_LEGAL.email}.</p>
            ) : (
              <p>
                <a
                  className="landing-btn landing-btn--outline"
                  href={ANDROID_APK_URL}
                  download={apkReady ? "vmeste-android.apk" : undefined}
                  aria-disabled={apkReady === null ? true : undefined}
                >
                  {apkReady === null ? "Проверяем файл…" : "Скачать APK напрямую"}
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
            <p className="muted small">Удобно для быстрого входа, но это не приложение из магазина.</p>
          </article>
        </div>

        <h2>Как установить из RuStore</h2>
        <ol>
          <li>Откройте карточку в RuStore (кнопка или QR).</li>
          <li>Нажмите «Скачать» / «Установить».</li>
          <li>Откройте Вместе, войдите, разрешите уведомления.</li>
          <li>Виджет: долгий тап по рабочему столу → Виджеты → Вместе.</li>
        </ol>

        <h2>Google Play</h2>
        <p className="muted">Пока приложение в RuStore. Публикация в Play — после аккаунта разработчика.</p>
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

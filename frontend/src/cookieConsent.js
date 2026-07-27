/** Cookie / analytics consent helpers (152-FZ friendly). */
export const COOKIE_CONSENT_KEY = "vmeste_cookie_consent_v1";
export const METRIKA_ID = 109821476;

export function getCookieConsent() {
  try {
    const v = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (v === "all" || v === "necessary") return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function setCookieConsent(value) {
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("vmeste-cookie-consent", { detail: value }));
  }
}

export function loadYandexMetrika() {
  if (typeof window === "undefined") return;
  if (window.__vmesteMetrikaLoaded) return;
  window.__vmesteMetrikaLoaded = true;

  (function (m, e, t, r, i, k, a) {
    m[i] =
      m[i] ||
      function () {
        (m[i].a = m[i].a || []).push(arguments);
      };
    m[i].l = 1 * new Date();
    for (let j = 0; j < document.scripts.length; j += 1) {
      if (document.scripts[j].src === r) return;
    }
    k = e.createElement(t);
    a = e.getElementsByTagName(t)[0];
    k.async = 1;
    k.src = r;
    a.parentNode.insertBefore(k, a);
  })(window, document, "script", `https://mc.yandex.ru/metrika/tag.js?id=${METRIKA_ID}`, "ym");

  window.ym?.(METRIKA_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

export function applyCookieConsent(value) {
  if (value === "all") loadYandexMetrika();
}

import { useEffect, useState } from "react";
import {
  applyCookieConsent,
  getCookieConsent,
  setCookieConsent,
} from "./cookieConsent.js";

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = getCookieConsent();
    if (existing) {
      applyCookieConsent(existing);
      return undefined;
    }
    setVisible(true);
    return undefined;
  }, []);

  if (!visible) return null;

  function accept(value) {
    setCookieConsent(value);
    applyCookieConsent(value);
    setVisible(false);
  }

  return (
    <div className="cookie-consent" role="dialog" aria-label="Согласие на cookies">
      <div className="cookie-consent-inner">
        <p className="cookie-consent-text">
          Мы используем необходимые cookies для работы сайта. С вашего согласия также подключаем
          Яндекс.Метрику (в т.ч. вебвизор) для аналитики. Подробнее — в{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Политике конфиденциальности
          </a>
          .
        </p>
        <div className="cookie-consent-actions">
          <button type="button" className="ghost-btn cookie-consent-btn" onClick={() => accept("necessary")}>
            Только необходимые
          </button>
          <button type="button" className="cookie-consent-btn cookie-consent-btn--primary" onClick={() => accept("all")}>
            Принять все
          </button>
        </div>
      </div>
    </div>
  );
}

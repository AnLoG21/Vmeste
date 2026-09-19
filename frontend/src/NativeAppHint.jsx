import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { RUSTORE_APP_URL } from "./mobileStores.js";

const HIDE_KEY = "vmeste_hide_apk_hint";

/** Android browser/PWA only: remind that home-screen shortcut ≠ native app. */
export default function NativeAppHint() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (Capacitor.isNativePlatform()) return;
      if (localStorage.getItem(HIDE_KEY) === "1") return;
      if (!/Android/i.test(navigator.userAgent || "")) return;
      setVisible(true);
    } catch {
      /* ignore */
    }
  }, []);

  if (!visible) return null;

  return (
    <aside className="native-app-hint" role="note">
      <p>
        Сейчас открыт сайт (или ярлык браузера). Системные push и виджет записей — только в{" "}
        <strong>приложении</strong>.
      </p>
      <div className="native-app-hint-actions">
        <a
          className="landing-btn landing-btn--primary native-app-hint-link"
          href={RUSTORE_APP_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Открыть в RuStore
        </a>
        <a className="ghost-btn small native-app-hint-link" href="/android">
          Подробнее
        </a>
        <button
          type="button"
          className="ghost-btn small"
          onClick={() => {
            try {
              localStorage.setItem(HIDE_KEY, "1");
            } catch {
              /* ignore */
            }
            setVisible(false);
          }}
        >
          Понятно
        </button>
      </div>
    </aside>
  );
}

import { useState } from "react";
import { createPortal } from "react-dom";

const QUICK_START_SPHERES = new Set(["hair_salon", "service_center"]);

export function shouldOfferQuickStart(me) {
  if (!me || me.role !== "provider" || me.is_demo) return false;
  return QUICK_START_SPHERES.has(String(me.provider_sphere || ""));
}

/**
 * One-shot: template catalog → activate services → weekday slots → share link.
 */
export default function ProviderQuickStartModal({
  open,
  onClose,
  authFetch,
  API_URL,
  me,
  onDone,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  if (!open || typeof document === "undefined") return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "https://vsevmeste.space";
  const bookUrl = result?.booking_path ? `${origin}${result.booking_path}` : "";

  async function runQuickStart() {
    setBusy(true);
    setError("");
    try {
      const res = await authFetch(`${API_URL}/catalog/quick-start/`, {
        method: "POST",
        body: JSON.stringify({ activate_limit: 5, days: 7, start_hour: 10, end_hour: 19 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Не удалось выполнить быстрый старт.");
        return;
      }
      setResult(data);
      onDone?.(data);
    } catch {
      setError("Сеть недоступна. Попробуйте ещё раз.");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!bookUrl) return;
    try {
      await navigator.clipboard.writeText(bookUrl);
    } catch {
      /* ignore */
    }
  }

  return createPortal(
    <div className="modal-backdrop modal-backdrop--app-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="client-book-overlay-head">
          <h3>Старт за пару минут</h3>
          <button type="button" className="modal-close-btn" aria-label="Закрыть" onClick={onClose}>
            ×
          </button>
        </div>
        {!result ? (
          <>
            <p className="muted">
              Загрузим шаблон услуг для «{me?.organization_name || "организации"}», включим 5 позиций и откроем
              запись на будни 10:00–19:00 (ближайшая неделя). Цены можно поменять позже.
            </p>
            <button type="button" disabled={busy} onClick={runQuickStart}>
              {busy ? "Настраиваем…" : "Сделать быстрый старт"}
            </button>
            <button type="button" className="ghost-btn" disabled={busy} onClick={onClose} style={{ marginTop: 8 }}>
              Настроить вручную
            </button>
            {error ? <p className="status">{error}</p> : null}
          </>
        ) : (
          <>
            <p className="status">
              Готово: услуг активно {result.activated_services}, интервалов добавлено {result.slots_created}.
            </p>
            {bookUrl ? (
              <>
                <p className="field-label">Ссылка для клиентов</p>
                <input readOnly value={bookUrl} onFocus={(e) => e.target.select()} />
                <div className="row-2" style={{ marginTop: 8 }}>
                  <button type="button" onClick={copyLink}>
                    Скопировать
                  </button>
                  <a className="ghost-btn" href={bookUrl} target="_blank" rel="noreferrer">
                    Открыть виджет
                  </a>
                </div>
              </>
            ) : (
              <p className="muted small">Ссылка появится после сохранения названия организации (slug).</p>
            )}
            <button type="button" className="ghost-btn" onClick={onClose} style={{ marginTop: 12 }}>
              В кабинет
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

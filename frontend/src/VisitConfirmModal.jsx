import { useEffect, useState } from "react";
import { API_URL } from "./config.js";

/**
 * Публичное подтверждение визита по ссылке ?visit_confirm=TOKEN
 */
export default function VisitConfirmModal({ token, onClose }) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_URL}/booking/public/visit-confirm/${encodeURIComponent(token)}/`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.detail || "Ссылка недействительна.");
          setInfo(null);
          return;
        }
        setInfo(data);
        if (data.already_confirmed) setDone(true);
      } catch {
        if (!cancelled) setError("Не удалось загрузить запись.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/booking/public/visit-confirm/${encodeURIComponent(token)}/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.detail || "Не удалось подтвердить.");
        return;
      }
      setInfo((p) => ({ ...p, ...data }));
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => onClose?.()}>
      <div className="modal-card visit-confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="provider-book-client-head">
          <h2>Подтверждение визита</h2>
          <button type="button" className="client-memory-close" aria-label="Закрыть" onClick={() => onClose?.()}>
            ×
          </button>
        </div>
        {loading ? <p className="muted">Загрузка…</p> : null}
        {error ? <p className="status">{error}</p> : null}
        {info && !loading ? (
          <>
            <p>
              <strong>{info.org}</strong>
            </p>
            <p className="muted">
              {info.service}
              {info.when ? ` · ${info.when}` : ""}
            </p>
            {done ? (
              <p className="visit-confirm-ok">Визит подтверждён. Ждём вас!</p>
            ) : (
              <button type="button" disabled={busy} onClick={() => void confirm()}>
                {busy ? "Отправляем…" : "Подтвердить визит"}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";

/**
 * Поиск клиента по имени/телефону → подсказки → карточка с «Добавить».
 */
export default function ClientPickerSearch({
  authFetch,
  API_URL,
  initialQuery = "",
  selectedClient,
  onSelect,
  onClear,
}) {
  const [query, setQuery] = useState(initialQuery || "");
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // карточка из подсказки
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    if ((initialQuery || "").trim()) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (selectedClient || preview) return undefined;
    if (q.length < 2) {
      setResults([]);
      return undefined;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void runSearch(q);
    }, 280);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, selectedClient, preview]);

  async function runSearch(q) {
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/booking/clients/lookup/?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResults([]);
        return;
      }
      const list = Array.isArray(data.results) ? data.results : data.client ? [data.client] : [];
      setResults(list);
      setOpen(true);
    } finally {
      setBusy(false);
    }
  }

  if (selectedClient) {
    return (
      <div className="client-picker-selected">
        <div className="client-picker-card client-picker-card--compact">
          <div className="client-picker-avatar" aria-hidden>
            {selectedClient.avatar_url ? (
              <img src={selectedClient.avatar_url} alt="" />
            ) : (
              <span>{selectedClient.avatar_initial || selectedClient.name?.[0] || "?"}</span>
            )}
          </div>
          <div className="client-picker-card-body">
            <strong>{selectedClient.name}</strong>
            {selectedClient.phone ? <p className="muted small">{selectedClient.phone}</p> : null}
          </div>
          <button
            type="button"
            className="client-picker-clear"
            title="Сменить клиента"
            aria-label="Сменить клиента"
            onClick={() => {
              onClear?.();
              setPreview(null);
              setQuery("");
              setResults([]);
            }}
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (preview) {
    return (
      <div className="client-picker-preview">
        <button
          type="button"
          className="client-picker-back"
          aria-label="Назад к поиску"
          title="Назад"
          onClick={() => {
            setPreview(null);
            setOpen(true);
          }}
        >
          ←
        </button>
        <div className="client-picker-card">
          <div className="client-picker-avatar client-picker-avatar--lg" aria-hidden>
            {preview.avatar_url ? (
              <img src={preview.avatar_url} alt="" />
            ) : (
              <span>{preview.avatar_initial || preview.name?.[0] || "?"}</span>
            )}
          </div>
          <div className="client-picker-card-body">
            <strong>{preview.name}</strong>
            {preview.phone ? <p>{preview.phone}</p> : null}
            {preview.email ? <p className="muted small">{preview.email}</p> : null}
            <p className="muted small">
              {[
                preview.visits_done != null ? `Визитов: ${preview.visits_done}` : null,
                preview.last_visit ? `Последний: ${preview.last_visit}` : null,
                preview.username ? `@${preview.username}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <button
            type="button"
            className="client-picker-add-btn"
            onClick={() => {
              onSelect?.(preview);
              setPreview(null);
              setResults([]);
              setOpen(false);
            }}
          >
            Добавить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="client-picker-search" ref={wrapRef}>
      <label className="field-label">
        Клиент (поиск по имени или телефону)
        <div className="client-picker-input-row">
          <input
            type="search"
            autoComplete="off"
            placeholder="Анна или +7…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (results.length) setOpen(true);
            }}
          />
          {busy ? <span className="client-picker-busy muted small">…</span> : null}
        </div>
      </label>
      {open && results.length > 0 ? (
        <ul className="client-picker-suggestions" role="listbox">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="client-picker-suggestion"
                onClick={() => {
                  setPreview(c);
                  setOpen(false);
                }}
              >
                <span className="client-picker-avatar" aria-hidden>
                  {c.avatar_url ? <img src={c.avatar_url} alt="" /> : <span>{c.avatar_initial || "?"}</span>}
                </span>
                <span className="client-picker-suggestion-text">
                  <strong>{c.name}</strong>
                  <span className="muted small">
                    {[c.phone, c.visits_done != null ? `${c.visits_done} виз.` : null].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim().length >= 2 && !busy && results.length === 0 ? (
        <p className="muted small client-picker-empty">В вашей базе никого не нашли — можно записать нового по имени ниже.</p>
      ) : null}
    </div>
  );
}

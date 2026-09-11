import { useEffect, useRef, useState } from "react";

/**
 * База клиентов организации: список с пагинацией, поиск с подсказками, открытие CRM-карточки.
 */
export default function ClientsBasePanel({
  authFetch,
  API_URL,
  onOpenClient,
}) {
  const [query, setQuery] = useState("");
  const [listQuery, setListQuery] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ results: [], count: 0, page: 1, total_pages: 1 });
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestBusy, setSuggestBusy] = useState(false);
  const wrapRef = useRef(null);
  const suggestTimer = useRef(null);
  const listTimer = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setSuggestOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          page_size: "20",
        });
        if (listQuery.trim().length >= 2) params.set("q", listQuery.trim());
        const res = await authFetch(`${API_URL}/booking/clients/?${params}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setData({ results: [], count: 0, page: 1, total_pages: 1 });
          return;
        }
        setData({
          results: Array.isArray(json.results) ? json.results : [],
          count: Number(json.count) || 0,
          page: Number(json.page) || page,
          total_pages: Number(json.total_pages) || 1,
          page_size: Number(json.page_size) || 20,
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, page, listQuery]);

  useEffect(() => {
    const q = query.trim();
    clearTimeout(suggestTimer.current);
    if (q.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    suggestTimer.current = setTimeout(async () => {
      setSuggestBusy(true);
      try {
        const res = await authFetch(`${API_URL}/booking/clients/lookup/?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        setSuggestions(Array.isArray(json.results) ? json.results : []);
        setSuggestOpen(true);
      } finally {
        setSuggestBusy(false);
      }
    }, 280);
    return () => clearTimeout(suggestTimer.current);
  }, [API_URL, authFetch, query]);

  function applyListSearch(nextQ) {
    clearTimeout(listTimer.current);
    listTimer.current = setTimeout(() => {
      setPage(1);
      setListQuery(nextQ);
    }, 350);
  }

  function openClient(c) {
    if (!c?.id) return;
    setSuggestOpen(false);
    onOpenClient?.(c.id, c.name || "");
  }

  const results = data.results || [];
  const totalPages = data.total_pages || 1;

  return (
    <section className="card full-width clients-base-panel">
      <div className="clients-base-head">
        <div>
          <h2>База клиентов</h2>
          <p className="muted small">
            Клиенты с записями в вашей организации
            {data.count ? ` · ${data.count}` : ""}
          </p>
        </div>
      </div>

      <div className="clients-base-search" ref={wrapRef}>
        <label className="field-label">
          Поиск
          <div className="clients-base-search-row">
            <input
              type="search"
              autoComplete="off"
              placeholder="Имя или телефон…"
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                applyListSearch(v);
              }}
              onFocus={() => {
                if (suggestions.length) setSuggestOpen(true);
              }}
            />
            {suggestBusy ? <span className="muted small">…</span> : null}
          </div>
        </label>
        {suggestOpen && suggestions.length > 0 ? (
          <ul className="clients-base-suggestions" role="listbox">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button type="button" className="clients-base-suggestion" onClick={() => openClient(c)}>
                  <span className="clients-base-avatar" aria-hidden>
                    {c.avatar_url ? <img src={c.avatar_url} alt="" /> : <span>{c.avatar_initial || "?"}</span>}
                  </span>
                  <span className="clients-base-suggestion-text">
                    <strong>{c.name}</strong>
                    <span className="muted small">
                      {[c.phone, c.visits_done != null ? `${c.visits_done} виз.` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {loading ? (
        <p className="muted">Загрузка…</p>
      ) : results.length === 0 ? (
        <p className="muted">Пока нет клиентов — они появятся после первых записей.</p>
      ) : (
        <ul className="clients-base-grid">
          {results.map((c) => (
            <li key={c.id}>
              <button type="button" className="clients-base-card" onClick={() => openClient(c)}>
                <span className="clients-base-avatar clients-base-avatar--lg" aria-hidden>
                  {c.avatar_url ? (
                    <img src={c.avatar_url} alt="" />
                  ) : (
                    <span>{c.avatar_initial || c.name?.[0] || "?"}</span>
                  )}
                </span>
                <span className="clients-base-card-body">
                  <strong className="clients-base-name">{c.name}</strong>
                  {c.phone ? <span className="clients-base-phone">{c.phone}</span> : null}
                  <span className="muted small clients-base-meta">
                    {[
                      c.visits_done != null ? `Визитов: ${c.visits_done}` : null,
                      c.last_visit ? `Последний: ${c.last_visit}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {(c.hair_color || c.allergies) && (
                    <span className="clients-base-hints">
                      {c.hair_color ? <span title="Краска">Краска: {c.hair_color}</span> : null}
                      {c.allergies ? <span title="Аллергии">Аллергии: {c.allergies}</span> : null}
                    </span>
                  )}
                </span>
                <span className="clients-base-card-action muted small">Открыть</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 ? (
        <div className="clients-base-pager">
          <button
            type="button"
            className="ghost-btn"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Назад
          </button>
          <span className="muted small">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="ghost-btn"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Далее
          </button>
        </div>
      ) : null}
    </section>
  );
}

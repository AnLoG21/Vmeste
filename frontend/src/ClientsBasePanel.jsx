import { useEffect, useRef, useState } from "react";
import { showToast } from "./toast.js";

/**
 * База клиентов организации: список, поиск, создание, импорт Excel, CRM-карточки.
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
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", phone: "", source: "" });
  const [createBusy, setCreateBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [migrateOpen, setMigrateOpen] = useState(false);
  const [migrateNote, setMigrateNote] = useState("");
  const [migrateBusy, setMigrateBusy] = useState(false);
  const [migrateLatest, setMigrateLatest] = useState(null);
  const wrapRef = useRef(null);
  const suggestTimer = useRef(null);
  const listTimer = useRef(null);
  const fileRef = useRef(null);
  const migrateFileRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);

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
  }, [API_URL, authFetch, page, listQuery, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/booking/clients/migrate-request/`);
        const json = await res.json().catch(() => ({}));
        if (cancelled || !res.ok) return;
        setMigrateLatest(json.latest || null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [API_URL, authFetch, reloadKey]);

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

  async function createClient(e) {
    e.preventDefault();
    setCreateBusy(true);
    try {
      const res = await authFetch(`${API_URL}/booking/clients/`, {
        method: "POST",
        body: JSON.stringify({
          name: createForm.name,
          phone: createForm.phone,
          acquisition_source: createForm.source,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.detail || "Не удалось добавить", { tone: "error" });
        return;
      }
      showToast("Клиент добавлен в базу");
      setCreateOpen(false);
      setCreateForm({ name: "", phone: "", source: "" });
      setReloadKey((k) => k + 1);
      if (json.id) onOpenClient?.(json.id, json.name || createForm.name);
    } finally {
      setCreateBusy(false);
    }
  }

  async function importFile(file) {
    if (!file) return;
    setImportBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`${API_URL}/booking/clients/`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.detail || "Ошибка импорта", { tone: "error" });
        return;
      }
      showToast(json.detail || "Импорт завершён");
      setImportOpen(false);
      setReloadKey((k) => k + 1);
    } finally {
      setImportBusy(false);
    }
  }

  async function submitMigrateRequest(e) {
    e.preventDefault();
    const file = migrateFileRef.current?.files?.[0] || null;
    const note = migrateNote.trim();
    if (!file && !note) {
      showToast("Прикрепите файл или опишите источник", { tone: "error" });
      return;
    }
    setMigrateBusy(true);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      if (note) fd.append("source_note", note);
      const res = await authFetch(`${API_URL}/booking/clients/migrate-request/`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(json.detail || "Не удалось отправить заявку", { tone: "error" });
        return;
      }
      showToast("Заявка отправлена — перенесём базу");
      setMigrateOpen(false);
      setMigrateNote("");
      if (migrateFileRef.current) migrateFileRef.current.value = "";
      setMigrateLatest(json);
      setReloadKey((k) => k + 1);
    } finally {
      setMigrateBusy(false);
    }
  }

  async function deleteClient(c, e) {
    e?.stopPropagation?.();
    if (!c?.id) return;
    if (!window.confirm(`Удалить «${c.name}» из базы клиентов? История записей сохранится.`)) return;
    const res = await authFetch(`${API_URL}/booking/clients/?client=${encodeURIComponent(c.id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      showToast("Не удалось удалить", { tone: "error" });
      return;
    }
    showToast("Удалено из базы");
    setReloadKey((k) => k + 1);
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
        <div className="clients-base-head-actions">
          <button
            type="button"
            className="clients-base-icon-btn"
            title="Добавить клиента"
            aria-label="Добавить клиента"
            onClick={() => setCreateOpen(true)}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
              <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V8H4v2H2v2h2v2h2v-2h2v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
          <button type="button" className="ghost-btn" onClick={() => setImportOpen(true)}>
            Перенести базу из Excel
          </button>
        </div>
      </div>

      <div className="clients-base-migrate-banner">
        <div className="clients-base-migrate-banner-row">
          <div>
            <strong>Поможем перенести базу клиентов бесплатно за 5 минут</strong>
            <p className="muted small">
              Оставьте заявку с файлом или описанием CRM — мы перенесём. Или загрузите Excel сами кнопкой
              выше.
            </p>
          </div>
          {migrateLatest ? (
            <span
              className={`clients-base-migrate-badge status-${migrateLatest.status || "new"}`}
              title={migrateLatest.result_detail || ""}
            >
              {migrateLatest.status_label || migrateLatest.status}
            </span>
          ) : null}
        </div>
        {!migrateOpen ? (
          <button type="button" className="primary-btn clients-base-migrate-cta" onClick={() => setMigrateOpen(true)}>
            Оставить заявку
          </button>
        ) : (
          <form className="clients-base-migrate-form" onSubmit={submitMigrateRequest}>
            <label className="field-label">
              Комментарий
              <textarea
                rows={2}
                placeholder="Откуда переносим: Excel, YCLIENTS, блокнот…"
                value={migrateNote}
                onChange={(e) => setMigrateNote(e.target.value)}
              />
            </label>
            <label className="field-label">
              Файл (необязательно)
              <input ref={migrateFileRef} type="file" accept=".xlsx,.xls,.csv,.txt" />
            </label>
            <div className="clients-base-migrate-form-actions">
              <button type="submit" className="primary-btn" disabled={migrateBusy}>
                {migrateBusy ? "Отправка…" : "Отправить заявку"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={migrateBusy}
                onClick={() => setMigrateOpen(false)}
              >
                Отмена
              </button>
            </div>
          </form>
        )}
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
        <p className="muted">Пока нет клиентов — добавьте вручную, импортируйте Excel или дождитесь первых записей.</p>
      ) : (
        <ul className="clients-base-grid">
          {results.map((c) => (
            <li key={c.id}>
              <div className="clients-base-card">
                <button type="button" className="clients-base-card-main" onClick={() => openClient(c)}>
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
                        c.total_spent > 0 ? `${Math.round(c.total_spent)} ₽` : null,
                        c.last_visit ? `Последний: ${c.last_visit}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="clients-base-badges">
                      {c.is_vip ? <span className="clients-base-badge clients-base-badge--vip">VIP</span> : null}
                      {c.is_blocked ? (
                        <span className="clients-base-badge clients-base-badge--block">Чёрный список</span>
                      ) : null}
                      {c.no_show_count > 0 ? (
                        <span className="clients-base-badge clients-base-badge--noshow">
                          Не пришёл: {c.no_show_count}
                        </span>
                      ) : null}
                      {c.acquisition_source ? (
                        <span className="clients-base-badge">{c.acquisition_source}</span>
                      ) : null}
                    </span>
                    {(c.hair_color || c.allergies) && (
                      <span className="clients-base-hints">
                        {c.hair_color ? <span title="Краска">Краска: {c.hair_color}</span> : null}
                        {c.allergies ? <span title="Аллергии">Аллергии: {c.allergies}</span> : null}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  className="clients-base-delete"
                  title="Удалить из базы"
                  aria-label="Удалить из базы"
                  onClick={(e) => void deleteClient(c, e)}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>
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

      {createOpen ? (
        <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => setCreateOpen(false)}>
          <div className="modal-card clients-base-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>Новый клиент в базе</h3>
            <form className="form" onSubmit={createClient}>
              <label className="field-label">
                Имя
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Анна Иванова"
                />
              </label>
              <label className="field-label">
                Телефон
                <input
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+7…"
                />
              </label>
              <label className="field-label">
                Откуда пришёл
                <input
                  value={createForm.source}
                  onChange={(e) => setCreateForm((p) => ({ ...p, source: e.target.value }))}
                  placeholder="Рекомендация / Instagram / Реклама…"
                />
              </label>
              <div className="clients-base-modal-actions">
                <button type="button" className="ghost-btn" onClick={() => setCreateOpen(false)}>
                  Отмена
                </button>
                <button type="submit" disabled={createBusy}>
                  {createBusy ? "Сохранение…" : "Добавить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {importOpen ? (
        <div className="modal-backdrop modal-backdrop--app-overlay" onClick={() => setImportOpen(false)}>
          <div className="modal-card clients-base-modal clients-base-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog">
            <h3>Перенести базу из Excel</h3>
            <p className="muted small">
              Загрузите <strong>.xlsx</strong> или <strong>.csv</strong>. Первая строка — заголовки. Нужные колонки:
            </p>
            <div className="clients-base-excel-preview" aria-hidden>
              <table>
                <thead>
                  <tr>
                    <th>имя</th>
                    <th>телефон</th>
                    <th>источник</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Анна Иванова</td>
                    <td>+79001234567</td>
                    <td>Рекомендация</td>
                  </tr>
                  <tr>
                    <td>Пётр Сидоров</td>
                    <td>89991112233</td>
                    <td>Instagram</td>
                  </tr>
                  <tr>
                    <td>Мария</td>
                    <td>+79161234567</td>
                    <td>Реклама</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted small">
              Также подойдут колонки: <code>фамилия</code>, <code>имя</code>, <code>отчество</code>,{" "}
              <code>phone</code>, <code>source</code>.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) void importFile(f);
              }}
            />
            <div className="clients-base-modal-actions">
              <button type="button" className="ghost-btn" onClick={() => setImportOpen(false)}>
                Закрыть
              </button>
              <button type="button" disabled={importBusy} onClick={() => fileRef.current?.click()}>
                {importBusy ? "Импорт…" : "Выбрать файл"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

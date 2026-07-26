import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WIDGETS_KEY = "vmeste_analytics_widgets_v1";

const DEFAULT_WIDGETS = {
  kpis: true,
  bookingsChart: true,
  revenueChart: true,
  servicesChart: true,
  staffChart: true,
  ratingsChart: true,
  table: true,
};

const STATUS_LABELS = {
  new: "Новая",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  done: "Выполнена",
};

function loadWidgets() {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return { ...DEFAULT_WIDGETS };
    return { ...DEFAULT_WIDGETS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_WIDGETS };
  }
}

function todayIso() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function daysAgoIso(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function BarChart({ items, valueKey = "value", labelKey = "label", color = "#1f6feb" }) {
  const max = Math.max(1, ...items.map((x) => Number(x[valueKey]) || 0));
  if (!items.length) return <p className="muted small">Нет данных</p>;
  return (
    <div className="analytics-bars" role="img" aria-label="Столбчатая диаграмма">
      {items.map((item, i) => {
        const v = Number(item[valueKey]) || 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={item.id ?? item[labelKey] ?? i} className="analytics-bar-row">
            <span className="analytics-bar-label" title={item[labelKey]}>
              {item[labelKey]}
            </span>
            <div className="analytics-bar-track">
              <div className="analytics-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="analytics-bar-value">{v}</span>
          </div>
        );
      })}
    </div>
  );
}

function LineChart({ points, valueKey = "value", color = "#1f6feb" }) {
  const w = 640;
  const h = 180;
  const pad = 12;
  if (!points.length) return <p className="muted small">Нет данных</p>;
  const vals = points.map((p) => Number(p[valueKey]) || 0);
  const max = Math.max(1, ...vals);
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * stepX;
    const y = h - pad - ((Number(p[valueKey]) || 0) / max) * (h - pad * 2);
    return [x, y];
  });
  const polyline = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${h - pad} ${polyline} ${coords[coords.length - 1][0]},${h - pad}`;
  return (
    <svg className="analytics-line-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Линейный график">
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3" fill={color} />
      ))}
    </svg>
  );
}

export default function AnalyticsPage({ apiUrl, authFetch }) {
  const [appliedFrom, setAppliedFrom] = useState(() => daysAgoIso(30));
  const [appliedTo, setAppliedTo] = useState(() => todayIso());
  const [draftFrom, setDraftFrom] = useState(() => daysAgoIso(30));
  const [draftTo, setDraftTo] = useState(() => todayIso());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [widgets, setWidgets] = useState(loadWidgets);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ from: appliedFrom, to: appliedTo });
    const res = await authFetch(`${apiUrl}/booking/analytics/?${qs}`);
    if (!res.ok) {
      setError("Не удалось загрузить аналитику.");
      setData(null);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [apiUrl, authFetch, appliedFrom, appliedTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    function onDoc(e) {
      if (filtersRef.current?.contains(e.target)) return;
      setFiltersOpen(false);
    }
    document.addEventListener("mousedown", onDoc, true);
    return () => document.removeEventListener("mousedown", onDoc, true);
  }, [filtersOpen]);

  function applyFilters() {
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setFiltersOpen(false);
  }

  function toggleWidget(key) {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(WIDGETS_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  function toggleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "created_at" || key === "price" ? "desc" : "asc");
    }
  }

  const filteredRows = useMemo(() => {
    const rows = data?.bookings || [];
    const q = tableFilter.trim().toLowerCase();
    let out = rows;
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    if (q) {
      out = out.filter((r) =>
        [r.service, r.staff, r.client, r.status, STATUS_LABELS[r.status]]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...out].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av ?? "").localeCompare(String(bv ?? ""), "ru") * dir;
    });
  }, [data, tableFilter, statusFilter, sortKey, sortDir]);

  const serviceBars = (data?.by_service || []).slice(0, 10).map((s) => ({
    id: s.id,
    label: s.name,
    value: s.count,
  }));
  const staffBars = (data?.by_staff || []).slice(0, 10).map((s) => ({
    id: s.id ?? "none",
    label: s.name,
    value: s.count,
  }));
  const ratingBars = Object.entries(data?.rating_histogram || {})
    .map(([k, v]) => ({ label: `${k}★`, value: v, id: k }))
    .sort((a, b) => Number(b.id) - Number(a.id));

  const periodLabel = `${new Date(`${appliedFrom}T12:00:00`).toLocaleDateString("ru-RU")} – ${new Date(`${appliedTo}T12:00:00`).toLocaleDateString("ru-RU")}`;

  return (
    <section className="card full-width analytics-page">
      <div className="analytics-head">
        <div>
          <h2>Аналитика</h2>
          <p className="muted small">Записи, выручка и отзывы · {periodLabel}</p>
        </div>
        <div className="analytics-toolbar">
          <button type="button" className="ghost-btn" onClick={() => setWidgetsOpen((v) => !v)}>
            Виджеты
          </button>
          <div className="analytics-filters-wrap" ref={filtersRef}>
            <button
              type="button"
              className={["analytics-filter-btn", filtersOpen && "active"].filter(Boolean).join(" ")}
              aria-label="Фильтры периода"
              aria-expanded={filtersOpen}
              title="Фильтры"
              onClick={() => {
                setDraftFrom(appliedFrom);
                setDraftTo(appliedTo);
                setFiltersOpen((v) => !v);
              }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
                <path d="M3 5h18v2.17L14 15v5l-4 1v-6L3 7.17V5zm2.83 2L11 12.83V18.5l2-.5v-5.17L18.17 7H5.83z" />
              </svg>
            </button>
            {filtersOpen && (
              <div className="analytics-filters-popover" role="dialog" aria-label="Фильтр по датам">
                <label className="analytics-date">
                  <span>С</span>
                  <input type="date" value={draftFrom} onChange={(e) => setDraftFrom(e.target.value)} />
                </label>
                <label className="analytics-date">
                  <span>По</span>
                  <input type="date" value={draftTo} onChange={(e) => setDraftTo(e.target.value)} />
                </label>
                <button type="button" onClick={applyFilters} disabled={loading}>
                  Применить
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {widgetsOpen && (
        <div className="analytics-widgets-panel">
          {[
            ["kpis", "Сводка"],
            ["bookingsChart", "Записи по дням"],
            ["revenueChart", "Выручка по дням"],
            ["servicesChart", "По услугам"],
            ["staffChart", "По мастерам"],
            ["ratingsChart", "Оценки"],
            ["table", "Таблица записей"],
          ].map(([key, label]) => (
            <label key={key} className="checkbox">
              <input type="checkbox" checked={!!widgets[key]} onChange={() => toggleWidget(key)} />
              {label}
            </label>
          ))}
        </div>
      )}

      {error ? <p className="status">{error}</p> : null}
      {loading && !data ? <p className="muted">Загрузка…</p> : null}

      {widgets.kpis && data?.totals && (
        <div className="analytics-kpis">
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">Записей</span>
            <strong>{data.totals.bookings}</strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">Выручка (выполнено)</span>
            <strong>{Math.round(data.totals.revenue_estimate).toLocaleString("ru-RU")} ₽</strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">Средняя оценка</span>
            <strong>{data.totals.average_rating || "—"}</strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">Отзывов</span>
            <strong>{data.totals.reviews_count}</strong>
          </div>
          {Object.entries(data.totals.by_status || {}).map(([st, cnt]) => (
            <div key={st} className="analytics-kpi analytics-kpi--sm">
              <span className="analytics-kpi-label">{STATUS_LABELS[st] || st}</span>
              <strong>{cnt}</strong>
            </div>
          ))}
        </div>
      )}

      <div className="analytics-grid">
        {widgets.bookingsChart && (
          <div className="analytics-panel">
            <h3>Записи по дням</h3>
            <LineChart points={data?.by_day || []} valueKey="bookings" color="#1f6feb" />
          </div>
        )}
        {widgets.revenueChart && (
          <div className="analytics-panel">
            <h3>Выручка по дням</h3>
            <LineChart points={data?.by_day || []} valueKey="revenue" color="#0a7a4b" />
          </div>
        )}
        {widgets.servicesChart && (
          <div className="analytics-panel">
            <h3>Топ услуг</h3>
            <BarChart items={serviceBars} color="#1f6feb" />
          </div>
        )}
        {widgets.staffChart && (
          <div className="analytics-panel">
            <h3>По мастерам</h3>
            <BarChart items={staffBars} color="#c45c26" />
          </div>
        )}
        {widgets.ratingsChart && (
          <div className="analytics-panel">
            <h3>Распределение оценок</h3>
            <BarChart items={ratingBars} color="#d4a017" />
          </div>
        )}
      </div>

      {widgets.table && (
        <div className="analytics-panel analytics-table-wrap">
          <div className="analytics-table-toolbar">
            <h3>Записи</h3>
            <input
              type="search"
              placeholder="Поиск…"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="analytics-table-scroll">
            <table className="analytics-table">
              <thead>
                <tr>
                  {[
                    ["created_at", "Создана"],
                    ["status", "Статус"],
                    ["service", "Услуга"],
                    ["staff", "Мастер"],
                    ["client", "Клиент"],
                    ["price", "Цена"],
                  ].map(([key, label]) => (
                    <th key={key}>
                      <button type="button" className="analytics-sort-btn" onClick={() => toggleSort(key)}>
                        {label}
                        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="muted">
                      Нет записей
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}</td>
                      <td>{STATUS_LABELS[r.status] || r.status}</td>
                      <td>{r.service}</td>
                      <td>{r.staff}</td>
                      <td>{r.client}</td>
                      <td>{Math.round(r.price).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

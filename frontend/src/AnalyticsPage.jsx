import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const WIDGETS_KEY_BOOKING = "vmeste_analytics_widgets_v1";
const WIDGETS_KEY_CAFE = "vmeste_analytics_widgets_cafe_v1";
const WIDGETS_KEY_SHOP = "vmeste_analytics_widgets_shop_v1";

const DEFAULT_WIDGETS_BOOKING = {
  kpis: true,
  statuses: true,
  bookingsChart: true,
  revenueChart: true,
  servicesChart: true,
  staffChart: true,
  ratingsChart: true,
  table: true,
};

const DEFAULT_WIDGETS_CAFE = {
  kpis: true,
  statuses: true,
  modes: true,
  bookingsChart: true,
  revenueChart: true,
  servicesChart: true,
  staffChart: false,
  ratingsChart: true,
  table: true,
};

const DEFAULT_WIDGETS_SHOP = {
  kpis: true,
  statuses: true,
  modes: true,
  bookingsChart: true,
  revenueChart: true,
  servicesChart: true,
  staffChart: false,
  ratingsChart: false,
  channels: true,
  table: true,
};

const BOOKING_STATUS_LABELS = {
  new: "Новая",
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  done: "Выполнена",
  no_show: "Неявка",
  arrived: "Клиент пришёл",
};

const CAFE_STATUS_LABELS = {
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  accepted: "Принят",
  cooking: "Готовится",
  ready: "Готов",
  delivering: "Доставляется",
  done: "Завершён",
  cancelled: "Отменён",
};

const SHOP_STATUS_LABELS = {
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  assembling: "Собирается",
  ready: "Готов",
  to_courier: "Передаём курьеру",
  delivering: "В пути",
  done: "Завершён",
  cancelled: "Отменён",
};

const CAFE_MODE_LABELS = {
  dine_in: "За столом",
  takeaway: "Самовывоз",
  delivery: "Доставка",
};

const SHOP_MODE_LABELS = {
  pickup: "Самовывоз",
  delivery: "Доставка",
};

const SHOP_CHANNEL_LABELS = {
  pickup: "Самовывоз",
  delivery: "Доставка",
  own: "Своя доставка",
  yandex: "Яндекс",
  cdek: "СДЭК",
  russian_post: "Почта РФ",
  dostavista: "Dostavista",
  other: "Другое",
};

function analyticsKind(providerSphere) {
  if (providerSphere === "cafe_restaurant") return "cafe";
  if (providerSphere === "shops") return "shop";
  return "booking";
}

function widgetsKey(kind) {
  if (kind === "cafe") return WIDGETS_KEY_CAFE;
  if (kind === "shop") return WIDGETS_KEY_SHOP;
  return WIDGETS_KEY_BOOKING;
}

function widgetsDefaults(kind) {
  if (kind === "cafe") return DEFAULT_WIDGETS_CAFE;
  if (kind === "shop") return DEFAULT_WIDGETS_SHOP;
  return DEFAULT_WIDGETS_BOOKING;
}

function loadWidgets(kind) {
  const key = widgetsKey(kind);
  const defaults = widgetsDefaults(kind);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...defaults };
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return { ...defaults };
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

export default function AnalyticsPage({ apiUrl, authFetch, providerSphere = "" }) {
  const kind = analyticsKind(providerSphere);
  const isCafe = kind === "cafe";
  const isShop = kind === "shop";
  const isOrderLike = isCafe || isShop;
  const statusLabels = isShop ? SHOP_STATUS_LABELS : isCafe ? CAFE_STATUS_LABELS : BOOKING_STATUS_LABELS;
  const modeLabels = isShop ? SHOP_MODE_LABELS : isCafe ? CAFE_MODE_LABELS : null;
  const [appliedFrom, setAppliedFrom] = useState(() => daysAgoIso(30));
  const [appliedTo, setAppliedTo] = useState(() => todayIso());
  const [draftFrom, setDraftFrom] = useState(() => daysAgoIso(30));
  const [draftTo, setDraftTo] = useState(() => todayIso());
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [widgets, setWidgets] = useState(() => loadWidgets(kind));
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [tableFilter, setTableFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortKey, setSortKey] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    setWidgets(loadWidgets(kind));
  }, [kind]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ from: appliedFrom, to: appliedTo });
    const path = isCafe ? "/cafe/analytics/" : isShop ? "/shop/analytics/" : "/booking/analytics/";
    const url = `${apiUrl}${path}?${qs}`;
    const res = await authFetch(url);
    if (!res.ok) {
      setError("Не удалось загрузить аналитику.");
      setData(null);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [apiUrl, authFetch, appliedFrom, appliedTo, isCafe, isShop]);

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
        localStorage.setItem(widgetsKey(kind), JSON.stringify(next));
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
      setSortDir(key === "created_at" || key === "price" || key === "total" ? "desc" : "asc");
    }
  }

  const tableRows = isOrderLike ? data?.orders || [] : data?.bookings || [];

  const filteredRows = useMemo(() => {
    const rows = tableRows;
    const q = tableFilter.trim().toLowerCase();
    let out = rows;
    if (statusFilter) out = out.filter((r) => r.status === statusFilter);
    if (q) {
      out = out.filter((r) =>
        [
          r.service,
          r.staff,
          r.client,
          r.guest,
          r.table_label,
          r.mode,
          r.channel,
          modeLabels?.[r.mode],
          SHOP_CHANNEL_LABELS[r.channel],
          r.status,
          statusLabels[r.status],
        ]
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
  }, [tableRows, tableFilter, statusFilter, sortKey, sortDir, statusLabels, modeLabels]);

  const serviceBars = (isOrderLike ? data?.by_item || [] : data?.by_service || [])
    .slice(0, 10)
    .map((s) => ({
      id: s.id ?? s.name,
      label: s.name,
      value: s.count,
    }));

  const staffBars = (data?.by_staff || []).slice(0, 10).map((s) => ({
    id: s.id ?? "none",
    label: s.name,
    value: s.count,
  }));

  const modeBars = (data?.by_mode_detail || []).map((m) => ({
    id: m.mode,
    label: modeLabels?.[m.mode] || m.mode,
    value: m.count,
  }));

  const channelBars = (data?.by_channel || []).map((c) => ({
    id: c.channel,
    label: SHOP_CHANNEL_LABELS[c.channel] || c.channel,
    value: c.count,
  }));

  const ratingBars = Object.entries(data?.rating_histogram || {})
    .map(([k, v]) => ({ label: `${k}★`, value: v, id: k }))
    .sort((a, b) => Number(b.id) - Number(a.id));

  const periodLabel = `${new Date(`${appliedFrom}T12:00:00`).toLocaleDateString("ru-RU")} – ${new Date(`${appliedTo}T12:00:00`).toLocaleDateString("ru-RU")}`;

  const widgetOptions = isShop
    ? [
        ["kpis", "Сводка"],
        ["statuses", "По статусам"],
        ["modes", "По режимам"],
        ["bookingsChart", "Заказы по дням"],
        ["revenueChart", "Выручка по дням"],
        ["servicesChart", "Топ товаров"],
        ["channels", "По каналам доставки"],
        ["table", "Таблица заказов"],
      ]
    : isCafe
      ? [
          ["kpis", "Сводка"],
          ["statuses", "По статусам"],
          ["modes", "По режимам"],
          ["bookingsChart", "Заказы по дням"],
          ["revenueChart", "Выручка по дням"],
          ["servicesChart", "Топ блюд"],
          ["ratingsChart", "Оценки блюд"],
          ["table", "Таблица заказов"],
        ]
      : [
          ["kpis", "Сводка"],
          ["statuses", "По статусам"],
          ["bookingsChart", "Записи по дням"],
          ["revenueChart", "Выручка по дням"],
          ["servicesChart", "По услугам"],
          ["staffChart", "По мастерам"],
          ["ratingsChart", "Оценки"],
          ["table", "Таблица записей"],
        ];

  const tableColumns = isShop
    ? [
        ["created_at", "Создан"],
        ["status", "Статус"],
        ["mode", "Режим"],
        ["channel", "Канал"],
        ["guest", "Гость"],
        ["total", "Сумма"],
      ]
    : isCafe
      ? [
          ["created_at", "Создан"],
          ["status", "Статус"],
          ["mode", "Режим"],
          ["table_label", "Стол"],
          ["guest", "Гость"],
          ["total", "Сумма"],
        ]
      : [
          ["created_at", "Создана"],
          ["status", "Статус"],
          ["service", "Услуга"],
          ["staff", "Мастер"],
          ["client", "Клиент"],
          ["price", "Цена"],
        ];

  const pageSubtitle = isShop
    ? "Заказы, выручка и возвраты"
    : isCafe
      ? "Заказы, выручка и оценки блюд"
      : "Записи, выручка и отзывы";

  const ordersChartTitle = isOrderLike ? "Заказы по дням" : "Записи по дням";
  const servicesChartTitle = isShop ? "Топ товаров" : isCafe ? "Топ блюд" : "Топ услуг";
  const tableTitle = isOrderLike ? "Заказы" : "Записи";
  const emptyTableText = isOrderLike ? "Нет заказов" : "Нет записей";

  return (
    <section className="card full-width analytics-page">
      <div className="analytics-head">
        <div>
          <h2>Аналитика</h2>
          <p className="muted small">
            {pageSubtitle} · {periodLabel}
          </p>
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
          {widgetOptions.map(([key, label]) => (
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
            <span className="analytics-kpi-label">{isOrderLike ? "Заказов" : "Записей"}</span>
            <strong>{isOrderLike ? data.totals.orders : data.totals.bookings}</strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">{isOrderLike ? "Выручка" : "Выручка (выполнено)"}</span>
            <strong>{Math.round(data.totals.revenue_estimate).toLocaleString("ru-RU")} ₽</strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">
              {isOrderLike ? "Средний чек" : "Средняя оценка"}
            </span>
            <strong>
              {isOrderLike
                ? `${Math.round(data.totals.average_check || 0).toLocaleString("ru-RU")} ₽`
                : data.totals.average_rating || "—"}
            </strong>
          </div>
          <div className="analytics-kpi">
            <span className="analytics-kpi-label">
              {isShop ? "Возвраты" : isCafe ? "Оценок блюд" : "Отзывов"}
            </span>
            <strong>
              {isShop ? (
                <>
                  {data.totals.returns_count || 0}
                  {data.totals.returns_approved ? ` · одобрено ${data.totals.returns_approved}` : ""}
                </>
              ) : isCafe ? (
                <>
                  {data.totals.ratings_count || 0}
                  {data.totals.average_rating ? ` · ${data.totals.average_rating}` : ""}
                </>
              ) : (
                data.totals.reviews_count
              )}
            </strong>
          </div>
        </div>
      )}

      {widgets.statuses && data?.totals?.by_status && (
        <div className="analytics-panel analytics-status-panel">
          <h3>По статусам</h3>
          <div className="analytics-status-grid">
            {Object.entries(data.totals.by_status).map(([st, cnt]) => (
              <div key={st} className="analytics-kpi analytics-kpi--sm">
                <span className="analytics-kpi-label">{statusLabels[st] || st}</span>
                <strong>{cnt}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {isOrderLike && widgets.modes && modeBars.length ? (
        <div className="analytics-panel">
          <h3>По режимам</h3>
          <BarChart items={modeBars} color="#2f5d50" />
        </div>
      ) : null}

      <div className="analytics-grid">
        {widgets.bookingsChart && (
          <div className="analytics-panel">
            <h3>{ordersChartTitle}</h3>
            <LineChart points={data?.by_day || []} valueKey={isOrderLike ? "orders" : "bookings"} color="#1f6feb" />
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
            <h3>{servicesChartTitle}</h3>
            <BarChart items={serviceBars} color="#1f6feb" />
          </div>
        )}
        {!isOrderLike && widgets.staffChart && (
          <div className="analytics-panel">
            <h3>По мастерам</h3>
            <BarChart items={staffBars} color="#c45c26" />
          </div>
        )}
        {isShop && widgets.channels && (
          <div className="analytics-panel">
            <h3>По каналам доставки</h3>
            <BarChart items={channelBars} color="#6b4c9a" />
          </div>
        )}
        {!isShop && widgets.ratingsChart && (
          <div className="analytics-panel">
            <h3>{isCafe ? "Оценки блюд" : "Распределение оценок"}</h3>
            <BarChart items={ratingBars} color="#d4a017" />
          </div>
        )}
      </div>

      {widgets.table && (
        <div className="analytics-panel analytics-table-wrap">
          <div className="analytics-table-toolbar">
            <h3>{tableTitle}</h3>
            <input
              type="search"
              placeholder="Поиск…"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              {Object.entries(statusLabels).map(([k, v]) => (
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
                  {tableColumns.map(([key, label]) => (
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
                      {emptyTableText}
                    </td>
                  </tr>
                ) : isShop ? (
                  filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}</td>
                      <td>{statusLabels[r.status] || r.status}</td>
                      <td>{SHOP_MODE_LABELS[r.mode] || r.mode}</td>
                      <td>{SHOP_CHANNEL_LABELS[r.channel] || r.channel || "—"}</td>
                      <td>{r.guest || "—"}</td>
                      <td>{Math.round(r.total || 0).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))
                ) : isCafe ? (
                  filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}</td>
                      <td>{statusLabels[r.status] || r.status}</td>
                      <td>{CAFE_MODE_LABELS[r.mode] || r.mode}</td>
                      <td>{r.table_label || "—"}</td>
                      <td>{r.guest || "—"}</td>
                      <td>{Math.round(r.total || 0).toLocaleString("ru-RU")} ₽</td>
                    </tr>
                  ))
                ) : (
                  filteredRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.created_at ? new Date(r.created_at).toLocaleString("ru-RU") : "—"}</td>
                      <td>{statusLabels[r.status] || r.status}</td>
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

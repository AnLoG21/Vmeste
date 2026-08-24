import { useCallback, useEffect, useMemo, useState } from "react";

const BOOKING_STATUS = {
  new: "Новая",
  confirmed: "Подтверждена",
  arrived: "Клиент пришёл",
  no_show: "Неявка",
  cancelled: "Отменена",
  done: "Выполнена",
};

const CAFE_STATUS = {
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  accepted: "Принят",
  cooking: "Готовится",
  ready: "Готов",
  to_courier: "Передаём курьеру",
  delivering: "В пути",
  done: "Завершён",
  cancelled: "Отменён",
};

function parseTs(iso) {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

/**
 * Единая лента клиента: записи, заказы кафе, приёмки, лояльность.
 */
export default function ClientActivityFeed({ authFetch, API_URL, onNavigate, onRebook }) {
  const [tab, setTab] = useState("all");
  const [bookings, setBookings] = useState([]);
  const [cafeOrders, setCafeOrders] = useState([]);
  const [inspections, setInspections] = useState([]);
  const [loyalty, setLoyalty] = useState([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus("");
    try {
      const [bRes, cRes, iRes, lRes] = await Promise.all([
        authFetch(`${API_URL}/booking/`),
        authFetch(`${API_URL}/cafe/my-orders/`),
        authFetch(`${API_URL}/inspections/reports/`),
        authFetch(`${API_URL}/booking/loyalty/accounts/`),
      ]);
      if (bRes.ok) {
        const data = await bRes.json();
        setBookings(Array.isArray(data) ? data : data?.results || []);
      }
      if (cRes.ok) {
        const data = await cRes.json();
        setCafeOrders(Array.isArray(data) ? data : []);
      }
      if (iRes.ok) {
        const data = await iRes.json();
        setInspections(Array.isArray(data) ? data : data?.results || []);
      }
      if (lRes.ok) {
        const data = await lRes.json();
        setLoyalty(Array.isArray(data) ? data : []);
      }
    } catch {
      setStatus("Не удалось загрузить ленту.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, API_URL]);

  useEffect(() => {
    load();
  }, [load]);

  const items = useMemo(() => {
    const rows = [];
    for (const b of bookings) {
      rows.push({
        id: `b-${b.id}`,
        kind: "booking",
        at: parseTs(b.created_at || b.slot_starts_at || b.starts_at),
        title: b.organization_name || b.provider_name || "Запись",
        subtitle: [b.service_name, BOOKING_STATUS[b.status] || b.status].filter(Boolean).join(" · "),
        view: "bookings",
        booking: b,
        canRebook: b.status === "done" || b.status === "cancelled" || b.status === "no_show",
      });
    }
    for (const o of cafeOrders) {
      rows.push({
        id: `c-${o.id}`,
        kind: "cafe",
        at: parseTs(o.created_at || o.updated_at),
        title: o.organization_name || "Заказ из ресторана",
        subtitle: [`#${o.id}`, CAFE_STATUS[o.status] || o.status, o.total != null ? `${o.total} ₽` : ""]
          .filter(Boolean)
          .join(" · "),
        view: "cafe_my_orders",
      });
    }
    for (const r of inspections) {
      rows.push({
        id: `i-${r.id}`,
        kind: "inspection",
        at: parseTs(r.created_at || r.updated_at),
        title: r.provider_name || r.organization_name || "Приёмка авто",
        subtitle: [r.vehicle_label || r.plate || "", r.status_label || r.status || ""].filter(Boolean).join(" · "),
        view: "inspections",
      });
    }
    for (const a of loyalty) {
      rows.push({
        id: `l-${a.provider || a.id}`,
        kind: "loyalty",
        at: parseTs(a.updated_at) || 1,
        title: a.provider_name || "Лояльность",
        subtitle: `${a.points ?? a.balance ?? 0} баллов${a.level_label ? ` · ${a.level_label}` : ""}`,
        view: "loyalty",
      });
    }
    rows.sort((x, y) => y.at - x.at);
    if (tab === "all") return rows;
    return rows.filter((r) => r.kind === tab);
  }, [bookings, cafeOrders, inspections, loyalty, tab]);

  const tabs = [
    ["all", "Все"],
    ["booking", "Записи"],
    ["cafe", "Кафе"],
    ["inspection", "Приёмки"],
    ["loyalty", "Лояльность"],
  ];

  return (
    <section className="card full-width client-activity-feed">
      <div className="client-activity-feed-head">
        <h2>Моё</h2>
        <button type="button" className="ghost-btn" onClick={load} disabled={loading}>
          Обновить
        </button>
      </div>
      <p className="muted">Записи, заказы, приёмки и лояльность в одной ленте.</p>
      <div className="client-activity-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "is-active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {status && <p className="status">{status}</p>}
      {loading && !items.length ? (
        <p className="muted">Загрузка…</p>
      ) : items.length === 0 ? (
        <p className="muted">Пока пусто — записи и заказы появятся здесь.</p>
      ) : (
        <ul className="list client-activity-list">
          {items.map((item) => (
            <li key={item.id}>
              <div className="client-activity-row-wrap">
                <button
                  type="button"
                  className="client-activity-row"
                  onClick={() => onNavigate?.(item.view)}
                >
                  <span className={`client-activity-kind client-activity-kind--${item.kind}`}>
                    {item.kind === "booking"
                      ? "Запись"
                      : item.kind === "cafe"
                        ? "Кафе"
                        : item.kind === "inspection"
                          ? "Приёмка"
                          : "Баллы"}
                  </span>
                  <span className="client-activity-body">
                    <strong>{item.title}</strong>
                    <span className="muted small">{item.subtitle}</span>
                  </span>
                  <span className="muted small client-activity-when">{formatWhen(item.at)}</span>
                </button>
                {item.canRebook && (onRebook || onNavigate) ? (
                  <button
                    type="button"
                    className="ghost-btn small"
                    onClick={() => (onRebook ? onRebook(item.booking) : onNavigate?.("client_map"))}
                  >
                    Повторить
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="client-activity-shortcuts">
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.("bookings")}>
          Все записи
        </button>
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.("cafe_my_orders")}>
          Заказы кафе
        </button>
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.("loyalty")}>
          Лояльность
        </button>
        <button type="button" className="ghost-btn" onClick={() => onNavigate?.("inspections")}>
          Приёмки
        </button>
      </div>
    </section>
  );
}

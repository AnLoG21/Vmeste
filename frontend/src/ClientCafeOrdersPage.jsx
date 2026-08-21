import { useCallback, useEffect, useMemo, useState } from "react";
import CafeOrderMapPin, { yandexMapsPinUrl } from "./CafeOrderMapPin.jsx";
import "./cafeGuest.css";

const STATUS_FLOW = [
  "awaiting_payment",
  "paid",
  "accepted",
  "cooking",
  "ready",
  "to_courier",
  "delivering",
  "done",
];

const statusLabels = {
  draft: "Черновик",
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

const modeLabels = { dine_in: "За столом", takeaway: "Самовывоз", delivery: "Доставка" };

function statusIndex(status) {
  const i = STATUS_FLOW.indexOf(status);
  return i < 0 ? -1 : i;
}

/**
 * Клиентский список заказов из кафе/ресторанов.
 */
export default function ClientCafeOrdersPage({ authFetch, API_URL }) {
  const [orders, setOrders] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("");
  const [ratingBusy, setRatingBusy] = useState(null);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/cafe/my-orders/`);
    if (!res.ok) {
      setStatus("Не удалось загрузить заказы.");
      return;
    }
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setStatus("");
  }, [authFetch, API_URL]);

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [load]);

  const selected = useMemo(
    () => orders.find((o) => Number(o.id) === Number(selectedId)) || null,
    [orders, selectedId],
  );

  async function rateItem(orderId, menuItemId, rating) {
    setRatingBusy(`${orderId}-${menuItemId}`);
    // Guest rate API needs session; for logged-in client we reuse same endpoint if session unknown —
    // fall back to org review later. For now try my-orders detail only display.
    setStatus("Оценки блюд доступны из меню заказа в заведении; скоро добавим сюда.");
    setRatingBusy(null);
  }

  if (selected) {
    const cur = statusIndex(selected.status);
    const flow =
      selected.mode === "delivery"
        ? STATUS_FLOW
        : STATUS_FLOW.filter((s) => s !== "to_courier" && s !== "delivering");
    const active = !["done", "cancelled"].includes(selected.status);

    return (
      <section className="card full-width client-cafe-orders">
        <button type="button" className="ghost-btn" onClick={() => setSelectedId(null)}>
          ← К списку заказов
        </button>
        <h2>
          Заказ #{selected.id} · {selected.organization_name || "Ресторан"}
        </h2>
        <p className="muted">
          {modeLabels[selected.mode] || selected.mode} · {Number(selected.total).toLocaleString("ru-RU")} ₽ ·{" "}
          {statusLabels[selected.status] || selected.status}
        </p>

        <ol className="cafe-status-timeline">
          {flow.map((st) => {
            const idx = statusIndex(st);
            let cls = "is-upcoming";
            if (selected.status === "cancelled") cls = st === "cancelled" ? "is-current" : "is-past";
            else if (cur > idx) cls = "is-past";
            else if (cur === idx) cls = "is-current";
            return (
              <li key={st} className={`cafe-status-timeline-item ${cls}`}>
                <span className="cafe-status-timeline-dot" />
                <span>{statusLabels[st]}</span>
              </li>
            );
          })}
        </ol>

        {selected.mode === "delivery" && selected.delivery_address ? (
          <div className="cafe-order-delivery-block">
            <p>
              <strong>Адрес:</strong> {selected.delivery_address}
            </p>
            {selected.delivery_lat != null && selected.delivery_lon != null ? (
              <>
                <CafeOrderMapPin
                  lat={selected.delivery_lat}
                  lon={selected.delivery_lon}
                  courierLat={active ? selected.courier_lat : null}
                  courierLon={active ? selected.courier_lon : null}
                  height={220}
                />
                <a
                  className="landing-btn landing-btn--ghost"
                  href={yandexMapsPinUrl(selected.delivery_lat, selected.delivery_lon)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в Яндекс.Картах
                </a>
                {active && selected.courier_lat != null ? (
                  <p className="muted small">На карте синяя метка — курьер (обновляется рестораном).</p>
                ) : active && (selected.status === "delivering" || selected.status === "to_courier") ? (
                  <p className="muted small">Местоположение курьера появится, когда ресторан его обновит.</p>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}

        <ul className="cafe-order-items">
          {(selected.items || []).map((i) => (
            <li key={i.id}>
              <strong>{i.name}</strong> × {i.quantity}
              {selected.can_rate && i.menu_item ? (
                <span className="cafe-rate-inline">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className="ghost-btn"
                      disabled={ratingBusy === `${selected.id}-${i.menu_item}`}
                      onClick={() => rateItem(selected.id, i.menu_item, n)}
                    >
                      {n}★
                    </button>
                  ))}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {status ? <p className="status">{status}</p> : null}
      </section>
    );
  }

  return (
    <section className="card full-width client-cafe-orders">
      <h2>Заказы из ресторанов</h2>
      <p className="muted small">Статусы и доставка по вашим заказам кафе.</p>
      {orders.length === 0 ? <p className="muted">Пока нет заказов.</p> : null}
      <ul className="client-cafe-order-list">
        {orders.map((o) => (
          <li key={o.id}>
            <button type="button" className="client-cafe-order-row" onClick={() => setSelectedId(o.id)}>
              <strong>
                #{o.id} · {o.organization_name || "Ресторан"}
              </strong>
              <span>
                {statusLabels[o.status] || o.status} · {Number(o.total).toLocaleString("ru-RU")} ₽
              </span>
              <span className="muted small">
                {modeLabels[o.mode] || o.mode}
                {o.delivery_address ? ` · ${o.delivery_address}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

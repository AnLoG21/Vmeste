import { useCallback, useEffect, useMemo, useState } from "react";
import CafeOrderMapPin, { yandexMapsPinUrl } from "./CafeOrderMapPin.jsx";
import { hasCoords } from "./geoPosition.js";
import OrgReviewComposer, { Stars } from "./OrgReviewComposer.jsx";
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
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [ratingBusy, setRatingBusy] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: "" });
  const [reviewPhotos, setReviewPhotos] = useState([]);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const orderIds = JSON.parse(localStorage.getItem("vmeste_cafe_order_ids") || "[]");
      let guestPhone = localStorage.getItem("vmeste_cafe_guest_phone") || "";
      if (!guestPhone) {
        try {
          for (let i = 0; i < localStorage.length; i += 1) {
            const k = localStorage.key(i);
            if (!k || !k.startsWith("cafe_guest_prefs_")) continue;
            const data = JSON.parse(localStorage.getItem(k) || "null");
            if (data?.guestPhone && String(data.guestPhone).replace(/\D/g, "").length >= 10) {
              guestPhone = data.guestPhone;
              break;
            }
          }
        } catch {
          /* ignore */
        }
      }
      if ((Array.isArray(orderIds) && orderIds.length) || guestPhone) {
        await authFetch(`${API_URL}/cafe/my-orders/`, {
          method: "POST",
          body: JSON.stringify({
            order_ids: Array.isArray(orderIds) ? orderIds : [],
            guest_phone: guestPhone,
          }),
        });
      }
    } catch {
      /* ignore claim errors */
    }
    const res = await authFetch(`${API_URL}/cafe/my-orders/`);
    if (!res.ok) {
      setStatus("Не удалось загрузить заказы.");
      return;
    }
    const data = await res.json();
    setOrders(Array.isArray(data) ? data : []);
    setStatus("");
  }, [authFetch, API_URL]);

  const loadDetail = useCallback(
    async (id) => {
      if (!id) return;
      setDetailLoading(true);
      try {
        const res = await authFetch(`${API_URL}/cafe/my-orders/${id}/`);
        if (!res.ok) {
          setStatus("Не удалось открыть заказ.");
          return;
        }
        const data = await res.json();
        setSelected(data);
        setOrders((prev) => prev.map((o) => (Number(o.id) === Number(data.id) ? { ...o, ...data } : o)));
      } finally {
        setDetailLoading(false);
      }
    },
    [authFetch, API_URL],
  );

  useEffect(() => {
    loadList();
    const t = setInterval(loadList, 20000);
    return () => clearInterval(t);
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return undefined;
    }
    loadDetail(selectedId);
    const t = setInterval(() => loadDetail(selectedId), 12000);
    return () => clearInterval(t);
  }, [selectedId, loadDetail]);

  const ratedMenuIds = useMemo(() => {
    const set = new Set();
    for (const r of selected?.item_ratings || []) {
      if (r.menu_item) set.add(Number(r.menu_item));
    }
    return set;
  }, [selected]);

  async function rateItem(menuItemId, rating) {
    if (!selected?.id) return;
    setRatingBusy(`${selected.id}-${menuItemId}`);
    setStatus("");
    try {
      const res = await authFetch(`${API_URL}/cafe/my-orders/${selected.id}/`, {
        method: "POST",
        body: JSON.stringify({ menu_item: menuItemId, rating }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setStatus(err.detail || err.rating?.[0] || "Не удалось сохранить оценку.");
        return;
      }
      await loadDetail(selected.id);
    } finally {
      setRatingBusy(null);
    }
  }

  async function submitOrgReview() {
    if (!selected?.id || !selected.provider) return;
    setReviewBusy(true);
    setStatus("");
    try {
      const fd = new FormData();
      fd.append("provider", String(selected.provider));
      fd.append("cafe_order", String(selected.id));
      fd.append("rating", String(reviewForm.rating || 5));
      fd.append("text", reviewForm.text || "");
      for (const f of reviewPhotos) fd.append("photos", f);
      const res = await authFetch(`${API_URL}/reviews/`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          err.cafe_order?.[0] ||
          err.rating?.[0] ||
          err.detail ||
          (typeof err === "object" ? Object.values(err).flat()?.[0] : null) ||
          "Не удалось отправить отзыв.";
        setStatus(String(msg));
        return;
      }
      setReviewForm({ rating: 5, text: "" });
      setReviewPhotos([]);
      await loadDetail(selected.id);
      setStatus("Отзыв отправлен.");
    } finally {
      setReviewBusy(false);
    }
  }

  if (selectedId && selected) {
    const cur = statusIndex(selected.status);
    const flow =
      selected.mode === "delivery"
        ? STATUS_FLOW
        : STATUS_FLOW.filter((s) => s !== "to_courier" && s !== "delivering");
    const active = !["done", "cancelled"].includes(selected.status);
    const showCourierTrack = active && (selected.status === "delivering" || selected.status === "to_courier");
    const pinOk = hasCoords(selected.delivery_lat, selected.delivery_lon);
    const courierOk = hasCoords(selected.courier_lat, selected.courier_lon);

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
          {detailLoading ? " · обновление…" : ""}
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

        {selected.mode === "delivery" ? (
          <div className="cafe-order-delivery-block">
            {selected.delivery_address ? (
              <p>
                <strong>Адрес:</strong> {selected.delivery_address}
              </p>
            ) : null}
            {selected.delivery_private_house ? (
              <p className="muted small">Частный дом</p>
            ) : (
              <p className="muted small">
                {[
                  selected.delivery_apartment ? `кв. ${selected.delivery_apartment}` : null,
                  selected.delivery_entrance ? `подъезд ${selected.delivery_entrance}` : null,
                  selected.delivery_intercom ? `домофон ${selected.delivery_intercom}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || null}
              </p>
            )}
            {pinOk ? (
              <>
                <CafeOrderMapPin
                  mapKey={`order-${selected.id}-${selected.courier_updated_at || ""}-${selected.courier_lat}-${selected.courier_lon}`}
                  lat={selected.delivery_lat}
                  lon={selected.delivery_lon}
                  courierLat={active && courierOk ? selected.courier_lat : null}
                  courierLon={active && courierOk ? selected.courier_lon : null}
                  height={240}
                />
                <a
                  className="landing-btn landing-btn--ghost"
                  href={yandexMapsPinUrl(selected.delivery_lat, selected.delivery_lon)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Открыть в Яндекс.Картах
                </a>
                {active && courierOk ? (
                  <p className="muted small">Синяя метка — курьер.</p>
                ) : showCourierTrack ? (
                  <p className="muted small">Местоположение курьера появится, когда ресторан его обновит.</p>
                ) : null}
              </>
            ) : (
              <p className="muted small">Координаты адреса не сохранены — карта недоступна.</p>
            )}
          </div>
        ) : null}

        <ul className="cafe-order-items">
          {(selected.items || []).map((i) => (
            <li key={i.id}>
              <strong>{i.name}</strong> × {i.quantity}
              {selected.can_rate && i.menu_item ? (
                <span className="cafe-rate-inline">
                  <Stars
                    value={
                      (selected.item_ratings || []).find((r) => Number(r.menu_item) === Number(i.menu_item))
                        ?.rating || 0
                    }
                    readOnly={ratedMenuIds.has(Number(i.menu_item))}
                    onChange={(n) => rateItem(i.menu_item, n)}
                  />
                  {ratingBusy === `${selected.id}-${i.menu_item}` ? (
                    <span className="muted small">…</span>
                  ) : null}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {selected.status === "done" ? (
          <section className="cafe-order-review-block">
            <h3>Отзыв о ресторане</h3>
            {selected.has_review && selected.review ? (
              <div className="cafe-order-review-done">
                <Stars value={selected.review.rating || 0} readOnly />
                {selected.review.text ? <p>{selected.review.text}</p> : null}
                {(selected.review.photos || []).length ? (
                  <div className="review-photos">
                    {selected.review.photos.map((p) => (
                      <img key={p.id || p.image} src={p.thumb_url || p.image} alt="" />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="cafe-order-review-form">
                <p className="muted small">Оценка и отзыв доступны после завершения заказа.</p>
                <OrgReviewComposer
                  rating={reviewForm.rating}
                  text={reviewForm.text}
                  onRatingChange={(rating) => setReviewForm((p) => ({ ...p, rating }))}
                  onTextChange={(text) => setReviewForm((p) => ({ ...p, text }))}
                  photos={reviewPhotos}
                  onPhotosChange={setReviewPhotos}
                  busy={reviewBusy}
                  onSubmit={submitOrgReview}
                  placeholder="Текст отзыва (необязательно)"
                />
              </div>
            )}
          </section>
        ) : null}

        {status ? <p className="status">{status}</p> : null}
      </section>
    );
  }

  if (selectedId && !selected) {
    return (
      <section className="card full-width client-cafe-orders">
        <button type="button" className="ghost-btn" onClick={() => setSelectedId(null)}>
          ← К списку заказов
        </button>
        <p className="muted">{detailLoading ? "Загрузка заказа…" : "Заказ не найден."}</p>
      </section>
    );
  }

  return (
    <section className="card full-width client-cafe-orders">
      <h2>Заказы из ресторанов</h2>
      <p className="muted small">
        Статусы и доставка по вашим заказам. Чтобы увидеть прошлые заказы, укажите в профиле тот же телефон,
        что при оформлении, или оформите заказ будучи в аккаунте.
      </p>
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

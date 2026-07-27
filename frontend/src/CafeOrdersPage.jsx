import { useCallback, useEffect, useRef, useState } from "react";
import "./cafeGuest.css";
import "./cafeProvider.css";

const modeLabels = { dine_in: "За столом", takeaway: "Самовывоз", delivery: "Доставка" };
const statusLabels = {
  draft: "Черновик",
  awaiting_payment: "Ожидает оплаты",
  paid: "Оплачен",
  accepted: "Принят",
  cooking: "Готовится",
  ready: "Готов",
  delivering: "Доставляется",
  done: "Завершён",
  cancelled: "Отменён",
};

function playBeep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 180);
  } catch {
    /* ignore */
  }
}

export default function CafeOrdersPage({ authFetch, API_URL }) {
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const knownIds = useRef(new Set());
  const primed = useRef(false);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/cafe/orders/`);
    if (!res.ok) {
      setStatus("Не удалось загрузить заказы");
      return;
    }
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    if (primed.current) {
      const fresh = list.filter((o) => !knownIds.current.has(o.id));
      if (fresh.length) playBeep();
    } else {
      primed.current = true;
    }
    knownIds.current = new Set(list.map((o) => o.id));
    setOrders(list);
    setStatus("");
  }, [API_URL, authFetch]);

  useEffect(() => {
    load();
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [load]);

  async function setOrderStatus(id, next) {
    await authFetch(`${API_URL}/cafe/orders/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await load();
  }

  return (
    <section className="card full-width cafe-provider">
      <h2>Заказы</h2>
      <p className="muted">Новые заказы подхватываются автоматически (звук уведомления).</p>
      <div className="cafe-tables-list">
        {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : null}
        {orders.map((o) => (
          <div key={o.id} className="cafe-guest-card">
            <strong>
              #{o.id} · {modeLabels[o.mode] || o.mode} · {statusLabels[o.status] || o.status}
            </strong>
            <p>
              {o.table_label ? `Стол: ${o.table_label} · ` : null}
              {Number(o.total).toLocaleString("ru-RU")} ₽ · {o.pay_method}
              {o.guest_phone ? ` · ${o.guest_phone}` : ""}
            </p>
            <ul>
              {(o.items || []).map((i) => (
                <li key={i.id}>
                  {i.name} × {i.quantity}
                </li>
              ))}
            </ul>
            <div className="cafe-toolbar">
              {["accepted", "cooking", "ready", "done", "cancelled"].map((st) => (
                <button key={st} type="button" className="ghost-btn" onClick={() => setOrderStatus(o.id, st)}>
                  {statusLabels[st]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const STATUS_ACTIONS = ["accepted", "cooking", "ready", "done", "cancelled"];

function formatGuestPhone(phone) {
  const raw = String(phone || "").trim();
  if (!raw) return "";
  // Не показываем «голый» префикс +7 без номера
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits === "7" || digits === "8") return "";
  return raw;
}

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
  const [tab, setTab] = useState("orders");
  const [orders, setOrders] = useState([]);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [floorId, setFloorId] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [status, setStatus] = useState("");
  const [menuQuery, setMenuQuery] = useState("");
  const [draftCart, setDraftCart] = useState({});
  const [draftRemoved, setDraftRemoved] = useState({});
  const [orderOpen, setOrderOpen] = useState(false);
  const knownIds = useRef(new Set());
  const primed = useRef(false);

  const floor = floors.find((f) => f.id === floorId) || floors[0] || null;
  const selectedTable = (floor?.tables || []).find((t) => t.id === selectedTableId) || null;

  const loadOrders = useCallback(async () => {
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

  const loadFloorAndMenu = useCallback(async () => {
    const [fRes, mRes] = await Promise.all([
      authFetch(`${API_URL}/cafe/floors/`),
      authFetch(`${API_URL}/cafe/menu/categories/`),
    ]);
    if (fRes.ok) {
      const floorsData = await fRes.json();
      setFloors(floorsData);
      setFloorId((prev) => prev || floorsData[0]?.id || null);
    }
    if (mRes.ok) setCategories(await mRes.json());
  }, [API_URL, authFetch]);

  useEffect(() => {
    loadOrders();
    loadFloorAndMenu();
    const t = setInterval(loadOrders, 8000);
    return () => clearInterval(t);
  }, [loadOrders, loadFloorAndMenu]);

  const tableOrders = useMemo(() => {
    if (!selectedTableId) return [];
    return orders.filter(
      (o) =>
        o.table === selectedTableId &&
        !["done", "cancelled", "draft"].includes(o.status),
    );
  }, [orders, selectedTableId]);

  const menuItems = useMemo(() => {
    const q = menuQuery.trim().toLowerCase();
    const items = [];
    for (const cat of categories) {
      for (const item of cat.items || []) {
        if (!item.is_active || item.is_available === false) continue;
        if (q && !String(item.name || "").toLowerCase().includes(q)) continue;
        items.push(item);
      }
    }
    return items;
  }, [categories, menuQuery]);

  async function setOrderStatus(id, next) {
    await authFetch(`${API_URL}/cafe/orders/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await loadOrders();
    await loadFloorAndMenu();
  }

  async function patchTable(id, patch) {
    const res = await authFetch(`${API_URL}/cafe/tables/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) await loadFloorAndMenu();
  }

  function addDraft(itemId, delta = 1) {
    setDraftCart((prev) => {
      const next = { ...prev, [itemId]: Math.max(0, (prev[itemId] || 0) + delta) };
      if (next[itemId] === 0) delete next[itemId];
      return next;
    });
  }

  function toggleDraftRemoved(itemId, name) {
    setDraftRemoved((prev) => {
      const list = prev[itemId] || [];
      const nextList = list.includes(name) ? list.filter((x) => x !== name) : [...list, name];
      return { ...prev, [itemId]: nextList };
    });
  }

  async function submitWaiterOrder(e) {
    e.preventDefault();
    if (!selectedTable) return;
    const items = Object.entries(draftCart).map(([menu_item, quantity]) => ({
      menu_item: Number(menu_item),
      quantity,
      removed_ingredients: draftRemoved[menu_item] || [],
    }));
    if (!items.length) {
      setStatus("Добавьте блюда");
      return;
    }
    setStatus("Сохраняем заказ…");
    const res = await authFetch(`${API_URL}/cafe/orders/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        table: selectedTable.id,
        guest_count: selectedTable.guest_count || 0,
        pay_method: "cash",
        items,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || data.items?.[0] || data.table?.[0] || "Ошибка заказа");
      return;
    }
    setDraftCart({});
    setDraftRemoved({});
    setOrderOpen(false);
    setExpandedOrderId(data.id);
    setStatus("");
    await loadOrders();
    await loadFloorAndMenu();
  }

  return (
    <section className="card full-width cafe-provider">
      <h2>Заказы и посадка</h2>
      <div className="cafe-provider-tabs">
        {[
          ["orders", "Заказы"],
          ["seating", "Посадка"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`ghost-btn${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <>
          <p className="muted">Новые заказы подхватываются автоматически (звук уведомления).</p>
          <div className="cafe-tables-list">
            {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : null}
            {orders.map((o) => {
              const open = expandedOrderId === o.id;
              const phone = formatGuestPhone(o.guest_phone);
              return (
                <div key={o.id} className={`cafe-order-card cafe-order-status-${o.status}`}>
                  <button
                    type="button"
                    className="cafe-order-card-head"
                    onClick={() => setExpandedOrderId(open ? null : o.id)}
                  >
                    <strong>
                      #{o.id} · {modeLabels[o.mode] || o.mode}
                    </strong>
                    <span className={`cafe-order-badge cafe-order-badge--${o.status}`}>
                      {statusLabels[o.status] || o.status}
                    </span>
                  </button>
                  <p className="cafe-order-meta">
                    {o.table_label ? `Стол: ${o.table_label} · ` : null}
                    {Number(o.total).toLocaleString("ru-RU")} ₽
                    {phone ? ` · ${phone}` : ""}
                  </p>
                  {open ? (
                    <>
                      <ul className="cafe-order-items">
                        {(o.items || []).map((i) => (
                          <li key={i.id}>
                            <strong>{i.name}</strong> × {i.quantity}
                            {(i.removed_ingredients || []).length ? (
                              <span className="muted small"> без: {(i.removed_ingredients || []).join(", ")}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      <div className="cafe-toolbar">
                        {STATUS_ACTIONS.map((st) => (
                          <button key={st} type="button" className="ghost-btn" onClick={() => setOrderStatus(o.id, st)}>
                            {statusLabels[st]}
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {tab === "seating" ? (
        <div className="cafe-seating">
          <div className="cafe-toolbar">
            {(floors || []).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`ghost-btn${floor?.id === f.id ? " is-active" : ""}`}
                onClick={() => {
                  setFloorId(f.id);
                  setSelectedTableId(null);
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
          {!floor ? <p className="muted">Сначала создайте зал во вкладке «Зал и меню».</p> : null}
          {floor ? (
            <div className="cafe-seating-grid">
              {(floor.tables || []).map((t) => {
                const openOrders = orders.filter(
                  (o) => o.table === t.id && !["done", "cancelled", "draft"].includes(o.status),
                );
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`cafe-seat-card${t.is_occupied ? " is-busy" : " is-free"}${selectedTableId === t.id ? " is-selected" : ""}`}
                    onClick={() => {
                      setSelectedTableId(t.id);
                      setOrderOpen(false);
                    }}
                  >
                    <strong>{t.label}</strong>
                    <span>{t.is_occupied ? "Занят" : "Свободен"}</span>
                    <span className="muted small">
                      {t.guest_count ? `${t.guest_count} гост.` : "0 гост."}
                      {openOrders.length ? ` · заказов: ${openOrders.length}` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedTable ? (
            <div className="cafe-guest-card cafe-seat-panel">
              <h3>{selectedTable.label}</h3>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(selectedTable.is_occupied)}
                  onChange={(e) =>
                    patchTable(selectedTable.id, {
                      is_occupied: e.target.checked,
                      guest_count: e.target.checked ? selectedTable.guest_count || 1 : 0,
                    })
                  }
                />
                <span>Стол занят</span>
              </label>
              <label>
                Гостей
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={selectedTable.guest_count || 0}
                  onChange={(e) =>
                    patchTable(selectedTable.id, {
                      guest_count: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                      is_occupied: Number(e.target.value) > 0 ? true : selectedTable.is_occupied,
                    })
                  }
                />
              </label>
              <div className="cafe-toolbar">
                <button type="button" onClick={() => setOrderOpen(true)}>
                  Записать заказ
                </button>
              </div>

              {tableOrders.length ? (
                <div className="cafe-tables-list">
                  <h4>Заказы за столом</h4>
                  {tableOrders.map((o) => (
                    <div key={o.id} className={`cafe-order-card cafe-order-status-${o.status}`}>
                      <button
                        type="button"
                        className="cafe-order-card-head"
                        onClick={() => setExpandedOrderId(expandedOrderId === o.id ? null : o.id)}
                      >
                        <strong>#{o.id}</strong>
                        <span className={`cafe-order-badge cafe-order-badge--${o.status}`}>
                          {statusLabels[o.status] || o.status}
                        </span>
                      </button>
                      {expandedOrderId === o.id ? (
                        <ul className="cafe-order-items">
                          {(o.items || []).map((i) => (
                            <li key={i.id}>
                              {i.name} × {i.quantity}
                              {(i.removed_ingredients || []).length
                                ? ` (без: ${(i.removed_ingredients || []).join(", ")})`
                                : ""}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">Активных заказов за столом нет.</p>
              )}

              {orderOpen ? (
                <form className="cafe-waiter-order" onSubmit={submitWaiterOrder}>
                  <h4>Новый заказ</h4>
                  <input
                    placeholder="Поиск блюда…"
                    value={menuQuery}
                    onChange={(e) => setMenuQuery(e.target.value)}
                    autoFocus
                  />
                  <ul className="cafe-waiter-menu">
                    {menuItems.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <span className="muted small"> {Number(item.price).toLocaleString("ru-RU")} ₽</span>
                        </div>
                        <div className="cafe-qty">
                          <button type="button" onClick={() => addDraft(item.id, -1)}>−</button>
                          <span>{draftCart[item.id] || 0}</span>
                          <button type="button" onClick={() => addDraft(item.id, 1)}>+</button>
                        </div>
                        {draftCart[item.id] && (item.removable_ingredients || []).length ? (
                          <div className="cafe-ingredient-chips">
                            {(item.removable_ingredients || []).map((ing) => (
                              <button
                                key={ing.id}
                                type="button"
                                className={`cafe-ingredient-chip${(draftRemoved[item.id] || []).includes(ing.name) ? " is-removed" : ""}`}
                                onClick={() => toggleDraftRemoved(item.id, ing.name)}
                              >
                                {ing.name}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="cafe-toolbar">
                    <button type="submit">Отправить на кухню</button>
                    <button type="button" className="ghost-btn" onClick={() => setOrderOpen(false)}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

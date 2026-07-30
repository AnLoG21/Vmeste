import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CafeFloorCanvas from "./CafeFloorCanvas.jsx";
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
  const digits = raw.replace(/\D/g, "");
  if (!digits || digits === "7" || digits === "8") return "";
  return raw;
}

function cartLineKey(menuItemId, removed = []) {
  return `${menuItemId}:${[...removed].sort().join("|")}`;
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

function OrderExpandButton({ open, onClick }) {
  return (
    <button type="button" className="cafe-order-expand" onClick={onClick} aria-label={open ? "Свернуть" : "Развернуть"}>
      <span className={`cafe-order-expand-arrow${open ? " is-open" : ""}`} aria-hidden>
        ▼
      </span>
    </button>
  );
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
  const [draftLines, setDraftLines] = useState([]);
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
      (o) => o.table === selectedTableId && !["done", "cancelled", "draft"].includes(o.status),
    );
  }, [orders, selectedTableId]);

  const menuById = useMemo(() => {
    const map = {};
    for (const cat of categories) {
      for (const item of cat.items || []) map[item.id] = item;
    }
    return map;
  }, [categories]);

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

  function addDraft(menuItemId, delta = 1) {
    setDraftLines((prev) => {
      const key = cartLineKey(menuItemId, []);
      const idx = prev.findIndex((l) => l.key === key);
      if (idx >= 0) {
        const next = [...prev];
        const qty = Math.max(0, next[idx].quantity + delta);
        if (qty === 0) {
          next.splice(idx, 1);
          return next;
        }
        next[idx] = { ...next[idx], quantity: qty };
        return next;
      }
      if (delta <= 0) return prev;
      return [...prev, { key, menuItemId, quantity: delta, removed: [] }];
    });
  }

  function changeDraftQty(lineKey, delta) {
    setDraftLines((prev) => {
      const idx = prev.findIndex((l) => l.key === lineKey);
      if (idx < 0) return prev;
      const next = [...prev];
      const qty = Math.max(0, next[idx].quantity + delta);
      if (qty === 0) {
        next.splice(idx, 1);
        return next;
      }
      next[idx] = { ...next[idx], quantity: qty };
      return next;
    });
  }

  function toggleDraftRemoved(lineKey, ingredientName) {
    setDraftLines((prev) => {
      const idx = prev.findIndex((l) => l.key === lineKey);
      if (idx < 0) return prev;
      const line = prev[idx];
      const restQty = line.quantity > 1 ? line.quantity - 1 : 0;
      const removed = line.removed.includes(ingredientName)
        ? line.removed.filter((x) => x !== ingredientName)
        : [...line.removed, ingredientName];
      const newKey = cartLineKey(line.menuItemId, removed);
      let next = [...prev];
      if (restQty > 0) next[idx] = { ...line, quantity: restQty };
      else next.splice(idx, 1);
      const dup = next.findIndex((l) => l.key === newKey);
      if (dup >= 0) next[dup] = { ...next[dup], quantity: next[dup].quantity + 1 };
      else next.push({ key: newKey, menuItemId: line.menuItemId, quantity: 1, removed });
      return next;
    });
  }

  async function submitWaiterOrder(e) {
    e.preventDefault();
    if (!selectedTable) return;
    if (!draftLines.length) {
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
        items: draftLines.map((l) => ({
          menu_item: l.menuItemId,
          quantity: l.quantity,
          removed_ingredients: l.removed || [],
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.detail || data.items?.[0] || data.table?.[0] || "Ошибка заказа");
      return;
    }
    setDraftLines([]);
    setOrderOpen(false);
    setExpandedOrderId(data.id);
    setStatus("");
    await loadOrders();
    await loadFloorAndMenu();
  }

  function renderOrderCard(o, compact = false) {
    const open = expandedOrderId === o.id;
    const phone = formatGuestPhone(o.guest_phone);
    return (
      <div key={o.id} className={`cafe-order-card cafe-order-status-${o.status}`}>
        <div className="cafe-order-card-top">
          <div className="cafe-order-card-summary">
            <strong>
              #{o.id}
              {!compact ? ` · ${modeLabels[o.mode] || o.mode}` : ""}
            </strong>
            <span className={`cafe-order-badge cafe-order-badge--${o.status}`}>
              {statusLabels[o.status] || o.status}
            </span>
          </div>
          <OrderExpandButton open={open} onClick={() => setExpandedOrderId(open ? null : o.id)} />
        </div>
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
            {!compact ? (
              <div className="cafe-toolbar">
                {STATUS_ACTIONS.map((st) => (
                  <button key={st} type="button" className="ghost-btn" onClick={() => setOrderStatus(o.id, st)}>
                    {statusLabels[st]}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    );
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
            {orders.map((o) => renderOrderCard(o))}
          </div>
        </>
      ) : null}

      {tab === "seating" ? (
        <div className="cafe-seating">
          <div className="cafe-floor-tabs">
            {(floors || []).map((f) => (
              <div key={f.id} className={`cafe-floor-tab${floor?.id === f.id ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="cafe-floor-tab-name"
                  onClick={() => {
                    setFloorId(f.id);
                    setSelectedTableId(null);
                    setOrderOpen(false);
                  }}
                >
                  {f.name}
                </button>
              </div>
            ))}
          </div>
          {!floor ? <p className="muted">Сначала создайте зал во вкладке «Зал и меню».</p> : null}
          {floor ? (
            <CafeFloorCanvas
              floor={floor}
              selectedTableId={selectedTableId}
              selectedWallId={null}
              selectedZoneId={null}
              tool="move"
              zoom={1}
              selectOnly
              onSelectTable={(id) => {
                setSelectedTableId(id);
                setOrderOpen(false);
                setDraftLines([]);
              }}
              onSelectWall={() => {}}
              onSelectZone={() => {}}
              onPatchFloor={() => {}}
              onPatchTable={() => {}}
            />
          ) : null}

          {selectedTable ? (
            <div className="cafe-guest-card cafe-seat-panel">
              <h3>{selectedTable.label}</h3>
              <div className="cafe-seat-controls">
                <label className="checkbox cafe-seat-occupied">
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
                <label className="cafe-seat-guests">
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
              </div>
              <div className="cafe-toolbar">
                <button
                  type="button"
                  onClick={() => {
                    setOrderOpen(true);
                    setDraftLines([]);
                  }}
                >
                  Записать заказ
                </button>
              </div>

              {tableOrders.length ? (
                <div className="cafe-tables-list">
                  <h4>Заказы за столом</h4>
                  {tableOrders.map((o) => renderOrderCard(o, true))}
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
                    {menuItems.map((item) => {
                      const plainQty = draftLines
                        .filter((l) => l.menuItemId === item.id && !(l.removed || []).length)
                        .reduce((s, l) => s + l.quantity, 0);
                      return (
                        <li key={item.id}>
                          <div>
                            <strong>{item.name}</strong>
                            <span className="muted small"> {Number(item.price).toLocaleString("ru-RU")} ₽</span>
                          </div>
                          <div className="cafe-qty">
                            <button type="button" onClick={() => addDraft(item.id, -1)}>−</button>
                            <span>{plainQty}</span>
                            <button type="button" onClick={() => addDraft(item.id, 1)}>+</button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  {draftLines.length ? (
                    <ul className="cafe-waiter-draft">
                      {draftLines.map((line) => {
                        const item = menuById[line.menuItemId];
                        if (!item) return null;
                        return (
                          <li key={line.key}>
                            <div className="cafe-toolbar" style={{ justifyContent: "space-between" }}>
                              <strong>{item.name}</strong>
                              <div className="cafe-qty">
                                <button type="button" onClick={() => changeDraftQty(line.key, -1)}>−</button>
                                <span>{line.quantity}</span>
                                <button type="button" onClick={() => changeDraftQty(line.key, 1)}>+</button>
                              </div>
                            </div>
                            {(item.removable_ingredients || []).length ? (
                              <div className="cafe-ingredient-chips">
                                {(item.removable_ingredients || []).map((ing) => (
                                  <button
                                    key={ing.id}
                                    type="button"
                                    className={`cafe-ingredient-chip${(line.removed || []).includes(ing.name) ? " is-removed" : ""}`}
                                    onClick={() => toggleDraftRemoved(line.key, ing.name)}
                                  >
                                    {ing.name}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <div className="cafe-toolbar">
                    <button type="submit">Отправить на кухню</button>
                    <button type="button" className="ghost-btn" onClick={() => setOrderOpen(false)}>
                      Отмена
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="muted small">Выберите стол на плане зала.</p>
          )}
        </div>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

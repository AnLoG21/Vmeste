import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CafeFloorCanvas from "./CafeFloorCanvas.jsx";
import CafeOrderMapPin, { yandexMapsPinUrl } from "./CafeOrderMapPin.jsx";
import { getDevicePosition, hasCoords } from "./geoPosition.js";
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
  to_courier: "Передаём курьеру",
  delivering: "В пути",
  done: "Завершён",
  cancelled: "Отменён",
};

const STATUS_ACTIONS = ["accepted", "cooking", "ready", "to_courier", "delivering", "done", "cancelled"];
const KITCHEN_STATUSES = new Set(["paid", "accepted", "cooking", "ready", "awaiting_payment", "to_courier"]);

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

function playBeep(times = 1) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    let i = 0;
    const hit = () => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880 + i * 120;
      gain.gain.value = 0.07;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
        i += 1;
        if (i < times) setTimeout(hit, 90);
        else setTimeout(() => ctx.close().catch(() => {}), 50);
      }, 160);
    };
    hit();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(times > 1 ? [120, 60, 120, 60, 180] : 120);
    }
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

function PrintReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M19 8H5a3 3 0 0 0-3 3v6h4v4h12v-4h4v-6a3 3 0 0 0-3-3zm-3 11H8v-5h8v5zm3-7.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2zM17 3H7v4h10V3z" />
    </svg>
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
  const [ticketOpen, setTicketOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [kitchenBannerOpen, setKitchenBannerOpen] = useState(() => {
    try {
      return window.sessionStorage.getItem("cafe_kitchen_banner_open") !== "0";
    } catch {
      return true;
    }
  });
  const knownIds = useRef(new Set());
  const knownWaiterCalls = useRef(new Set());
  const primed = useRef(false);
  const primedWaiter = useRef(false);

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
      const kitchenNew = fresh.filter((o) => KITCHEN_STATUSES.has(o.status) || o.status === "paid" || o.status === "accepted");
      if (fresh.length && soundOn) playBeep(kitchenNew.length ? 3 : 1);
    } else {
      primed.current = true;
    }
    knownIds.current = new Set(list.map((o) => o.id));
    setOrders(list);
    setStatus("");
  }, [API_URL, authFetch, soundOn]);

  const loadFloorAndMenu = useCallback(async () => {
    const [fRes, mRes] = await Promise.all([
      authFetch(`${API_URL}/cafe/floors/`),
      authFetch(`${API_URL}/cafe/menu/categories/`),
    ]);
    if (fRes.ok) {
      const floorsData = await fRes.json();
      const activeCalls = [];
      for (const f of floorsData || []) {
        for (const t of f.tables || []) {
          if (t.waiter_called_at) activeCalls.push(`${t.id}:${t.waiter_called_at}`);
        }
      }
      if (primedWaiter.current) {
        const fresh = activeCalls.filter((k) => !knownWaiterCalls.current.has(k));
        if (fresh.length && soundOn) {
          playBeep(2);
          try {
            if (typeof Notification !== "undefined" && Notification.permission === "granted") {
              const table = (floorsData || [])
                .flatMap((f) => f.tables || [])
                .find((t) => t.waiter_called_at && fresh.some((k) => k.startsWith(`${t.id}:`)));
              new Notification("Вызов официанта", {
                body: table ? `Стол «${table.label}»` : "Гость вызывает официанта",
              });
            }
          } catch {
            /* ignore */
          }
        }
      } else {
        primedWaiter.current = true;
      }
      knownWaiterCalls.current = new Set(activeCalls);
      setFloors(floorsData);
      setFloorId((prev) => prev || floorsData[0]?.id || null);
    }
    if (mRes.ok) setCategories(await mRes.json());
  }, [API_URL, authFetch, soundOn]);

  useEffect(() => {
    loadOrders();
    loadFloorAndMenu();
    const tOrders = setInterval(loadOrders, 8000);
    const tFloor = setInterval(loadFloorAndMenu, 5000);
    return () => {
      clearInterval(tOrders);
      clearInterval(tFloor);
    };
  }, [loadOrders, loadFloorAndMenu]);

  function toggleKitchenBanner() {
    setKitchenBannerOpen((prev) => {
      const next = !prev;
      try {
        window.sessionStorage.setItem("cafe_kitchen_banner_open", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function printOrderReceipt(orderId) {
    const res = await authFetch(`${API_URL}/cafe/orders/${orderId}/receipt/`);
    if (!res.ok) {
      setStatus("Не удалось получить чек");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      const a = document.createElement("a");
      a.href = url;
      a.download = `cafe-order-${orderId}.pdf`;
      a.click();
    } else {
      window.setTimeout(() => {
        try {
          win.focus();
          win.print();
        } catch {
          /* ignore */
        }
      }, 400);
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  async function ackWaiterCall(tableId) {
    const res = await authFetch(`${API_URL}/cafe/tables/${tableId}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clear_waiter_call: true }),
    });
    if (res.ok) await loadFloorAndMenu();
  }

  const tableOrders = useMemo(() => {
    if (!selectedTableId) return [];
    return orders.filter(
      (o) => o.table === selectedTableId && !["done", "cancelled", "draft"].includes(o.status),
    );
  }, [orders, selectedTableId]);

  const tablesWithOrders = useMemo(() => {
    const set = new Set();
    for (const o of orders) {
      if (o.table && !["done", "cancelled", "draft"].includes(o.status)) set.add(o.table);
    }
    return set;
  }, [orders]);

  const kitchenOrders = useMemo(() => {
    return orders
      .filter((o) => KITCHEN_STATUSES.has(o.status))
      .sort((a, b) => {
        const rank = { cooking: 0, accepted: 1, paid: 2, awaiting_payment: 3, ready: 4 };
        return (rank[a.status] ?? 9) - (rank[b.status] ?? 9) || b.id - a.id;
      });
  }, [orders]);

  const waiterCalls = useMemo(() => {
    const list = [];
    for (const f of floors || []) {
      for (const t of f.tables || []) {
        if (t.waiter_called_at) list.push({ ...t, floorName: f.name });
      }
    }
    return list.sort((a, b) => String(b.waiter_called_at).localeCompare(String(a.waiter_called_at)));
  }, [floors]);

  useEffect(() => {
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      /* ignore */
    }
  }, []);

  const ticketOrders = useMemo(() => {
    if (!ticketOpen || !selectedTableId) return [];
    return orders.filter(
      (o) => o.table === selectedTableId && !["done", "cancelled", "draft"].includes(o.status),
    );
  }, [orders, selectedTableId, ticketOpen]);

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

  async function setOrderStatus(id, next, extra = {}) {
    const res = await authFetch(`${API_URL}/cafe/orders/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, ...extra }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(err.detail || err.status?.[0] || "Не удалось обновить заказ");
      return false;
    }
    await loadOrders();
    await loadFloorAndMenu();
    return true;
  }

  async function updateCourierLocation(order) {
    setStatus("Определяем местоположение…");
    try {
      const { lat, lon } = await getDevicePosition();
      const ok = await setOrderStatus(order.id, order.status, {
        courier_lat: lat,
        courier_lon: lon,
      });
      if (ok) setStatus(`Местоположение курьера обновлено (${lat.toFixed(5)}, ${lon.toFixed(5)})`);
    } catch (e) {
      setStatus(e?.message || "Не удалось получить геолокацию курьера");
    }
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

  function renderOrderCard(o, compact = false, kitchen = false) {
    const open = kitchen || expandedOrderId === o.id;
    const phone = formatGuestPhone(o.guest_phone);
    return (
      <div key={o.id} className={`cafe-order-card cafe-order-status-${o.status}${kitchen ? " cafe-kitchen-card" : ""}`}>
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
          {!kitchen ? (
            <OrderExpandButton open={open} onClick={() => setExpandedOrderId(open ? null : o.id)} />
          ) : null}
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
            {o.comment ? <p className="muted small">Комментарий: {o.comment}</p> : null}
            {o.mode === "delivery" && o.delivery_address ? (
              <div className="cafe-order-delivery-block">
                <p>
                  <strong>Адрес:</strong> {o.delivery_address}
                </p>
                {o.delivery_private_house ? (
                  <p className="muted small">Частный дом</p>
                ) : (
                  <p className="muted small">
                    {[
                      o.delivery_apartment ? `кв. ${o.delivery_apartment}` : null,
                      o.delivery_entrance ? `подъезд ${o.delivery_entrance}` : null,
                      o.delivery_intercom ? `домофон ${o.delivery_intercom}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || null}
                  </p>
                )}
                {o.delivery_fee != null ? (
                  <p className="muted small">Доставка: {Number(o.delivery_fee).toLocaleString("ru-RU")} ₽</p>
                ) : null}
                {hasCoords(o.delivery_lat, o.delivery_lon) ? (
                  <>
                    <CafeOrderMapPin
                      mapKey={`org-order-${o.id}-${o.courier_updated_at || ""}-${o.courier_lat}-${o.courier_lon}`}
                      lat={o.delivery_lat}
                      lon={o.delivery_lon}
                      courierLat={hasCoords(o.courier_lat, o.courier_lon) ? o.courier_lat : null}
                      courierLon={hasCoords(o.courier_lat, o.courier_lon) ? o.courier_lon : null}
                      height={220}
                    />
                    <a
                      className="landing-btn landing-btn--ghost cafe-yandex-maps-btn"
                      href={yandexMapsPinUrl(o.delivery_lat, o.delivery_lon)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Открыть в Яндекс.Картах
                    </a>
                    {(o.status === "to_courier" || o.status === "delivering") ? (
                      <button
                        type="button"
                        className="ghost-btn"
                        onClick={() => updateCourierLocation(o)}
                      >
                        Обновить местоположение курьера
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="cafe-status-actions">
              {(kitchen
                ? ["accepted", "cooking", "ready", "done"]
                : o.mode === "delivery"
                  ? STATUS_ACTIONS
                  : STATUS_ACTIONS.filter((st) => st !== "to_courier" && st !== "delivering")
              ).map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`cafe-status-btn cafe-status-btn--${st}`}
                  onClick={() => setOrderStatus(o.id, st)}
                >
                  {statusLabels[st]}
                </button>
              ))}
              <button
                type="button"
                className="ghost-btn cafe-receipt-btn"
                onClick={() => printOrderReceipt(o.id)}
                title="Печать чека (PDF). Можно отправить на термопринтер или кассу через драйвер печати."
              >
                <PrintReceiptIcon />
                <span>Чек</span>
              </button>
            </div>
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
          ["kitchen", "Кухня"],
          ["seating", "Посадка"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`ghost-btn${tab === id ? " is-active" : ""}`}
            onClick={() => setTab(id)}
          >
            {label}
            {id === "kitchen" && kitchenOrders.length ? ` (${kitchenOrders.length})` : ""}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <>
          <div className="cafe-kitchen-banner">
            <p className="muted" style={{ margin: 0 }}>
              Новые заказы подхватываются автоматически.
            </p>
            <label className="checkbox">
              <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
              <span>Звук новых заказов</span>
            </label>
          </div>
          <div className="cafe-tables-list">
            {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : null}
            {orders.map((o) => renderOrderCard(o))}
          </div>
        </>
      ) : null}

      {tab === "kitchen" ? (
        <>
          <div className={`cafe-kitchen-banner${kitchenBannerOpen ? "" : " is-collapsed"}`}>
            <button type="button" className="cafe-kitchen-banner-toggle" onClick={toggleKitchenBanner}>
              <span className={`cafe-kitchen-banner-arrow${kitchenBannerOpen ? " is-open" : ""}`} aria-hidden>
                ▼
              </span>
              <span>Экран кухни{kitchenOrders.length ? ` · ${kitchenOrders.length}` : ""}</span>
            </button>
            {kitchenBannerOpen ? (
              <div className="cafe-kitchen-banner-body">
                <p className="muted small" style={{ margin: 0 }}>
                  Крупные карточки активных заказов. При новом заказе — тройной сигнал.
                </p>
                <div className="cafe-toolbar" style={{ margin: 0 }}>
                  <label className="checkbox">
                    <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
                    <span>Звук</span>
                  </label>
                  <button type="button" className="ghost-btn" onClick={() => playBeep(3)}>
                    Проверить звук
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => loadOrders()}>
                    Обновить
                  </button>
                </div>
              </div>
            ) : null}
          </div>
          {kitchenOrders.length === 0 ? (
            <div className="cafe-kitchen-empty">
              <p>Нет активных заказов на кухне.</p>
              <p className="muted small">Появятся оплаченные / принятые / готовящиеся.</p>
            </div>
          ) : (
            <div className="cafe-kitchen-grid">{kitchenOrders.map((o) => renderOrderCard(o, false, true))}</div>
          )}
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
          {waiterCalls.length ? (
            <div className="cafe-waiter-alerts">
              {waiterCalls.map((t) => (
                <div key={t.id} className="cafe-waiter-alert" role="status">
                  <span>
                    Вызов официанта · {t.floorName ? `${t.floorName} · ` : ""}
                    {t.label}
                  </span>
                  <button type="button" className="landing-btn landing-btn--primary" onClick={() => ackWaiterCall(t.id)}>
                    Принято
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {floor ? (
            <>
              <div className="cafe-seat-legend" aria-label="Легенда занятости">
                <span>
                  <i className="cafe-seat-dot is-free" aria-hidden /> Свободен
                </span>
                <span>
                  <i className="cafe-seat-dot is-busy" aria-hidden /> Занят
                </span>
                <span className="muted small">Красный «!» — вызов официанта</span>
              </div>
              <CafeFloorCanvas
                floor={floor}
                selectedTableId={selectedTableId}
                selectedWallId={null}
                selectedZoneId={null}
                tool="move"
                zoom={1}
                selectOnly
                showOccupancyColors
                tablesWithOrders={tablesWithOrders}
                onOpenTableTicket={(id) => {
                  setSelectedTableId(id);
                  setTicketOpen(true);
                }}
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
            </>
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
                {selectedTable.waiter_called_at ? (
                  <button type="button" className="landing-btn landing-btn--primary" onClick={() => ackWaiterCall(selectedTable.id)}>
                    Снять вызов официанта
                  </button>
                ) : null}
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setTicketOpen(true)}
                  title="Посмотреть заказ"
                >
                  📋 Заказ
                </button>
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

      {ticketOpen ? (
        <div className="cafe-notepad-modal" onClick={() => setTicketOpen(false)}>
          <div
            className="cafe-notepad"
            role="dialog"
            aria-label="Заказ стола"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cafe-notepad-head">
              <h3>{selectedTable?.label || "Стол"}</h3>
              <button type="button" className="ghost-btn" onClick={() => setTicketOpen(false)} aria-label="Закрыть">
                ✕
              </button>
            </div>
            {!ticketOrders.length ? <p className="muted">Активных заказов нет.</p> : null}
            {ticketOrders.map((o) => (
              <div key={o.id} style={{ marginBottom: 14 }}>
                <p className="muted small">
                  #{o.id} · {statusLabels[o.status] || o.status}
                </p>
                <ul className="cafe-notepad-list">
                  {(o.items || []).map((line) => (
                    <li key={line.id}>
                      <span className="cafe-notepad-item-name">
                        {line.name} × {line.quantity}
                      </span>
                      {(line.removed_ingredients || []).length ? (
                        <span className="cafe-notepad-removed">
                          {(line.removed_ingredients || []).map((name) => `  без ${name}`).join("\n")}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

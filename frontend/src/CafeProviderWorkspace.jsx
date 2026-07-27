import { useCallback, useEffect, useRef, useState } from "react";
import "./cafeGuest.css";
import "./cafeProvider.css";

function TableIcon({ seats = 2, label = "", selected = false }) {
  const n = Math.max(1, Math.min(12, Number(seats) || 2));
  const chairs = [];
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const cx = 40 + Math.cos(angle) * 28;
    const cy = 40 + Math.sin(angle) * 28;
    chairs.push(
      <rect
        key={i}
        x={cx - 5}
        y={cy - 4}
        width="10"
        height="8"
        rx="2"
        fill="#8d5a2b"
        transform={`rotate(${(angle * 180) / Math.PI + 90} ${cx} ${cy})`}
      />,
    );
  }
  return (
    <svg viewBox="0 0 80 80" width="100%" height="100%" aria-hidden="true">
      {chairs}
      <ellipse cx="40" cy="40" rx="18" ry="14" fill={selected ? "#ffd7b0" : "#f0c49a"} stroke="#c45c00" strokeWidth="2.5" />
      <text x="40" y="44" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5a3a22">
        {String(label).slice(0, 8)}
      </text>
    </svg>
  );
}

function qrImageUrl(data, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

const emptyCatForm = { name: "", is_novelties: false };
const emptyItemForm = {
  name: "",
  price: "350",
  composition: "",
  description: "",
  weight_grams: "",
  calories: "",
  is_new: false,
};

/**
 * props: authFetch, API_URL, initialTab?, onTabConsumed?
 */
export default function CafeProviderWorkspace({
  authFetch,
  API_URL,
  initialTab = "floor",
  onTabChange,
}) {
  const [tab, setTab] = useState(initialTab || "floor");
  const [settings, setSettings] = useState(null);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [tool, setTool] = useState("move"); // move | wall | erase
  const [wallDraft, setWallDraft] = useState(null);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [editingCatId, setEditingCatId] = useState(null);
  const [itemFormOpenFor, setItemFormOpenFor] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (initialTab && initialTab !== tab) setTab(initialTab);
  }, [initialTab]);

  function switchTab(id) {
    setTab(id);
    onTabChange?.(id);
  }

  const loadAll = useCallback(async () => {
    const [s, f, m, o] = await Promise.all([
      authFetch(`${API_URL}/cafe/settings/`),
      authFetch(`${API_URL}/cafe/floors/`),
      authFetch(`${API_URL}/cafe/menu/categories/`),
      authFetch(`${API_URL}/cafe/orders/`),
    ]);
    if (s.ok) setSettings(await s.json());
    if (f.ok) {
      const floorsData = await f.json();
      setFloors(floorsData);
      setSelectedFloorId((prev) => prev || floorsData[0]?.id || null);
    }
    if (m.ok) setCategories(await m.json());
    if (o.ok) setOrders(await o.json());
  }, [API_URL, authFetch]);

  useEffect(() => {
    loadAll().catch(() => setStatus("Не удалось загрузить данные кафе"));
  }, [loadAll]);

  const floor = floors.find((x) => x.id === selectedFloorId) || floors[0] || null;
  const selectedTable = (floor?.tables || []).find((t) => t.id === selectedTableId) || null;
  const origin = typeof window !== "undefined" ? window.location.origin : "https://vsevmeste.space";

  async function saveSettings(patch) {
    const res = await authFetch(`${API_URL}/cafe/settings/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings(await res.json());
  }

  async function addFloor() {
    const res = await authFetch(`${API_URL}/cafe/floors/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Зал ${(floors.length || 0) + 1}`, drawings: [] }),
    });
    if (res.ok) {
      const plan = await res.json();
      setFloors((prev) => [...prev, plan]);
      setSelectedFloorId(plan.id);
    }
  }

  async function patchFloor(id, patch) {
    const res = await authFetch(`${API_URL}/cafe/floors/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setFloors((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated, tables: f.tables } : f)));
    }
  }

  async function addTable() {
    if (!floor) return;
    const res = await authFetch(`${API_URL}/cafe/floors/${floor.id}/tables/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `Стол ${(floor.tables?.length || 0) + 1}`,
        x: 60 + (floor.tables?.length || 0) * 24,
        y: 60 + (floor.tables?.length || 0) * 16,
        width: 88,
        height: 88,
        seats: 4,
        rotation: 0,
        pin_code: String(Math.floor(100000 + Math.random() * 900000)),
      }),
    });
    if (res.ok) {
      const table = await res.json();
      setFloors((prev) =>
        prev.map((f) => (f.id === floor.id ? { ...f, tables: [...(f.tables || []), table] } : f)),
      );
      setSelectedTableId(table.id);
    }
  }

  async function patchTable(id, patch) {
    const res = await authFetch(`${API_URL}/cafe/tables/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const updated = await res.json();
      setFloors((prev) =>
        prev.map((f) => ({
          ...f,
          tables: (f.tables || []).map((t) => (t.id === id ? { ...t, ...updated } : t)),
        })),
      );
    }
  }

  async function deleteTable(id) {
    if (!window.confirm("Удалить стол?")) return;
    const res = await authFetch(`${API_URL}/cafe/tables/${id}/`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setFloors((prev) =>
        prev.map((f) => ({ ...f, tables: (f.tables || []).filter((t) => t.id !== id) })),
      );
      if (selectedTableId === id) setSelectedTableId(null);
    }
  }

  function canvasPoint(e) {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const scaleX = (floor?.width || rect.width) / rect.width;
    const scaleY = (floor?.height || rect.height) / rect.height;
    return {
      x: Math.max(0, (e.clientX - rect.left) * scaleX),
      y: Math.max(0, (e.clientY - rect.top) * scaleY),
    };
  }

  function onCanvasMouseDown(e) {
    if (!floor) return;
    if (e.target.closest(".cafe-table-node")) return;
    const p = canvasPoint(e);
    if (tool === "wall") {
      setWallDraft({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      return;
    }
    if (tool === "erase") {
      const drawings = Array.isArray(floor.drawings) ? [...floor.drawings] : [];
      // remove nearest wall endpoint within 24px
      let best = -1;
      let bestDist = 24;
      drawings.forEach((d, idx) => {
        if (d.type !== "wall") return;
        const midX = (d.x1 + d.x2) / 2;
        const midY = (d.y1 + d.y2) / 2;
        const dist = Math.hypot(midX - p.x, midY - p.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = idx;
        }
      });
      if (best >= 0) {
        drawings.splice(best, 1);
        patchFloor(floor.id, { drawings });
      }
    }
  }

  function onCanvasMouseMove(e) {
    if (!wallDraft) return;
    const p = canvasPoint(e);
    setWallDraft((d) => (d ? { ...d, x2: p.x, y2: p.y } : null));
  }

  function onCanvasMouseUp() {
    if (!wallDraft || !floor) return;
    const len = Math.hypot(wallDraft.x2 - wallDraft.x1, wallDraft.y2 - wallDraft.y1);
    if (len > 8) {
      const drawings = [...(Array.isArray(floor.drawings) ? floor.drawings : []), { type: "wall", ...wallDraft }];
      patchFloor(floor.id, { drawings });
    }
    setWallDraft(null);
  }

  function startTableDrag(e, table) {
    if (tool !== "move") return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedTableId(table.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const ox = table.x;
    const oy = table.y;
    const node = e.currentTarget;
    function onMove(ev) {
      const nx = Math.max(0, ox + (ev.clientX - startX));
      const ny = Math.max(0, oy + (ev.clientY - startY));
      node.style.left = `${nx}px`;
      node.style.top = `${ny}px`;
      node.dataset.nx = String(nx);
      node.dataset.ny = String(ny);
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      const nx = Number(node.dataset.nx ?? ox);
      const ny = Number(node.dataset.ny ?? oy);
      patchTable(table.id, { x: nx, y: ny });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function submitCategory(e) {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    if (editingCatId) {
      await authFetch(`${API_URL}/cafe/menu/categories/${editingCatId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catForm.name.trim(),
          is_novelties: Boolean(catForm.is_novelties),
        }),
      });
    } else {
      await authFetch(`${API_URL}/cafe/menu/categories/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: catForm.name.trim(),
          is_novelties: Boolean(catForm.is_novelties),
        }),
      });
    }
    setCatFormOpen(false);
    setEditingCatId(null);
    setCatForm(emptyCatForm);
    await loadAll();
  }

  async function deleteCategory(id) {
    if (!window.confirm("Удалить категорию и все блюда в ней?")) return;
    await authFetch(`${API_URL}/cafe/menu/categories/${id}/`, { method: "DELETE" });
    await loadAll();
  }

  async function submitItem(e) {
    e.preventDefault();
    if (!itemFormOpenFor || !itemForm.name.trim()) return;
    await authFetch(`${API_URL}/cafe/menu/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: itemFormOpenFor,
        name: itemForm.name.trim(),
        price: itemForm.price || "0",
        composition: itemForm.composition || "",
        description: itemForm.description || "",
        weight_grams: itemForm.weight_grams ? Number(itemForm.weight_grams) : null,
        calories: itemForm.calories ? Number(itemForm.calories) : null,
        is_new: Boolean(itemForm.is_new),
      }),
    });
    setItemFormOpenFor(null);
    setItemForm(emptyItemForm);
    await loadAll();
  }

  async function patchItem(id, patch) {
    await authFetch(`${API_URL}/cafe/menu/items/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadAll();
  }

  async function deleteItem(id) {
    if (!window.confirm("Удалить блюдо?")) return;
    await authFetch(`${API_URL}/cafe/menu/items/${id}/`, { method: "DELETE" });
    await loadAll();
  }

  async function uploadPhoto(itemId, file) {
    const fd = new FormData();
    fd.append("image", file);
    await authFetch(`${API_URL}/cafe/menu/items/${itemId}/photos/`, { method: "POST", body: fd });
    await loadAll();
  }

  async function setOrderStatus(id, next) {
    await authFetch(`${API_URL}/cafe/orders/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await loadAll();
  }

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

  return (
    <section className="card full-width cafe-provider">
      <h2>Кафе и ресторан</h2>
      <p className="muted">
        Начертите стены зала, расставьте столы со стульями, настройте PIN и QR, ведите меню и заказы.
      </p>
      <div className="cafe-provider-tabs">
        {[
          ["floor", "Зал и столы"],
          ["menu", "Меню"],
          ["settings", "Режимы и оплата"],
          ["orders", "Заказы"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`ghost-btn${tab === id ? " is-active" : ""}`}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && settings && (
        <div className="cafe-form-grid">
          {[
            ["enable_dine_in", "За столом"],
            ["enable_takeaway", "Самовывоз"],
            ["enable_delivery", "Доставка"],
            ["accept_online_payment", "Онлайн-оплата (ЮKassa)"],
            ["accept_cash", "Наличные"],
            ["accept_card_on_spot", "Картой на месте"],
          ].map(([key, label]) => (
            <label key={key} className="checkbox cafe-form-span2">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(e) => saveSettings({ [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
          <label className="cafe-form-span2">
            Условия доставки
            <textarea
              value={settings.delivery_info || ""}
              onChange={(e) => setSettings({ ...settings, delivery_info: e.target.value })}
              onBlur={() => saveSettings({ delivery_info: settings.delivery_info })}
              rows={3}
            />
          </label>
          <label>
            Стоимость доставки, ₽
            <input
              type="number"
              value={settings.delivery_fee}
              onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })}
              onBlur={() => saveSettings({ delivery_fee: settings.delivery_fee })}
            />
          </label>
          <label>
            Мин. сумма доставки, ₽
            <input
              type="number"
              value={settings.delivery_min_order}
              onChange={(e) => setSettings({ ...settings, delivery_min_order: e.target.value })}
              onBlur={() => saveSettings({ delivery_min_order: settings.delivery_min_order })}
            />
          </label>
        </div>
      )}

      {tab === "floor" && (
        <div className="cafe-floor-wrap">
          <div className="cafe-toolbar">
            <button type="button" onClick={addFloor}>
              + Зал
            </button>
            <button type="button" onClick={addTable} disabled={!floor}>
              + Стол
            </button>
            <button type="button" className={tool === "move" ? "is-active" : ""} onClick={() => setTool("move")}>
              Двигать
            </button>
            <button type="button" className={tool === "wall" ? "is-active" : ""} onClick={() => setTool("wall")}>
              Стена
            </button>
            <button type="button" className={tool === "erase" ? "is-active" : ""} onClick={() => setTool("erase")}>
              Ластик стен
            </button>
            {floors.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`ghost-btn${f.id === floor?.id ? " is-active" : ""}`}
                onClick={() => setSelectedFloorId(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>

          {floor ? (
            <div
              ref={canvasRef}
              className={`cafe-floor-canvas tool-${tool}`}
              style={{ width: "100%", maxWidth: floor.width, height: Math.min(floor.height, 480) }}
              onMouseDown={onCanvasMouseDown}
              onMouseMove={onCanvasMouseMove}
              onMouseUp={onCanvasMouseUp}
              onMouseLeave={onCanvasMouseUp}
            >
              <svg className="cafe-floor-drawings" viewBox={`0 0 ${floor.width} ${floor.height}`} preserveAspectRatio="none">
                {(Array.isArray(floor.drawings) ? floor.drawings : []).map((d, i) =>
                  d.type === "wall" ? (
                    <line
                      key={i}
                      x1={d.x1}
                      y1={d.y1}
                      x2={d.x2}
                      y2={d.y2}
                      stroke="#5a3a22"
                      strokeWidth="6"
                      strokeLinecap="round"
                    />
                  ) : null,
                )}
                {wallDraft ? (
                  <line
                    x1={wallDraft.x1}
                    y1={wallDraft.y1}
                    x2={wallDraft.x2}
                    y2={wallDraft.y2}
                    stroke="#c45c00"
                    strokeWidth="5"
                    strokeDasharray="8 6"
                    strokeLinecap="round"
                  />
                ) : null}
              </svg>
              {(floor.tables || []).map((t) => (
                <div
                  key={t.id}
                  className={`cafe-table-node${selectedTableId === t.id ? " is-selected" : ""}`}
                  style={{
                    left: t.x,
                    top: t.y,
                    width: t.width || 88,
                    height: t.height || 88,
                    transform: `rotate(${t.rotation || 0}deg)`,
                  }}
                  onMouseDown={(e) => startTableDrag(e, t)}
                  onClick={() => setSelectedTableId(t.id)}
                >
                  <TableIcon seats={t.seats} label={t.label} selected={selectedTableId === t.id} />
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Создайте зал, начертите стены и добавьте столы.</p>
          )}

          {selectedTable && (
            <div className="cafe-table-editor cafe-form-grid">
              <h3 className="cafe-form-span2">Стол: {selectedTable.label}</h3>
              <label>
                Название
                <input
                  value={selectedTable.label}
                  onChange={(e) =>
                    setFloors((prev) =>
                      prev.map((f) => ({
                        ...f,
                        tables: (f.tables || []).map((t) =>
                          t.id === selectedTable.id ? { ...t, label: e.target.value } : t,
                        ),
                      })),
                    )
                  }
                  onBlur={(e) => patchTable(selectedTable.id, { label: e.target.value.trim() || selectedTable.label })}
                />
              </label>
              <label>
                Мест (стулья)
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedTable.seats || 2}
                  onChange={(e) => patchTable(selectedTable.id, { seats: Number(e.target.value) || 2 })}
                />
              </label>
              <label>
                Поворот, °
                <input
                  type="number"
                  step={15}
                  value={selectedTable.rotation || 0}
                  onChange={(e) => patchTable(selectedTable.id, { rotation: Number(e.target.value) || 0 })}
                />
              </label>
              <div className="cafe-form-span2 cafe-toolbar">
                <button type="button" onClick={() => patchTable(selectedTable.id, { rotation: ((selectedTable.rotation || 0) + 45) % 360 })}>
                  Повернуть +45°
                </button>
                <button type="button" className="ghost-btn" onClick={() => deleteTable(selectedTable.id)}>
                  Удалить стол
                </button>
              </div>
              <label>
                PIN (6 цифр)
                <input
                  value={selectedTable.pin_code}
                  maxLength={6}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setFloors((prev) =>
                      prev.map((f) => ({
                        ...f,
                        tables: (f.tables || []).map((t) =>
                          t.id === selectedTable.id ? { ...t, pin_code: v } : t,
                        ),
                      })),
                    );
                  }}
                  onBlur={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    if (v.length === 6) patchTable(selectedTable.id, { pin_code: v });
                  }}
                />
              </label>
              <div className="cafe-qr-block cafe-form-span2">
                <p className="muted small">QR-код стола (откройте или скачайте):</p>
                {selectedTable.public_token ? (
                  <>
                    <img
                      src={qrImageUrl(`${origin}/t/${selectedTable.public_token}`, 200)}
                      alt={`QR ${selectedTable.label}`}
                      width={200}
                      height={200}
                    />
                    <div className="cafe-toolbar">
                      <a
                        className="ghost-btn"
                        href={qrImageUrl(`${origin}/t/${selectedTable.public_token}`, 400)}
                        download={`qr-${selectedTable.label}.png`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Скачать QR
                      </a>
                      <a className="ghost-btn" href={`${origin}/t/${selectedTable.public_token}`} target="_blank" rel="noreferrer">
                        Открыть ссылку
                      </a>
                    </div>
                    <code className="cafe-qr-url">
                      {origin}/t/{selectedTable.public_token}
                    </code>
                  </>
                ) : (
                  <p className="muted">Токен стола ещё не создан — сохраните стол ещё раз.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "menu" && (
        <div>
          <div className="cafe-toolbar">
            <button
              type="button"
              onClick={() => {
                setEditingCatId(null);
                setCatForm(emptyCatForm);
                setCatFormOpen(true);
              }}
            >
              + Категория
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingCatId(null);
                setCatForm({ name: "Новинки", is_novelties: true });
                setCatFormOpen(true);
              }}
            >
              + Новинки
            </button>
          </div>

          {catFormOpen && (
            <form className="cafe-form-panel cafe-form-grid" onSubmit={submitCategory}>
              <h3 className="cafe-form-span2">{editingCatId ? "Редактировать категорию" : "Новая категория"}</h3>
              <label className="cafe-form-span2">
                Название
                <input
                  value={catForm.name}
                  onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                  required
                  autoFocus
                />
              </label>
              <label className="checkbox cafe-form-span2">
                <input
                  type="checkbox"
                  checked={Boolean(catForm.is_novelties)}
                  onChange={(e) => setCatForm({ ...catForm, is_novelties: e.target.checked })}
                />
                <span>Категория «Новинки» (показывается первой)</span>
              </label>
              <div className="cafe-form-span2 cafe-toolbar">
                <button type="submit">{editingCatId ? "Сохранить" : "Создать"}</button>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setCatFormOpen(false);
                    setEditingCatId(null);
                  }}
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {categories.map((cat) => (
            <div key={cat.id} className="cafe-guest-card cafe-cat-card">
              <div className="cafe-cat-head">
                <h3>
                  {cat.name} {cat.is_novelties ? "· Новинки" : ""}
                </h3>
                <div className="cafe-toolbar">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setCatForm({ name: cat.name, is_novelties: Boolean(cat.is_novelties) });
                      setCatFormOpen(true);
                    }}
                  >
                    Изменить
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => deleteCategory(cat.id)}>
                    Удалить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setItemForm(emptyItemForm);
                      setItemFormOpenFor(cat.id);
                    }}
                  >
                    + Блюдо
                  </button>
                </div>
              </div>

              {itemFormOpenFor === cat.id && (
                <form className="cafe-form-panel cafe-form-grid" onSubmit={submitItem}>
                  <h4 className="cafe-form-span2">Новое блюдо</h4>
                  <label>
                    Название *
                    <input
                      value={itemForm.name}
                      onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                      required
                      autoFocus
                    />
                  </label>
                  <label>
                    Цена, ₽ *
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={itemForm.price}
                      onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                      required
                    />
                  </label>
                  <label className="cafe-form-span2">
                    Состав
                    <textarea
                      rows={2}
                      value={itemForm.composition}
                      onChange={(e) => setItemForm({ ...itemForm, composition: e.target.value })}
                    />
                  </label>
                  <label className="cafe-form-span2">
                    Описание
                    <textarea
                      rows={2}
                      value={itemForm.description}
                      onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                    />
                  </label>
                  <label>
                    Граммы
                    <input
                      type="number"
                      value={itemForm.weight_grams}
                      onChange={(e) => setItemForm({ ...itemForm, weight_grams: e.target.value })}
                    />
                  </label>
                  <label>
                    Ккал
                    <input
                      type="number"
                      value={itemForm.calories}
                      onChange={(e) => setItemForm({ ...itemForm, calories: e.target.value })}
                    />
                  </label>
                  <label className="checkbox cafe-form-span2">
                    <input
                      type="checkbox"
                      checked={Boolean(itemForm.is_new)}
                      onChange={(e) => setItemForm({ ...itemForm, is_new: e.target.checked })}
                    />
                    <span>Пометка «Новинка»</span>
                  </label>
                  <div className="cafe-form-span2 cafe-toolbar">
                    <button type="submit">Добавить блюдо</button>
                    <button type="button" className="ghost-btn" onClick={() => setItemFormOpenFor(null)}>
                      Отмена
                    </button>
                  </div>
                </form>
              )}

              {(cat.items || []).map((item) => (
                <div key={item.id} className="cafe-item-row cafe-form-grid">
                  <label>
                    Название
                    <input defaultValue={item.name} onBlur={(e) => patchItem(item.id, { name: e.target.value })} />
                  </label>
                  <label>
                    Цена
                    <input
                      type="number"
                      defaultValue={item.price}
                      onBlur={(e) => patchItem(item.id, { price: e.target.value })}
                    />
                  </label>
                  <label className="cafe-form-span2">
                    Состав
                    <textarea
                      rows={2}
                      defaultValue={item.composition}
                      onBlur={(e) => patchItem(item.id, { composition: e.target.value })}
                    />
                  </label>
                  <label>
                    Граммы
                    <input
                      type="number"
                      defaultValue={item.weight_grams || ""}
                      onBlur={(e) => patchItem(item.id, { weight_grams: e.target.value || null })}
                    />
                  </label>
                  <label>
                    Ккал
                    <input
                      type="number"
                      defaultValue={item.calories || ""}
                      onBlur={(e) => patchItem(item.id, { calories: e.target.value || null })}
                    />
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={Boolean(item.is_new)}
                      onChange={(e) => patchItem(item.id, { is_new: e.target.checked })}
                    />
                    <span>Новинка</span>
                  </label>
                  <label>
                    Фото (до 5)
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPhoto(item.id, file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <div className="cafe-form-span2 cafe-toolbar">
                    <span className="muted small">Фото: {item.photos?.length || 0}/5</span>
                    <button type="button" className="ghost-btn" onClick={() => deleteItem(item.id)}>
                      Удалить блюдо
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {tab === "orders" && (
        <div className="cafe-tables-list">
          {orders.length === 0 ? <p className="muted">Заказов пока нет.</p> : null}
          {orders.map((o) => (
            <div key={o.id} className="cafe-guest-card">
              <strong>
                #{o.id} · {modeLabels[o.mode] || o.mode} · {statusLabels[o.status] || o.status}
              </strong>
              <p>
                {o.table_label ? `Стол: ${o.table_label}` : null} · {Number(o.total).toLocaleString("ru-RU")} ₽ ·{" "}
                {o.pay_method}
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
                    {statusLabels[st] || st}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

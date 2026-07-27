import { useCallback, useEffect, useState } from "react";
import "./cafeGuest.css";

/**
 * Provider UI: зал/столы (PIN+QR), меню, режимы заказа, заказы.
 * props: authFetch(url, options), API_URL
 */
export default function CafeProviderWorkspace({ authFetch, API_URL }) {
  const [tab, setTab] = useState("floor");
  const [settings, setSettings] = useState(null);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState(null);

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
      if (!selectedFloorId && floorsData[0]) setSelectedFloorId(floorsData[0].id);
    }
    if (m.ok) setCategories(await m.json());
    if (o.ok) setOrders(await o.json());
  }, [API_URL, authFetch, selectedFloorId]);

  useEffect(() => {
    loadAll().catch(() => setStatus("Не удалось загрузить данные кафе"));
  }, [loadAll]);

  const floor = floors.find((x) => x.id === selectedFloorId) || floors[0];

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
      body: JSON.stringify({ name: `Зал ${(floors.length || 0) + 1}` }),
    });
    if (res.ok) {
      const plan = await res.json();
      setFloors((prev) => [...prev, plan]);
      setSelectedFloorId(plan.id);
    }
  }

  async function addTable() {
    if (!floor) return;
    const res = await authFetch(`${API_URL}/cafe/floors/${floor.id}/tables/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `Стол ${(floor.tables?.length || 0) + 1}`,
        x: 40 + (floor.tables?.length || 0) * 20,
        y: 40 + (floor.tables?.length || 0) * 10,
        pin_code: String(Math.floor(100000 + Math.random() * 900000)),
      }),
    });
    if (res.ok) await loadAll();
  }

  async function patchTable(id, patch) {
    await authFetch(`${API_URL}/cafe/tables/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadAll();
  }

  async function addCategory(isNovelties = false) {
    const name = isNovelties ? "Новинки" : window.prompt("Название категории") || "";
    if (!name.trim()) return;
    await authFetch(`${API_URL}/cafe/menu/categories/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), is_novelties: isNovelties }),
    });
    await loadAll();
  }

  async function addItem(categoryId) {
    const name = window.prompt("Название блюда") || "";
    if (!name.trim()) return;
    const price = window.prompt("Цена, ₽", "350") || "0";
    await authFetch(`${API_URL}/cafe/menu/items/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: categoryId,
        name: name.trim(),
        price,
        is_new: false,
        composition: "",
      }),
    });
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

  const origin = typeof window !== "undefined" ? window.location.origin : "https://vsevmeste.space";

  return (
    <section className="card full-width cafe-provider">
      <h2>Кафе и ресторан</h2>
      <p className="muted">
        План зала, QR и PIN столов, меню с новинками, режимы «за столом / самовывоз / доставка», оплата онлайн
        или на месте.
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
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "settings" && settings && (
        <div className="form" style={{ maxWidth: 520 }}>
          {[
            ["enable_dine_in", "За столом (🍽️)"],
            ["enable_takeaway", "Самовывоз (🛍️)"],
            ["enable_delivery", "Доставка"],
            ["accept_online_payment", "Онлайн-оплата (ЮKassa)"],
            ["accept_cash", "Наличные"],
            ["accept_card_on_spot", "Картой на месте"],
          ].map(([key, label]) => (
            <label key={key} className="checkbox">
              <input
                type="checkbox"
                checked={Boolean(settings[key])}
                onChange={(e) => saveSettings({ [key]: e.target.checked })}
              />
              <span>{label}</span>
            </label>
          ))}
          <textarea
            placeholder="Условия доставки"
            value={settings.delivery_info || ""}
            onChange={(e) => setSettings({ ...settings, delivery_info: e.target.value })}
            onBlur={() => saveSettings({ delivery_info: settings.delivery_info })}
            rows={3}
          />
          <input
            type="number"
            placeholder="Стоимость доставки"
            value={settings.delivery_fee}
            onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })}
            onBlur={() => saveSettings({ delivery_fee: settings.delivery_fee })}
          />
          <input
            type="number"
            placeholder="Мин. сумма доставки"
            value={settings.delivery_min_order}
            onChange={(e) => setSettings({ ...settings, delivery_min_order: e.target.value })}
            onBlur={() => saveSettings({ delivery_min_order: settings.delivery_min_order })}
          />
        </div>
      )}

      {tab === "floor" && (
        <div>
          <div className="row-actions" style={{ gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={addFloor}>
              + Зал
            </button>
            <button type="button" onClick={addTable} disabled={!floor}>
              + Стол
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
              className="cafe-floor-canvas"
              style={{
                position: "relative",
                width: "100%",
                maxWidth: floor.width,
                height: Math.min(floor.height, 420),
                border: "1px dashed #e0c2a8",
                borderRadius: 12,
                background: "#fffaf5",
                marginBottom: 16,
              }}
            >
              {(floor.tables || []).map((t) => (
                <div
                  key={t.id}
                  title={t.label}
                  style={{
                    position: "absolute",
                    left: t.x,
                    top: t.y,
                    width: t.width,
                    height: t.height,
                    borderRadius: 10,
                    background: "#ffedd9",
                    border: "2px solid #c45c00",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "grab",
                  }}
                  onMouseDown={(e) => {
                    const startX = e.clientX;
                    const startY = e.clientY;
                    const ox = t.x;
                    const oy = t.y;
                    function onMove(ev) {
                      const nx = Math.max(0, ox + (ev.clientX - startX));
                      const ny = Math.max(0, oy + (ev.clientY - startY));
                      e.currentTarget.style.left = `${nx}px`;
                      e.currentTarget.style.top = `${ny}px`;
                      e.currentTarget.dataset.nx = String(nx);
                      e.currentTarget.dataset.ny = String(ny);
                    }
                    function onUp(ev) {
                      window.removeEventListener("mousemove", onMove);
                      window.removeEventListener("mouseup", onUp);
                      const nx = Number(e.currentTarget.dataset.nx ?? ox);
                      const ny = Number(e.currentTarget.dataset.ny ?? oy);
                      patchTable(t.id, { x: nx, y: ny });
                    }
                    window.addEventListener("mousemove", onMove);
                    window.addEventListener("mouseup", onUp);
                  }}
                >
                  {t.label}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Создайте зал, затем добавьте столы.</p>
          )}
          <div className="cafe-tables-list">
            {(floor?.tables || []).map((t) => (
              <div key={t.id} className="cafe-guest-card">
                <strong>{t.label}</strong>
                <label>
                  Название
                  <input defaultValue={t.label} onBlur={(e) => patchTable(t.id, { label: e.target.value })} />
                </label>
                <label>
                  PIN (6 цифр)
                  <input
                    defaultValue={t.pin_code}
                    maxLength={6}
                    onBlur={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                      if (v.length === 6) patchTable(t.id, { pin_code: v });
                    }}
                  />
                </label>
                <p className="muted small">
                  QR-ссылка:{" "}
                  <a href={`${origin}${t.qr_path}`} target="_blank" rel="noreferrer">
                    {origin}
                    {t.qr_path}
                  </a>
                </p>
                <p className="muted small">Распечатайте QR на эту ссылку и укажите PIN на столе/карточке.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "menu" && (
        <div>
          <div className="row-actions" style={{ gap: 8, marginBottom: 12 }}>
            <button type="button" onClick={() => addCategory(false)}>
              + Категория
            </button>
            <button type="button" onClick={() => addCategory(true)}>
              + Новинки
            </button>
          </div>
          {categories.map((cat) => (
            <div key={cat.id} className="cafe-guest-card">
              <h3>
                {cat.name} {cat.is_novelties ? "· Новинки" : ""}
              </h3>
              <button type="button" className="ghost-btn" onClick={() => addItem(cat.id)}>
                + Блюдо
              </button>
              {(cat.items || []).map((item) => (
                <div key={item.id} style={{ borderTop: "1px solid #ffe0c8", marginTop: 10, paddingTop: 10 }}>
                  <div className="cafe-menu-row">
                    <strong>{item.name}</strong>
                    <label className="checkbox">
                      <input
                        type="checkbox"
                        checked={Boolean(item.is_new)}
                        onChange={(e) => patchItem(item.id, { is_new: e.target.checked })}
                      />
                      <span>Новинка</span>
                    </label>
                  </div>
                  <input
                    placeholder="Состав"
                    defaultValue={item.composition}
                    onBlur={(e) => patchItem(item.id, { composition: e.target.value })}
                  />
                  <div className="address-details-grid">
                    <input
                      type="number"
                      placeholder="Граммы"
                      defaultValue={item.weight_grams || ""}
                      onBlur={(e) => patchItem(item.id, { weight_grams: e.target.value || null })}
                    />
                    <input
                      type="number"
                      placeholder="Ккал"
                      defaultValue={item.calories || ""}
                      onBlur={(e) => patchItem(item.id, { calories: e.target.value || null })}
                    />
                    <input
                      type="number"
                      placeholder="Цена"
                      defaultValue={item.price}
                      onBlur={(e) => patchItem(item.id, { price: e.target.value })}
                    />
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadPhoto(item.id, file);
                      e.target.value = "";
                    }}
                  />
                  <p className="muted small">Фото до 5 шт. Сейчас: {item.photos?.length || 0}</p>
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
                #{o.id} · {o.mode} · {o.status}
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
              <div className="row-actions" style={{ gap: 6 }}>
                {["accepted", "cooking", "ready", "done", "cancelled"].map((st) => (
                  <button key={st} type="button" className="ghost-btn" onClick={() => setOrderStatus(o.id, st)}>
                    {st}
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

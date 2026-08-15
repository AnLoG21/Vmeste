import { useCallback, useEffect, useState } from "react";
import CafeFloorCanvas, { QrImg, GRID } from "./CafeFloorCanvas.jsx";
import "./cafeGuest.css";
import "./cafeProvider.css";

const emptyCatForm = { name: "", is_novelties: false };
const emptyItemForm = {
  name: "",
  price: "350",
  composition: "",
  description: "",
  weight_grams: "",
  calories: "",
  is_new: false,
  is_available: true,
};

export default function CafeProviderWorkspace({ authFetch, API_URL, initialTab = "floor", onTabChange }) {
  const [tab, setTab] = useState(initialTab === "orders" ? "floor" : initialTab || "floor");
  const [settings, setSettings] = useState(null);
  const [floors, setFloors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedFloorId, setSelectedFloorId] = useState(null);
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedWallId, setSelectedWallId] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [tool, setTool] = useState("move");
  const [zoom, setZoom] = useState(1);
  const [catFormOpen, setCatFormOpen] = useState(false);
  const [catForm, setCatForm] = useState(emptyCatForm);
  const [editingCatId, setEditingCatId] = useState(null);
  const [itemFormOpenFor, setItemFormOpenFor] = useState(null);
  const [itemForm, setItemForm] = useState(emptyItemForm);
  const [meSlug, setMeSlug] = useState("");

  useEffect(() => {
    if (initialTab && initialTab !== "orders" && initialTab !== tab) setTab(initialTab);
  }, [initialTab]);

  function switchTab(id) {
    setTab(id);
    onTabChange?.(id);
  }

  const loadAll = useCallback(async () => {
    const [s, f, m, meRes] = await Promise.all([
      authFetch(`${API_URL}/cafe/settings/`),
      authFetch(`${API_URL}/cafe/floors/`),
      authFetch(`${API_URL}/cafe/menu/categories/`),
      authFetch(`${API_URL}/users/me/`),
    ]);
    if (s.ok) setSettings(await s.json());
    if (f.ok) {
      const floorsData = await f.json();
      setFloors(floorsData);
      setSelectedFloorId((prev) => prev || floorsData[0]?.id || null);
    }
    if (m.ok) setCategories(await m.json());
    if (meRes.ok) {
      const me = await meRes.json();
      setMeSlug(me.organization_slug || "");
    }
  }, [API_URL, authFetch]);

  useEffect(() => {
    loadAll().catch(() => setStatus("Не удалось загрузить данные кафе"));
  }, [loadAll]);

  const floor = floors.find((x) => x.id === selectedFloorId) || floors[0] || null;
  const selectedTable = (floor?.tables || []).find((t) => t.id === selectedTableId) || null;
  const selectedZone = (floor?.drawings || []).find((d) => d.id === selectedZoneId && d.type === "zone") || null;
  const hasNoveltiesCategory = categories.some((c) => c.is_novelties);
  const origin =
    typeof window !== "undefined" && window.location?.origin && !window.location.origin.startsWith("capacitor")
      ? window.location.origin
      : "https://vsevmeste.space";
  // Prefer production site for QR so phone scan always hits SPA routes /m and /t
  const publicOrigin = origin.includes("localhost") || origin.includes("127.0.0.1") ? "https://vsevmeste.space" : origin;
  const guestMenuUrl = meSlug ? `${publicOrigin}/m/${meSlug}` : "";
  const tableUrl = selectedTable?.public_token ? `${publicOrigin}/t/${selectedTable.public_token}` : "";

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

  async function deleteFloor(id) {
    if (!window.confirm("Удалить зал и все столы на нём?")) return;
    const res = await authFetch(`${API_URL}/cafe/floors/${id}/`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      const next = floors.filter((f) => f.id !== id);
      setFloors(next);
      if (selectedFloorId === id) {
        setSelectedFloorId(next[0]?.id || null);
        setSelectedTableId(null);
        setSelectedWallId(null);
        setSelectedZoneId(null);
      }
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
      setFloors((prev) =>
        prev.map((f) => (f.id === id ? { ...f, ...updated, tables: updated.tables || f.tables } : f)),
      );
    }
  }

  async function addTable(shape = "round") {
    if (!floor) return;
    const size =
      shape === "sofa" ? { width: 110, height: 78 } : shape === "rect" ? { width: 100, height: 72 } : { width: 88, height: 88 };
    const res = await authFetch(`${API_URL}/cafe/floors/${floor.id}/tables/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: `Стол ${(floor.tables?.length || 0) + 1}`,
        x: GRID * 3 + (floor.tables?.length || 0) * GRID,
        y: GRID * 3 + (floor.tables?.length || 0) * GRID,
        ...size,
        seats: shape === "sofa" ? 6 : 4,
        shape,
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

  async function deleteTable(id, { quiet = false } = {}) {
    if (!quiet && !window.confirm("Удалить стол?")) return;
    const res = await authFetch(`${API_URL}/cafe/tables/${id}/`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      setFloors((prev) =>
        prev.map((f) => ({ ...f, tables: (f.tables || []).filter((t) => t.id !== id) })),
      );
      if (selectedTableId === id) setSelectedTableId(null);
    }
  }

  function patchZone(zoneId, patch) {
    if (!floor) return;
    const drawings = (floor.drawings || []).map((d) => (d.id === zoneId ? { ...d, ...patch } : d));
    patchFloor(floor.id, { drawings });
  }

  function deleteZone(zoneId) {
    if (!floor) return;
    patchFloor(floor.id, { drawings: (floor.drawings || []).filter((d) => d.id !== zoneId) });
    if (selectedZoneId === zoneId) setSelectedZoneId(null);
  }

  function deleteSelectedWall() {
    if (!floor || !selectedWallId) return;
    const drawings = (floor.drawings || []).filter((d) => d.id !== selectedWallId);
    patchFloor(floor.id, { drawings });
    setSelectedWallId(null);
  }

  function addZone() {
    if (!floor) return;
    const drawings = [
      ...(floor.drawings || []),
      {
        id: `z-${Date.now()}`,
        type: "zone",
        x: GRID * 2,
        y: GRID * 2,
        w: GRID * 8,
        h: GRID * 6,
        name: "Комната",
        color: "rgba(196,92,0,0.1)",
      },
    ];
    patchFloor(floor.id, { drawings });
  }

  async function submitCategory(e) {
    e.preventDefault();
    if (!catForm.name.trim()) return;
    if (editingCatId) {
      await authFetch(`${API_URL}/cafe/menu/categories/${editingCatId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catForm.name.trim(), is_novelties: Boolean(catForm.is_novelties) }),
      });
    } else {
      await authFetch(`${API_URL}/cafe/menu/categories/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catForm.name.trim(), is_novelties: Boolean(catForm.is_novelties) }),
      });
    }
    setCatFormOpen(false);
    setEditingCatId(null);
    setCatForm(emptyCatForm);
    await loadAll();
  }

  async function deleteCategory(id) {
    if (!window.confirm("Удалить категорию и блюда?")) return;
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
        is_available: itemForm.is_available !== false,
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

  async function deletePhoto(itemId, photoId) {
    if (!window.confirm("Удалить это фото?")) return;
    await authFetch(`${API_URL}/cafe/menu/items/${itemId}/photos/${photoId}/`, { method: "DELETE" });
    await loadAll();
  }

  async function uploadLogo(file) {
    const fd = new FormData();
    fd.append("logo", file);
    const res = await authFetch(`${API_URL}/cafe/settings/`, { method: "PATCH", body: fd });
    if (res.ok) setSettings(await res.json());
  }

  async function clearLogo() {
    if (!window.confirm("Удалить логотип?")) return;
    const fd = new FormData();
    fd.append("clear_logo", "1");
    const res = await authFetch(`${API_URL}/cafe/settings/`, { method: "PATCH", body: fd });
    if (res.ok) setSettings(await res.json());
  }

  async function addIngredient(itemId, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;
    const res = await authFetch(`${API_URL}/cafe/menu/items/${itemId}/ingredients/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) await loadAll();
  }

  async function deleteIngredient(itemId, ingredientId) {
    const res = await authFetch(`${API_URL}/cafe/menu/items/${itemId}/ingredients/${ingredientId}/`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) await loadAll();
  }

  return (
    <section className="card full-width cafe-provider">
      <h2>Зал и меню</h2>
      <p className="muted">
        Чертите стены по сетке, редактируйте точки, расставляйте столы. Заказы — во вкладке «Заказы» сверху.
      </p>
      {guestMenuUrl ? (
        <div className="cafe-qr-block cafe-menu-qr-top">
          <h3>QR меню (самовывоз / доставка)</h3>
          <p className="muted small">Гость сканирует и сразу попадает в меню с корзиной — без PIN стола.</p>
          <a className="cafe-qr-open" href={guestMenuUrl} target="_blank" rel="noreferrer">
            {guestMenuUrl}
          </a>
          <QrImg data={guestMenuUrl} size={180} alt="QR меню заведения" />
          <a className="ghost-btn" href={guestMenuUrl} target="_blank" rel="noreferrer">
            Превью меню гостя
          </a>
        </div>
      ) : (
        <p className="muted">Сохраните профиль организации — появится ссылка и QR для меню без стола.</p>
      )}

      <div className="cafe-provider-tabs">
        {[
          ["floor", "Зал и столы"],
          ["menu", "Меню"],
          ["settings", "Режимы и оплата"],
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
          <h3 className="cafe-form-span2">Логотип заведения</h3>
          <p className="muted small cafe-form-span2">
            Показывается в меню гостя по центру, справа — название организации.
          </p>
          <div className="cafe-form-span2 cafe-logo-row">
            {settings.logo_url ? (
              <div className="cafe-photo-thumb cafe-logo-preview">
                <img src={settings.logo_url} alt="Логотип" />
                <button type="button" className="cafe-photo-thumb-x" onClick={clearLogo} aria-label="Удалить логотип">
                  ×
                </button>
              </div>
            ) : null}
            <label className="cafe-photo-add-btn" title="Загрузить логотип">
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                  e.target.value = "";
                }}
              />
              <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden fill="currentColor">
                <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                <path d="M17 8h-2V6h-2v2H11v2h2v2h2v-2h2V8z" />
              </svg>
              <span>Логотип</span>
            </label>
          </div>

          {[
            ["enable_dine_in", "За столом"],
            ["enable_takeaway", "Самовывоз"],
            ["enable_delivery", "Доставка"],
            ["accept_online_payment", "Онлайн-оплата"],
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
            Доставка, ₽
            <input
              type="number"
              value={settings.delivery_fee}
              onChange={(e) => setSettings({ ...settings, delivery_fee: e.target.value })}
              onBlur={() => saveSettings({ delivery_fee: settings.delivery_fee })}
            />
          </label>
          <label>
            Мин. сумма, ₽
            <input
              type="number"
              value={settings.delivery_min_order}
              onChange={(e) => setSettings({ ...settings, delivery_min_order: e.target.value })}
              onBlur={() => saveSettings({ delivery_min_order: settings.delivery_min_order })}
            />
          </label>
          <h3 className="cafe-form-span2">Онлайн-оплата организации</h3>
          <p className="muted small cafe-form-span2">
            Деньги за онлайн-заказы идут в магазин выбранного эквайера. Без ключей вариант «Онлайн» у гостя не
            появится. Сервисный сбор 3% учитывается в чеке отдельно; реквизиты ниже — для сверки.
          </p>
          <label className="cafe-form-span2">
            Эквайер
            <select
              value={settings.payment_provider || "yookassa"}
              onChange={(e) => saveSettings({ payment_provider: e.target.value })}
            >
              <option value="yookassa">ЮKassa</option>
              <option value="tbank">Т‑Банк</option>
              <option value="cloudpayments">CloudPayments</option>
              <option value="robokassa">Robokassa</option>
            </select>
          </label>
          {!settings.has_payment_keys && settings.accept_online_payment ? (
            <p className="status cafe-form-span2">
              Онлайн включён, но ключи выбранного эквайера не указаны — гости не смогут оплатить онлайн.
            </p>
          ) : null}
          {[
            ["payout_legal_name", "Юр. название / ИП"],
            ["payout_inn", "ИНН"],
            ["payout_bank_name", "Банк"],
            ["payout_bik", "БИК"],
            ["payout_account", "Расчётный счёт"],
            ["payout_corr_account", "Корр. счёт"],
          ].map(([key, label]) => (
            <label key={key} className={key === "payout_bank_name" ? "cafe-form-span2" : ""}>
              {label}
              <input
                type="text"
                value={settings[key] || ""}
                onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
                onBlur={() => saveSettings({ [key]: settings[key] || "" })}
              />
            </label>
          ))}
          {(settings.payment_provider || "yookassa") === "yookassa" ? (
            <>
              <label>
                ЮKassa Shop ID *
                <input
                  type="text"
                  value={settings.yookassa_shop_id || ""}
                  onChange={(e) => setSettings({ ...settings, yookassa_shop_id: e.target.value })}
                  onBlur={() => saveSettings({ yookassa_shop_id: settings.yookassa_shop_id || "" })}
                />
              </label>
              <label>
                ЮKassa Secret Key *
                <input
                  type="password"
                  value={settings.yookassa_secret_key || ""}
                  onChange={(e) => setSettings({ ...settings, yookassa_secret_key: e.target.value })}
                  onBlur={() => saveSettings({ yookassa_secret_key: settings.yookassa_secret_key || "" })}
                  placeholder={settings.has_yookassa ? "••••••••" : ""}
                />
              </label>
            </>
          ) : null}
          {settings.payment_provider === "tbank" ? (
            <>
              <label>
                Terminal Key *
                <input
                  type="text"
                  value={settings.tbank_terminal_key || ""}
                  onChange={(e) => setSettings({ ...settings, tbank_terminal_key: e.target.value })}
                  onBlur={() => saveSettings({ tbank_terminal_key: settings.tbank_terminal_key || "" })}
                />
              </label>
              <label>
                Password *
                <input
                  type="password"
                  value={settings.tbank_password || ""}
                  onChange={(e) => setSettings({ ...settings, tbank_password: e.target.value })}
                  onBlur={() => saveSettings({ tbank_password: settings.tbank_password || "" })}
                  placeholder={settings.has_tbank ? "••••••••" : ""}
                />
              </label>
            </>
          ) : null}
          {settings.payment_provider === "cloudpayments" ? (
            <>
              <label>
                Public ID *
                <input
                  type="text"
                  value={settings.cloudpayments_public_id || ""}
                  onChange={(e) => setSettings({ ...settings, cloudpayments_public_id: e.target.value })}
                  onBlur={() => saveSettings({ cloudpayments_public_id: settings.cloudpayments_public_id || "" })}
                />
              </label>
              <label>
                API Secret *
                <input
                  type="password"
                  value={settings.cloudpayments_api_secret || ""}
                  onChange={(e) => setSettings({ ...settings, cloudpayments_api_secret: e.target.value })}
                  onBlur={() => saveSettings({ cloudpayments_api_secret: settings.cloudpayments_api_secret || "" })}
                  placeholder={settings.has_cloudpayments ? "••••••••" : ""}
                />
              </label>
            </>
          ) : null}
          {settings.payment_provider === "robokassa" ? (
            <>
              <label>
                Merchant Login *
                <input
                  type="text"
                  value={settings.robokassa_merchant_login || ""}
                  onChange={(e) => setSettings({ ...settings, robokassa_merchant_login: e.target.value })}
                  onBlur={() => saveSettings({ robokassa_merchant_login: settings.robokassa_merchant_login || "" })}
                />
              </label>
              <label>
                Пароль #1 *
                <input
                  type="password"
                  value={settings.robokassa_password1 || ""}
                  onChange={(e) => setSettings({ ...settings, robokassa_password1: e.target.value })}
                  onBlur={() => saveSettings({ robokassa_password1: settings.robokassa_password1 || "" })}
                  placeholder={settings.has_robokassa ? "••••••••" : ""}
                />
              </label>
              <label>
                Пароль #2 *
                <input
                  type="password"
                  value={settings.robokassa_password2 || ""}
                  onChange={(e) => setSettings({ ...settings, robokassa_password2: e.target.value })}
                  onBlur={() => saveSettings({ robokassa_password2: settings.robokassa_password2 || "" })}
                  placeholder={settings.has_robokassa ? "••••••••" : ""}
                />
              </label>
            </>
          ) : null}
        </div>
      )}

      {tab === "floor" && (
        <div className="cafe-floor-wrap">
          <div className="cafe-toolbar">
            <button type="button" onClick={addFloor}>
              + Зал
            </button>
            <button type="button" onClick={() => addTable("round")} disabled={!floor}>
              + Круглый
            </button>
            <button type="button" onClick={() => addTable("rect")} disabled={!floor}>
              + Прямоуг.
            </button>
            <button type="button" onClick={() => addTable("sofa")} disabled={!floor}>
              + Диван
            </button>
            <button type="button" className={tool === "move" ? "is-active" : ""} onClick={() => setTool("move")}>
              Выбор
            </button>
            <button type="button" className={tool === "wall" ? "is-active" : ""} onClick={() => setTool("wall")}>
              Стена
            </button>
            <button type="button" className={tool === "erase" ? "is-active" : ""} onClick={() => setTool("erase")}>
              Ластик
            </button>
            <button type="button" onClick={addZone} disabled={!floor} title="Прямоугольная область: VIP, терраса, бар">
              + Комната
            </button>
            <button type="button" className="ghost-btn" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(1)))}>
              Масштаб +
            </button>
            <button type="button" className="ghost-btn" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))}>
              Масштаб −
            </button>
            {selectedWallId ? (
              <button type="button" className="ghost-btn" onClick={deleteSelectedWall}>
                Удалить стену
              </button>
            ) : null}
          </div>
          <div className="cafe-floor-tabs">
            {floors.map((f) => (
              <div key={f.id} className={`cafe-floor-tab${f.id === floor?.id ? " is-active" : ""}`}>
                <button
                  type="button"
                  className="cafe-floor-tab-name"
                  onClick={() => {
                    setSelectedFloorId(f.id);
                    setSelectedTableId(null);
                    setSelectedWallId(null);
                    setSelectedZoneId(null);
                  }}
                >
                  {f.name}
                </button>
                {floors.length > 1 ? (
                  <button
                    type="button"
                    className="cafe-floor-tab-close"
                    aria-label={`Удалить ${f.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteFloor(f.id);
                    }}
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <p className="muted small">
            Сетка {GRID}px · тяните правый нижний угол плана · комнату — за уголок · ластик удаляет объекты под курсором
          </p>

          {floor ? (
            <CafeFloorCanvas
              floor={floor}
              selectedTableId={selectedTableId}
              selectedWallId={selectedWallId}
              selectedZoneId={selectedZoneId}
              tool={tool}
              zoom={zoom}
              showFloorResize
              onSelectTable={setSelectedTableId}
              onSelectWall={setSelectedWallId}
              onSelectZone={setSelectedZoneId}
              onPatchFloor={patchFloor}
              onPatchTable={patchTable}
              onDeleteTable={(id) => deleteTable(id, { quiet: true })}
              onResizeFloor={({ width, height }, { commit } = {}) => {
                setFloors((prev) => prev.map((f) => (f.id === floor.id ? { ...f, width, height } : f)));
                if (commit) patchFloor(floor.id, { width, height });
              }}
            />
          ) : (
            <p className="muted">Создайте зал.</p>
          )}

          {selectedZone && (
            <div className="cafe-table-editor cafe-form-grid">
              <h3 className="cafe-form-span2">Комната / зона</h3>
              <label className="cafe-form-span2">
                Название (VIP, терраса…)
                <input
                  value={selectedZone.name || ""}
                  onChange={(e) => patchZone(selectedZone.id, { name: e.target.value })}
                />
              </label>
              <div className="cafe-form-span2 cafe-toolbar">
                <button type="button" className="ghost-btn" onClick={() => deleteZone(selectedZone.id)}>
                  Удалить комнату
                </button>
              </div>
            </div>
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
                Форма
                <select
                  value={selectedTable.shape || "round"}
                  onChange={(e) => patchTable(selectedTable.id, { shape: e.target.value })}
                >
                  <option value="round">Круглый</option>
                  <option value="rect">Прямоугольный</option>
                  <option value="sofa">Диванный</option>
                </select>
              </label>
              <label>
                Мест
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={selectedTable.seats || 2}
                  onChange={(e) => patchTable(selectedTable.id, { seats: Number(e.target.value) || 2 })}
                />
              </label>
              <label>
                Поворот °
                <input
                  type="number"
                  step={15}
                  value={selectedTable.rotation || 0}
                  onChange={(e) => patchTable(selectedTable.id, { rotation: Number(e.target.value) || 0 })}
                />
              </label>
              <div className="cafe-form-span2 cafe-toolbar">
                <button type="button" onClick={() => patchTable(selectedTable.id, { rotation: ((selectedTable.rotation || 0) + 45) % 360 })}>
                  +45°
                </button>
                <button type="button" className="ghost-btn" onClick={() => deleteTable(selectedTable.id)}>
                  Удалить
                </button>
              </div>
              <div className="cafe-qr-block cafe-form-span2">
                <p>
                  <strong>QR стола — скан → меню и корзина</strong>
                </p>
                {tableUrl ? (
                  <>
                    <a className="cafe-qr-open" href={tableUrl} target="_blank" rel="noreferrer">
                      {tableUrl}
                    </a>
                    <QrImg data={tableUrl} size={220} alt={`QR ${selectedTable.label}`} />
                    <p className="muted small">PIN для входа в заказ: {selectedTable.pin_code}</p>
                    <a className="ghost-btn" href={tableUrl} target="_blank" rel="noreferrer">
                      Превью меню гостя
                    </a>
                    <div className="cafe-qr-large">
                      <QrImg data={tableUrl} size={320} alt={`QR крупно ${selectedTable.label}`} />
                    </div>
                  </>
                ) : (
                  <p className="muted">Нет токена стола — пересохраните стол.</p>
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
              disabled={hasNoveltiesCategory}
              title={hasNoveltiesCategory ? "Категория «Новинки» уже есть" : "Добавить категорию новинок"}
              onClick={() => {
                if (hasNoveltiesCategory) return;
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
              <h3 className="cafe-form-span2">{editingCatId ? "Категория" : "Новая категория"}</h3>
              <label className="cafe-form-span2">
                Название
                <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required autoFocus />
              </label>
              <label className="checkbox cafe-form-span2">
                <input
                  type="checkbox"
                  checked={Boolean(catForm.is_novelties)}
                  onChange={(e) => setCatForm({ ...catForm, is_novelties: e.target.checked })}
                />
                <span>«Новинки»</span>
              </label>
              <div className="cafe-form-span2 cafe-toolbar">
                <button type="submit">Сохранить</button>
                <button type="button" className="ghost-btn" onClick={() => setCatFormOpen(false)}>
                  Отмена
                </button>
              </div>
            </form>
          )}

          {categories.map((cat) => (
            <div key={cat.id} className="cafe-guest-card cafe-cat-card">
              <div className="cafe-cat-head">
                <h3>
                  {cat.name}
                  {cat.is_novelties && !/новинк/i.test(cat.name || "") ? (
                    <span className="muted small"> · новинки</span>
                  ) : null}
                </h3>
                <div className="cafe-toolbar cafe-cat-actions">
                  <button
                    type="button"
                    className="cafe-icon-btn"
                    title="Изменить"
                    aria-label="Изменить категорию"
                    onClick={() => {
                      setEditingCatId(cat.id);
                      setCatForm({ name: cat.name, is_novelties: Boolean(cat.is_novelties) });
                      setCatFormOpen(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
                      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="cafe-icon-btn is-danger"
                    title="Удалить"
                    aria-label="Удалить категорию"
                    onClick={() => deleteCategory(cat.id)}
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
                      <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                    </svg>
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
                    <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} required autoFocus />
                  </label>
                  <label>
                    Цена *
                    <input type="number" value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} required />
                  </label>
                  <label className="cafe-form-span2">
                    Состав
                    <textarea rows={2} value={itemForm.composition} onChange={(e) => setItemForm({ ...itemForm, composition: e.target.value })} />
                  </label>
                  <label>
                    Граммы
                    <input type="number" value={itemForm.weight_grams} onChange={(e) => setItemForm({ ...itemForm, weight_grams: e.target.value })} />
                  </label>
                  <label>
                    Ккал
                    <input type="number" value={itemForm.calories} onChange={(e) => setItemForm({ ...itemForm, calories: e.target.value })} />
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" checked={Boolean(itemForm.is_new)} onChange={(e) => setItemForm({ ...itemForm, is_new: e.target.checked })} />
                    <span>Новинка</span>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={itemForm.is_available !== false}
                      onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                    />
                    <span>В наличии</span>
                  </label>
                  <div className="cafe-form-span2 cafe-toolbar">
                    <button type="submit">Добавить</button>
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
                    <input type="number" defaultValue={item.price} onBlur={(e) => patchItem(item.id, { price: e.target.value })} />
                  </label>
                  <label className="cafe-form-span2">
                    Состав
                    <textarea rows={2} defaultValue={item.composition} onBlur={(e) => patchItem(item.id, { composition: e.target.value })} />
                  </label>
                  <label className="checkbox">
                    <input type="checkbox" checked={Boolean(item.is_new)} onChange={(e) => patchItem(item.id, { is_new: e.target.checked })} />
                    <span>Новинка</span>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={item.is_available !== false}
                      onChange={(e) => patchItem(item.id, { is_available: e.target.checked })}
                    />
                    <span>В наличии</span>
                  </label>
                  <p className="muted small cafe-form-span2">
                    Рейтинг: {item.rating_avg != null ? `★ ${item.rating_avg} (${item.rating_count})` : "пока нет"}
                  </p>
                  <div className="cafe-form-span2 cafe-ingredient-editor">
                    <span className="muted small">Можно убрать при заказе:</span>
                    <div className="cafe-ingredient-chips">
                      {(item.removable_ingredients || []).map((ing) => (
                        <span key={ing.id} className="cafe-ingredient-chip is-provider">
                          {ing.name}
                          <button type="button" className="cafe-ingredient-remove" onClick={() => deleteIngredient(item.id, ing.id)} aria-label="Удалить">
                            ×
                          </button>
                        </span>
                      ))}
                      <button
                        type="button"
                        className="cafe-ingredient-add"
                        onClick={() => {
                          const name = window.prompt("Ингредиент, который гость может убрать:");
                          if (name) addIngredient(item.id, name);
                        }}
                      >
                        + Ингредиент
                      </button>
                    </div>
                  </div>
                  <div className="cafe-form-span2 cafe-photo-gallery">
                    <span className="muted small">Фото блюда</span>
                    <div className="cafe-photo-thumbs">
                      {(item.photos || []).map((ph) => (
                        <div key={ph.id} className="cafe-photo-thumb">
                          <img src={ph.url} alt="" />
                          <button
                            type="button"
                            className="cafe-photo-thumb-x"
                            aria-label="Удалить фото"
                            onClick={() => deletePhoto(item.id, ph.id)}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <label className="cafe-photo-add-btn" title="Добавить фото">
                        <input
                          type="file"
                          accept="image/*"
                          hidden
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) uploadPhoto(item.id, file);
                            e.target.value = "";
                          }}
                        />
                        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="currentColor">
                          <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" />
                          <path d="M17 8h-2V6h-2v2H11v2h2v2h2v-2h2V8z" />
                        </svg>
                      </label>
                    </div>
                  </div>
                  <div className="cafe-toolbar">
                    <button
                      type="button"
                      className="cafe-icon-btn is-danger"
                      title="Удалить блюдо"
                      aria-label="Удалить блюдо"
                      onClick={() => deleteItem(item.id)}
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
                        <path d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {status ? <p className="status">{status}</p> : null}
    </section>
  );
}

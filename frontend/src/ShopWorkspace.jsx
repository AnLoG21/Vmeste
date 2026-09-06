import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { showToast } from "./toast.js";
import CafeDeliveryZonesEditor from "./CafeDeliveryZonesEditor.jsx";

const ORDER_STATUSES = [
  ["paid", "Оплачен"],
  ["assembling", "Собирается"],
  ["ready", "Готов"],
  ["to_courier", "Курьеру"],
  ["delivering", "В пути"],
  ["done", "Завершён"],
  ["cancelled", "Отменён"],
];

function emptyProductForm() {
  return {
    name: "",
    description: "",
    sku: "",
    unit: "шт",
    price: "0",
    category: "",
    subcategory: "",
    attrsText: "",
    is_active: true,
    is_featured: false,
    featured_order: "0",
  };
}

function attrsToText(attrs) {
  if (!attrs || typeof attrs !== "object") return "";
  return Object.entries(attrs)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
}

function textToAttrs(text) {
  const out = {};
  String(text || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const i = line.indexOf(":");
      if (i < 0) return;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k) out[k] = v;
    });
  return out;
}

/** Кабинет: каталог товаров, заказы, настройки доставки. */
export default function ShopWorkspace({ authFetch, me, initialTab = "catalog" }) {
  const [tab, setTab] = useState(initialTab);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyProductForm());
  const [stockQty, setStockQty] = useState("");
  const [stockKind, setStockKind] = useState("in");
  const [catName, setCatName] = useState("");
  const [subName, setSubName] = useState("");
  const [subParent, setSubParent] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState({});

  const selected = useMemo(
    () => products.find((p) => String(p.id) === String(selectedId)) || null,
    [products, selectedId],
  );

  useEffect(() => {
    setTab(initialTab || "catalog");
  }, [initialTab]);

  const loadCatalog = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      authFetch(`${API_URL}/shop/categories/`),
      authFetch(`${API_URL}/shop/products/`),
    ]);
    if (cRes.ok) setCategories(await cRes.json());
    if (pRes.ok) {
      const list = await pRes.json();
      setProducts(Array.isArray(list) ? list : list.results || []);
    }
  }, [authFetch]);

  const loadOrders = useCallback(async () => {
    const res = await authFetch(`${API_URL}/shop/orders/`);
    if (res.ok) {
      const list = await res.json();
      setOrders(Array.isArray(list) ? list : list.results || []);
    }
  }, [authFetch]);

  const loadSettings = useCallback(async () => {
    const res = await authFetch(`${API_URL}/shop/settings/`);
    if (res.ok) setSettings(await res.json());
  }, [authFetch]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (tab === "orders") void loadOrders();
    if (tab === "settings") void loadSettings();
  }, [tab, loadOrders, loadSettings]);

  useEffect(() => {
    if (!selected) {
      setForm(emptyProductForm());
      return;
    }
    setForm({
      name: selected.name || "",
      description: selected.description || "",
      sku: selected.sku || "",
      unit: selected.unit || "шт",
      price: String(selected.price ?? 0),
      category: selected.category != null ? String(selected.category) : "",
      subcategory: selected.subcategory != null ? String(selected.subcategory) : "",
      attrsText: attrsToText(selected.attrs),
      is_active: Boolean(selected.is_active),
      is_featured: Boolean(selected.is_featured),
      featured_order: String(selected.featured_order ?? 0),
    });
  }, [selected]);

  async function createCategory() {
    const name = catName.trim();
    if (!name) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/categories/`, {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Ошибка");
      setCatName("");
      await loadCatalog();
      showToast("Категория добавлена");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function createSubcategory() {
    if (!subParent || !subName.trim()) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/categories/${subParent}/subcategories/`, {
        method: "POST",
        body: JSON.stringify({ name: subName.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || "Ошибка");
      setSubName("");
      await loadCatalog();
      showToast("Подкатегория добавлена");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveProduct() {
    setBusy(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        sku: form.sku,
        unit: form.unit || "шт",
        price: form.price,
        category: form.category || null,
        subcategory: form.subcategory || null,
        attrs: textToAttrs(form.attrsText),
        is_active: form.is_active,
        is_featured: form.is_featured,
        featured_order: Number(form.featured_order) || 0,
      };
      if (!payload.name) throw new Error("Укажите название");
      const url = selected ? `${API_URL}/shop/products/${selected.id}/` : `${API_URL}/shop/products/`;
      const res = await authFetch(url, {
        method: selected ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сохранить");
      setSelectedId(data.id);
      await loadCatalog();
      showToast("Товар сохранён");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct() {
    if (!selected || !window.confirm(`Удалить «${selected.name}»?`)) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/products/${selected.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Не удалось удалить");
      setSelectedId(null);
      await loadCatalog();
      showToast("Удалено");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(files) {
    if (!selected || !files?.length) return;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append("image", file);
        const res = await authFetch(`${API_URL}/shop/products/${selected.id}/photos/`, {
          method: "POST",
          body: fd,
        });
        if (!res.ok) throw new Error("Ошибка загрузки фото");
      }
      await loadCatalog();
      showToast("Фото добавлены");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function applyStock() {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/products/${selected.id}/stock/`, {
        method: "POST",
        body: JSON.stringify({ kind: stockKind, qty: stockQty, reason: "Из кабинета магазина" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Ошибка склада");
      await loadCatalog();
      setStockQty("");
      showToast("Остаток обновлён");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings(patch) {
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/settings/`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Ошибка настроек");
      setSettings(data);
      showToast("Настройки сохранены");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function updateOrderStatus(orderId, statusValue) {
    const res = await authFetch(`${API_URL}/shop/orders/${orderId}/`, {
      method: "PATCH",
      body: JSON.stringify({ status: statusValue }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || "Не удалось обновить заказ", { tone: "error" });
      return;
    }
    await loadOrders();
  }

  const featuredCount = products.filter((p) => p.is_featured).length;
  const shopSlug = me?.organization_slug;
  const publicUrl = shopSlug ? `${window.location.origin}/s/${shopSlug}` : "";

  const subsForCat = useMemo(() => {
    const cat = categories.find((c) => String(c.id) === String(form.category));
    return cat?.subcategories || [];
  }, [categories, form.category]);

  return (
    <div className="shop-workspace">
      <div className="row-2" style={{ marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        {[
          ["catalog", "Каталог"],
          ["orders", "Заказы"],
          ["settings", "Доставка и оплата"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "primary-btn" : "ghost-btn"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "catalog" && (
        <div className="services-layout">
          <section className="card">
            <h2>Магазин / склад</h2>
            <p className="muted small">
              Популярных на витрине: {featuredCount}/5.
              {publicUrl ? (
                <>
                  {" "}
                  Публичная витрина:{" "}
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    {publicUrl}
                  </a>
                </>
              ) : (
                " Сохраните slug организации в профиле — появится ссылка витрины."
              )}
            </p>

            <div className="row-2" style={{ gap: 8, marginBottom: 12 }}>
              <input
                placeholder="Новая категория"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={() => void createCategory()}>
                + Категория
              </button>
            </div>
            <div className="row-2" style={{ gap: 8, marginBottom: 16 }}>
              <select value={subParent} onChange={(e) => setSubParent(e.target.value)}>
                <option value="">Категория для подкатегории</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                placeholder="Подкатегория"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
              />
              <button type="button" disabled={busy} onClick={() => void createSubcategory()}>
                + Подкат.
              </button>
            </div>

            <button
              type="button"
              className="ghost-btn"
              style={{ marginBottom: 12 }}
              onClick={() => {
                setSelectedId(null);
                setForm(emptyProductForm());
              }}
            >
              + Новый товар
            </button>

            <div className="tree-list catalog-tree">
              {categories.map((cat) => {
                const open = categoryOpen[cat.id] ?? true;
                const catProducts = products.filter((p) => Number(p.category) === Number(cat.id));
                const loose = products.filter((p) => !p.category);
                return (
                  <div key={cat.id} className="tree-node catalog-tree-category">
                    <button
                      type="button"
                      className="tree-toggle"
                      onClick={() => setCategoryOpen((prev) => ({ ...prev, [cat.id]: !open }))}
                    >
                      {open ? "▼" : "▶"} {cat.name}
                      <span className="catalog-tree-meta">{catProducts.length}</span>
                    </button>
                    {open && (
                      <div className="tree-children">
                        {(cat.subcategories || []).map((sub) => {
                          const items = catProducts.filter((p) => Number(p.subcategory) === Number(sub.id));
                          return (
                            <div key={sub.id} className="catalog-tree-subcategory">
                              <div className="tree-toggle tree-toggle--sub">{sub.name}</div>
                              {items.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className={
                                    String(selectedId) === String(p.id)
                                      ? "ghost-btn catalog-tree-service is-active"
                                      : "ghost-btn catalog-tree-service"
                                  }
                                  onClick={() => setSelectedId(p.id)}
                                >
                                  {p.name}
                                  {p.is_featured ? " ★" : ""} · {Number(p.stock_qty)} {p.unit}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                        {catProducts
                          .filter((p) => !p.subcategory)
                          .map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={
                                String(selectedId) === String(p.id)
                                  ? "ghost-btn catalog-tree-service is-active"
                                  : "ghost-btn catalog-tree-service"
                              }
                              onClick={() => setSelectedId(p.id)}
                            >
                              {p.name}
                              {p.is_featured ? " ★" : ""} · {Number(p.stock_qty)} {p.unit}
                            </button>
                          ))}
                      </div>
                    )}
                    {cat === categories[0] && loose.length > 0 ? null : null}
                  </div>
                );
              })}
              {products
                .filter((p) => !p.category)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      String(selectedId) === String(p.id)
                        ? "ghost-btn catalog-tree-service is-active"
                        : "ghost-btn catalog-tree-service"
                    }
                    onClick={() => setSelectedId(p.id)}
                  >
                    {p.name}
                    {p.is_featured ? " ★" : ""} · {Number(p.stock_qty)} {p.unit}
                  </button>
                ))}
            </div>
          </section>

          <section className="card right-stack">
            <h2>{selected ? "Карточка товара" : "Новый товар"}</h2>
            <label>
              Название
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>
            <label>
              Описание
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <div className="row-2">
              <label>
                Цена
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </label>
              <label>
                Ед.
                <input
                  value={form.unit}
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </label>
            </div>
            <label>
              Артикул
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </label>
            <label>
              Категория
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: "" }))}
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Подкатегория
              <select
                value={form.subcategory}
                onChange={(e) => setForm((f) => ({ ...f, subcategory: e.target.value }))}
              >
                <option value="">—</option>
                {subsForCat.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Характеристики (строки «ключ: значение»)
              <textarea
                rows={3}
                value={form.attrsText}
                onChange={(e) => setForm((f) => ({ ...f, attrsText: e.target.value }))}
              />
            </label>
            <label className="row-2">
              <span>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />{" "}
                В продаже
              </span>
              <span>
                <input
                  type="checkbox"
                  checked={form.is_featured}
                  onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
                />{" "}
                Популярный (витрина, до 5)
              </span>
            </label>
            {form.is_featured && (
              <label>
                Порядок на витрине
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={form.featured_order}
                  onChange={(e) => setForm((f) => ({ ...f, featured_order: e.target.value }))}
                />
              </label>
            )}
            <div className="row-2" style={{ marginTop: 8 }}>
              <button type="button" className="primary-btn" disabled={busy} onClick={() => void saveProduct()}>
                Сохранить
              </button>
              {selected && (
                <button type="button" className="ghost-btn" disabled={busy} onClick={() => void deleteProduct()}>
                  Удалить
                </button>
              )}
            </div>

            {selected && (
              <>
                <h3 style={{ marginTop: 20 }}>Фото</h3>
                <div className="row-2" style={{ flexWrap: "wrap", gap: 8 }}>
                  {(selected.photos || []).map((ph) => (
                    <img
                      key={ph.id}
                      src={ph.thumb_url || ph.image}
                      alt=""
                      style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8 }}
                    />
                  ))}
                </div>
                <label className="ghost-btn" style={{ marginTop: 8, display: "inline-block" }}>
                  Добавить фото
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      void uploadPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>

                <h3 style={{ marginTop: 20 }}>Склад</h3>
                <p className="muted">
                  Остаток: <strong>{Number(selected.stock_qty)}</strong> {selected.unit}
                </p>
                <div className="row-2">
                  <select value={stockKind} onChange={(e) => setStockKind(e.target.value)}>
                    <option value="in">Приход</option>
                    <option value="out_manual">Списание</option>
                    <option value="adjust">Корректировка (+/−)</option>
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    placeholder="Кол-во"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                  />
                  <button type="button" disabled={busy} onClick={() => void applyStock()}>
                    Применить
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {tab === "orders" && (
        <section className="card">
          <h2>Заказы магазина</h2>
          {!orders.length && <p className="muted">Пока нет заказов.</p>}
          <div className="stack" style={{ gap: 12 }}>
            {orders.map((o) => (
              <article key={o.id} className="loyalty-package-card" style={{ minWidth: 0 }}>
                <strong>
                  #{o.id} · {o.mode === "delivery" ? "Доставка" : "Самовывоз"} · {o.status}
                </strong>
                <p className="muted small">
                  {o.guest_name || "Гость"} {o.guest_phone} · {Number(o.total).toLocaleString("ru-RU")} ₽
                </p>
                {o.delivery_address ? <p className="small">{o.delivery_address}</p> : null}
                <ul className="small">
                  {(o.items || []).map((it) => (
                    <li key={it.id}>
                      {it.name} × {it.quantity}
                    </li>
                  ))}
                </ul>
                <select
                  value={o.status}
                  onChange={(e) => void updateOrderStatus(o.id, e.target.value)}
                >
                  {ORDER_STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                  <option value="awaiting_payment">Ожидает оплаты</option>
                </select>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && settings && (
        <section className="card">
          <h2>Самовывоз и доставка</h2>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.enable_pickup)}
              onChange={(e) => void saveSettings({ enable_pickup: e.target.checked })}
            />{" "}
            Самовывоз
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.enable_delivery)}
              onChange={(e) => void saveSettings({ enable_delivery: e.target.checked })}
            />{" "}
            Доставка
          </label>
          <label>
            <input
              type="checkbox"
              checked={Boolean(settings.accept_online_payment)}
              onChange={(e) => void saveSettings({ accept_online_payment: e.target.checked })}
            />{" "}
            Онлайн-оплата
          </label>
          <label>
            Провайдер доставки
            <select
              value={settings.delivery_provider || "own"}
              onChange={(e) => void saveSettings({ delivery_provider: e.target.value })}
            >
              <option value="own">Свой курьер</option>
              <option value="yandex">Яндекс Доставка (скоро)</option>
              <option value="cdek">СДЭК (скоро)</option>
            </select>
          </label>
          <p className="muted small">
            Яндекс и СДЭК подключим по API после договора; сейчас работает свой курьер и зоны на карте.
          </p>
          <label>
            Стоимость доставки по умолчанию
            <input
              type="number"
              defaultValue={settings.delivery_fee}
              onBlur={(e) => void saveSettings({ delivery_fee: e.target.value })}
            />
          </label>
          <label>
            Мин. сумма заказа
            <input
              type="number"
              defaultValue={settings.delivery_min_order}
              onBlur={(e) => void saveSettings({ delivery_min_order: e.target.value })}
            />
          </label>
          <label>
            Инфо о доставке
            <textarea
              rows={2}
              defaultValue={settings.delivery_info || ""}
              onBlur={(e) => void saveSettings({ delivery_info: e.target.value })}
            />
          </label>
          <h3>Зоны доставки</h3>
          <CafeDeliveryZonesEditor
            zones={settings.delivery_zones || []}
            onChange={(zones) => void saveSettings({ delivery_zones: zones })}
          />
        </section>
      )}
    </div>
  );
}

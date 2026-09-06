import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { showToast } from "./toast.js";
import CafeDeliveryZonesEditor from "./CafeDeliveryZonesEditor.jsx";
import {
  browseShopCategoryChildren,
  searchShopCategoryPool,
} from "./shopCategoryPool.js";
import "./cafeProvider.css";

const ORDER_STATUSES = [
  ["awaiting_payment", "Ожидает оплаты"],
  ["paid", "Оплачен"],
  ["assembling", "Собирается"],
  ["ready", "Готов"],
  ["to_courier", "Курьеру"],
  ["delivering", "В пути"],
  ["done", "Завершён"],
  ["cancelled", "Отменён"],
];

const STOCK_ACTIONS = [
  { kind: "in", label: "Добавить на склад (приход)" },
  { kind: "out_manual", label: "Списать со склада" },
  { kind: "adjust", label: "Установить остаток (+/−)" },
];

function emptyProductForm() {
  return {
    name: "",
    description: "",
    sku: "",
    unit: "шт",
    price: "0",
    category: "",
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

function CameraPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2H9zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.35" />
    </svg>
  );
}

function Field({ label, children }) {
  return (
    <label className="shop-field">
      <span className="shop-field-label">{label}</span>
      {children}
    </label>
  );
}

/** Кабинет: каталог товаров, заказы, настройки доставки. */
export default function ShopWorkspace({ authFetch, me }) {
  const [tab, setTab] = useState("catalog");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyProductForm());
  const [stockQty, setStockQty] = useState("");
  const [stockKind, setStockKind] = useState("in");
  const [busy, setBusy] = useState(false);
  const [browseStack, setBrowseStack] = useState([]);
  const [ownStack, setOwnStack] = useState([]);
  const [poolQuery, setPoolQuery] = useState("");
  const [poolHits, setPoolHits] = useState([]);

  const selected = useMemo(
    () => products.find((p) => String(p.id) === String(selectedId)) || null,
    [products, selectedId],
  );

  const loadCatalog = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([
      authFetch(`${API_URL}/shop/categories/`),
      authFetch(`${API_URL}/shop/products/`),
    ]);
    if (cRes.ok) {
      const list = await cRes.json();
      setCategories(Array.isArray(list) ? list : list.results || []);
    }
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
      attrsText: attrsToText(selected.attrs),
      is_active: Boolean(selected.is_active),
      is_featured: Boolean(selected.is_featured),
      featured_order: String(selected.featured_order ?? 0),
    });
  }, [selected]);

  useEffect(() => {
    setPoolHits(searchShopCategoryPool(poolQuery, 36));
  }, [poolQuery]);

  const rootCats = useMemo(
    () => categories.filter((c) => !c.parent),
    [categories],
  );

  const currentOwnParentId = ownStack.length ? ownStack[ownStack.length - 1].id : null;
  const ownChildren = useMemo(() => {
    if (!currentOwnParentId) return rootCats;
    return categories.filter((c) => Number(c.parent) === Number(currentOwnParentId));
  }, [categories, currentOwnParentId, rootCats]);

  const productsInView = useMemo(() => {
    if (!currentOwnParentId) {
      return products.filter((p) => !p.category || Number(p.category) === 0);
    }
    return products.filter((p) => Number(p.category) === Number(currentOwnParentId));
  }, [products, currentOwnParentId]);

  const poolNodes = browseShopCategoryChildren(browseStack);

  async function addFromPool(path) {
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/categories/from-pool/`, {
        method: "POST",
        body: JSON.stringify({ path }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось добавить категорию");
      await loadCatalog();
      const leafName = data.leaf?.name || data.name || path[path.length - 1]?.name;
      showToast(`Категория «${leafName}» добавлена`);
      setPoolQuery("");
      setBrowseStack([]);
      const nav = data.path || [];
      if (nav.length) {
        setOwnStack(nav.map((c) => ({ id: c.id, name: c.name })));
      }
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
        category: form.category || currentOwnParentId || null,
        subcategory: null,
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
    const room = Math.max(0, 5 - (selected.photos || []).length);
    if (!room) {
      showToast("Можно не больше 5 фото", { tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      Array.from(files)
        .slice(0, room)
        .forEach((file) => fd.append("image", file));
      const res = await authFetch(`${API_URL}/shop/products/${selected.id}/photos/`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Ошибка загрузки фото");
      }
      await loadCatalog();
      showToast("Фото добавлены");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(photoId) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/products/${selected.id}/photos/${photoId}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Не удалось удалить фото");
      await loadCatalog();
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

  return (
    <div className="shop-workspace">
      <div className="row-2 shop-tabs">
        {[
          ["catalog", "Каталог"],
          ["orders", "Заказы"],
          ["settings", "Самовывоз и доставка"],
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
                  Витрина:{" "}
                  <a href={publicUrl} target="_blank" rel="noreferrer">
                    {publicUrl}
                  </a>
                </>
              ) : null}
            </p>

            <h3 className="shop-section-title">Добавить категорию из каталога</h3>
            <Field label="Поиск категории">
              <input
                value={poolQuery}
                onChange={(e) => setPoolQuery(e.target.value)}
                placeholder="Например: краска, масла, фильтры…"
              />
            </Field>
            {poolQuery.trim() ? (
              <ul className="shop-pool-hits">
                {poolHits.map(({ node, path }) => (
                  <li key={node.key}>
                    <button type="button" disabled={busy} onClick={() => void addFromPool(path)}>
                      {path.map((p) => p.name).join(" → ")}
                    </button>
                  </li>
                ))}
                {!poolHits.length ? <li className="muted small">Ничего не найдено</li> : null}
              </ul>
            ) : (
              <div className="shop-pool-browse">
                {browseStack.length ? (
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setBrowseStack((s) => s.slice(0, -1))}
                  >
                    ← Назад
                  </button>
                ) : null}
                <div className="shop-pool-grid">
                  {poolNodes.map((n) => (
                    <button
                      key={n.key}
                      type="button"
                      className="shop-pool-chip"
                      onClick={() => {
                        if (n.children?.length) setBrowseStack((s) => [...s, { key: n.key, name: n.name }]);
                        else void addFromPool([...browseStack, { key: n.key, name: n.name }]);
                      }}
                    >
                      {n.name}
                      {n.children?.length ? " ›" : " +"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <h3 className="shop-section-title">Ваши категории</h3>
            <div className="shop-own-nav">
              <button type="button" className="ghost-btn" onClick={() => setOwnStack([])}>
                Корень
              </button>
              {ownStack.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  className="ghost-btn"
                  onClick={() => setOwnStack((prev) => prev.slice(0, idx + 1))}
                >
                  › {s.name}
                </button>
              ))}
            </div>
            <div className="tree-list catalog-tree">
              {ownChildren.map((cat) => {
                const childCount = (cat.children || []).length;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="tree-toggle"
                    onClick={() => setOwnStack((prev) => [...prev, { id: cat.id, name: cat.name }])}
                  >
                    {childCount ? "▶ " : ""}
                    {cat.name}
                    {childCount ? (
                      <span className="catalog-tree-meta">{childCount}</span>
                    ) : null}
                  </button>
                );
              })}
              {productsInView.map((p) => (
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
            <button
              type="button"
              className="ghost-btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                setSelectedId(null);
                setForm({
                  ...emptyProductForm(),
                  category: currentOwnParentId ? String(currentOwnParentId) : "",
                });
              }}
            >
              + Новый товар здесь
            </button>
          </section>

          <section className="card right-stack">
            <h2>{selected ? "Карточка товара" : "Новый товар"}</h2>
            <Field label="Название">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Описание">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <div className="row-2">
              <Field label="Цена, ₽">
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                />
              </Field>
              <Field label="Единица">
                <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} />
              </Field>
            </div>
            <Field label="Артикул">
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </Field>
            <Field label="Характеристики (строки «ключ: значение»)">
              <textarea
                rows={3}
                value={form.attrsText}
                onChange={(e) => setForm((f) => ({ ...f, attrsText: e.target.value }))}
              />
            </Field>
            <label className="shop-check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              В продаже
            </label>
            <label className="shop-check">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
              />
              Показывать в популярных на карточке (до 5)
            </label>
            {form.is_featured ? (
              <Field label="Порядок на витрине (0–4)">
                <input
                  type="number"
                  min="0"
                  max="4"
                  value={form.featured_order}
                  onChange={(e) => setForm((f) => ({ ...f, featured_order: e.target.value }))}
                />
              </Field>
            ) : null}
            <div className="row-2" style={{ marginTop: 8 }}>
              <button type="button" className="primary-btn" disabled={busy} onClick={() => void saveProduct()}>
                Сохранить
              </button>
              {selected ? (
                <button type="button" className="ghost-btn" disabled={busy} onClick={() => void deleteProduct()}>
                  Удалить
                </button>
              ) : null}
            </div>

            {selected ? (
              <>
                <h3 className="shop-section-title">Фото (до 5)</h3>
                <div className="shop-photos">
                  {(selected.photos || []).map((ph) => (
                    <button
                      key={ph.id}
                      type="button"
                      className="shop-photo-chip"
                      title="Удалить фото"
                      onClick={() => void deletePhoto(ph.id)}
                    >
                      <img src={ph.thumb_url || ph.image} alt="" />
                      <span aria-hidden>×</span>
                    </button>
                  ))}
                  {(selected.photos || []).length < 5 ? (
                    <label className="service-editor-camera-btn shop-photo-add" title="Добавить фото">
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
                      <CameraPlusIcon />
                      <span className="service-editor-camera-plus" aria-hidden>
                        +
                      </span>
                    </label>
                  ) : null}
                </div>

                <h3 className="shop-section-title">Склад</h3>
                <p className="muted">
                  Сейчас на складе: <strong>{Number(selected.stock_qty)}</strong> {selected.unit}
                </p>
                <Field label="Действие">
                  <select value={stockKind} onChange={(e) => setStockKind(e.target.value)}>
                    {STOCK_ACTIONS.map((a) => (
                      <option key={a.kind} value={a.kind}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Количество">
                  <input
                    type="number"
                    step="0.001"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                  />
                </Field>
                <button type="button" disabled={busy} onClick={() => void applyStock()}>
                  Применить
                </button>
              </>
            ) : null}
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
                <select value={o.status} onChange={(e) => void updateOrderStatus(o.id, e.target.value)}>
                  {ORDER_STATUSES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && settings && (
        <section className="card shop-settings">
          <h2>Самовывоз и доставка</h2>
          <label className="shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.enable_pickup)}
              onChange={(e) => void saveSettings({ enable_pickup: e.target.checked })}
            />
            Самовывоз
          </label>
          <label className="shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.enable_delivery)}
              onChange={(e) => void saveSettings({ enable_delivery: e.target.checked })}
            />
            Доставка
          </label>
          <label className="shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.accept_online_payment)}
              onChange={(e) => void saveSettings({ accept_online_payment: e.target.checked })}
            />
            Онлайн-оплата
          </label>

          <Field label="Провайдер доставки">
            <select
              value={settings.delivery_provider || "own"}
              onChange={(e) => void saveSettings({ delivery_provider: e.target.value })}
            >
              <option value="own">Свой курьер</option>
              <option value="yandex">Яндекс Доставка (скоро)</option>
              <option value="cdek">СДЭК (скоро)</option>
            </select>
          </Field>
          <p className="muted small">Яндекс и СДЭК подключим по API позже; сейчас — свой курьер и зоны.</p>

          <Field label="Стоимость доставки по умолчанию, ₽">
            <input
              type="number"
              defaultValue={settings.delivery_fee}
              onBlur={(e) => void saveSettings({ delivery_fee: e.target.value })}
            />
          </Field>
          <Field label="Минимальная сумма заказа, ₽">
            <input
              type="number"
              defaultValue={settings.delivery_min_order}
              onBlur={(e) => void saveSettings({ delivery_min_order: e.target.value })}
            />
          </Field>
          <Field label="Информация о доставке">
            <textarea
              rows={3}
              defaultValue={settings.delivery_info || ""}
              onBlur={(e) => void saveSettings({ delivery_info: e.target.value })}
            />
          </Field>

          <CafeDeliveryZonesEditor
            zones={settings.delivery_zones || []}
            onChange={(zones) => void saveSettings({ delivery_zones: zones })}
          />
        </section>
      )}
    </div>
  );
}

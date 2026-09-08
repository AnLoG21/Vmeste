import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL } from "./config.js";
import { showToast } from "./toast.js";
import CafeDeliveryZonesEditor from "./CafeDeliveryZonesEditor.jsx";
import {
  browseShopCategoryChildren,
  searchShopCategoryPool,
} from "./shopCategoryPool.js";
import { attrSchemaForPoolKey } from "./shopCategoryAttrs.js";
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

const RETURN_STATUSES = [
  ["pending", "На рассмотрении"],
  ["approved", "Одобрен"],
  ["rejected", "Отклонён"],
  ["done", "Выполнен"],
];

function nextOrderStatus(status, mode) {
  if (status === "paid") return "assembling";
  if (status === "assembling") return "ready";
  if (status === "ready") return mode === "pickup" ? "done" : "to_courier";
  if (status === "to_courier") return "delivering";
  if (status === "delivering") return "done";
  return "";
}

function nextOrderStatusLabel(status, mode) {
  const n = nextOrderStatus(status, mode);
  return ORDER_STATUSES.find(([v]) => v === n)?.[1] || "";
}

const STOCK_ACTIONS = [
  {
    kind: "in",
    label: "Добавить на склад (приход)",
    hint: "Увеличивает остаток — когда товар привезли или закупили.",
  },
  {
    kind: "out_manual",
    label: "Списать со склада",
    hint: "Уменьшает остаток — порча, использование вне услуг или ручное списание.",
  },
  {
    kind: "adjust",
    label: "Установить остаток",
    hint: "Задаёт точное количество после инвентаризации (можно указать отрицательное для уменьшения).",
  },
];

function emptyProductForm(category = "") {
  return {
    name: "",
    description: "",
    sku: "",
    unit: "",
    price: "0",
    category: category ? String(category) : "",
    attrs: {},
    attrsExtra: "",
    sizes: [],
    related_product_ids: [],
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

function mergeAttrsFromSchema(schemaFields, attrsObj, extraText) {
  const out = { ...(attrsObj || {}) };
  const known = new Set((schemaFields || []).map((f) => f.key));
  Object.entries(textToAttrs(extraText)).forEach(([k, v]) => {
    if (!known.has(k)) out[k] = v;
  });
  Object.keys(out).forEach((k) => {
    if (out[k] == null || String(out[k]).trim() === "") delete out[k];
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

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="currentColor">
      <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
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

function categoryPathLabel(cat, byId) {
  const parts = [];
  let cur = cat;
  let guard = 0;
  while (cur && guard < 12) {
    parts.unshift(cur.name);
    cur = cur.parent ? byId.get(Number(cur.parent)) : null;
    guard += 1;
  }
  return parts.join(" → ");
}

function ProductRow({ product, selected, onEdit, onDelete }) {
  const cover = product.photos?.[0]?.thumb_url || product.photos?.[0]?.image;
  return (
    <div className={`shop-product-row${selected ? " is-active" : ""}${!product.is_active ? " is-inactive" : ""}`}>
      {cover ? <img src={cover} alt="" className="shop-product-row-photo" /> : <div className="shop-product-row-photo is-empty" />}
      <div className="shop-product-row-body">
        <strong>{product.name}</strong>
        <p className="muted small">
          {product.sku ? `арт. ${product.sku} · ` : ""}
          {Number(product.price).toLocaleString("ru-RU")} ₽ · {Number(product.stock_qty)} {product.unit || "шт"}
          {product.is_featured ? " · ★" : ""}
        </p>
      </div>
      <div className="shop-product-row-actions">
        <button type="button" className="org-icon-btn" title="Редактировать" aria-label="Редактировать" onClick={onEdit}>
          <PencilIcon />
        </button>
        <button
          type="button"
          className="org-icon-btn org-icon-btn--danger"
          title="Удалить"
          aria-label="Удалить"
          onClick={onDelete}
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
}

function CategoryBranch({
  cat,
  categories,
  products,
  categoryOpen,
  setCategoryOpen,
  selectedId,
  onEditProduct,
  onDeleteProduct,
  onCreateProduct,
  onDeleteCategory,
}) {
  const open = categoryOpen[cat.id] ?? false;
  const children = categories.filter((c) => Number(c.parent) === Number(cat.id));
  const items = products.filter((p) => Number(p.category) === Number(cat.id));
  const nestedCount = children.length + items.length;

  return (
    <div className="tree-node catalog-tree-category">
      <div className="shop-cat-head">
        <button
          type="button"
          className="tree-toggle"
          onClick={() => setCategoryOpen((prev) => ({ ...prev, [cat.id]: !open }))}
        >
          {open ? "▼" : "▶"} {cat.name}
          <span className="catalog-tree-meta">{nestedCount}</span>
        </button>
        <button
          type="button"
          className="org-icon-btn org-icon-btn--danger"
          title="Удалить категорию"
          aria-label="Удалить категорию"
          onClick={() => onDeleteCategory(cat)}
        >
          <TrashIcon />
        </button>
      </div>
      {open ? (
        <div className="tree-children">
          {children.map((child) => (
            <CategoryBranch
              key={child.id}
              cat={child}
              categories={categories}
              products={products}
              categoryOpen={categoryOpen}
              setCategoryOpen={setCategoryOpen}
              selectedId={selectedId}
              onEditProduct={onEditProduct}
              onDeleteProduct={onDeleteProduct}
              onCreateProduct={onCreateProduct}
              onDeleteCategory={onDeleteCategory}
            />
          ))}
          <div className="tree-children catalog-tree-services">
            {items.map((p) => (
              <ProductRow
                key={p.id}
                product={p}
                selected={String(selectedId) === String(p.id)}
                onEdit={() => onEditProduct(p.id)}
                onDelete={() => onDeleteProduct(p)}
              />
            ))}
          </div>
          <button type="button" className="ghost-btn shop-create-here" onClick={() => onCreateProduct(cat.id)}>
            + Создать товар здесь
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Кабинет: каталог товаров, заказы, настройки доставки. */
export default function ShopWorkspace({ authFetch, me }) {
  const [tab, setTab] = useState("catalog");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returnsList, setReturnsList] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(emptyProductForm());
  const [stockQty, setStockQty] = useState("");
  const [stockKind, setStockKind] = useState("in");
  const [busy, setBusy] = useState(false);
  const [browseStack, setBrowseStack] = useState([]);
  const [poolQuery, setPoolQuery] = useState("");
  const [poolHits, setPoolHits] = useState([]);
  const [categoryOpen, setCategoryOpen] = useState({});

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

  const loadReturns = useCallback(async () => {
    const res = await authFetch(`${API_URL}/shop/returns/`);
    if (res.ok) {
      const list = await res.json();
      setReturnsList(Array.isArray(list) ? list : []);
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
    if (tab === "returns") void loadReturns();
    if (tab === "settings") void loadSettings();
  }, [tab, loadOrders, loadReturns, loadSettings]);

  const rootCats = useMemo(() => categories.filter((c) => !c.parent), [categories]);
  const looseProducts = useMemo(
    () => products.filter((p) => !p.category || Number(p.category) === 0),
    [products],
  );

  const categoryById = useMemo(() => {
    const map = new Map();
    categories.forEach((c) => map.set(Number(c.id), c));
    return map;
  }, [categories]);

  useEffect(() => {
    if (!selected) return;
    const attrs = selected.attrs && typeof selected.attrs === "object" ? { ...selected.attrs } : {};
    const poolKey = categoryById.get(Number(selected.category))?.pool_key || "";
    const schema = attrSchemaForPoolKey(poolKey);
    const known = new Set((schema.fields || []).map((f) => f.key));
    const extraLines = [];
    Object.entries(attrs).forEach(([k, v]) => {
      if (!known.has(k)) extraLines.push(`${k}: ${v}`);
    });
    setForm({
      name: selected.name || "",
      description: selected.description || "",
      sku: selected.sku || "",
      unit: selected.unit || "",
      price: String(selected.price ?? 0),
      category: selected.category != null ? String(selected.category) : "",
      attrs,
      sizes: Array.isArray(selected.sizes) ? selected.sizes.map(String) : [],
      related_product_ids: Array.isArray(selected.related_product_ids)
        ? selected.related_product_ids.map(Number)
        : [],
      is_active: Boolean(selected.is_active),
      is_featured: Boolean(selected.is_featured),
      featured_order: String(selected.featured_order ?? 0),
      attrsExtra: extraLines.join("\n"),
    });
  }, [selected, categoryById]);

  useEffect(() => {
    setPoolHits(searchShopCategoryPool(poolQuery, 36));
  }, [poolQuery]);

  const categoryOptions = useMemo(
    () =>
      categories
        .map((c) => ({ id: c.id, label: categoryPathLabel(c, categoryById), pool_key: c.pool_key || "" }))
        .sort((a, b) => a.label.localeCompare(b.label, "ru")),
    [categories, categoryById],
  );

  const selectedPoolKey = useMemo(() => {
    if (!form.category) return "";
    return categoryById.get(Number(form.category))?.pool_key || "";
  }, [form.category, categoryById]);

  const attrSchema = useMemo(() => attrSchemaForPoolKey(selectedPoolKey), [selectedPoolKey]);

  const relatedCandidates = useMemo(
    () =>
      products.filter(
        (p) =>
          String(p.id) !== String(selectedId || "") &&
          p.is_active !== false,
      ),
    [products, selectedId],
  );

  const poolNodes = browseShopCategoryChildren(browseStack);
  const stockHint = STOCK_ACTIONS.find((a) => a.kind === stockKind)?.hint || "";

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
        setCategoryOpen((prev) => {
          const next = { ...prev };
          nav.forEach((c) => {
            next[c.id] = true;
          });
          return next;
        });
      }
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function startCreate(categoryId) {
    setSelectedId(null);
    setForm(emptyProductForm(categoryId || ""));
  }

  async function saveProduct() {
    setBusy(true);
    try {
      const attrs = mergeAttrsFromSchema(attrSchema.fields, form.attrs, form.attrsExtra);
      const payload = {
        name: form.name.trim(),
        description: form.description,
        sku: form.sku,
        unit: form.unit.trim() || "шт",
        price: form.price,
        category: form.category || null,
        subcategory: null,
        attrs,
        sizes: Array.isArray(form.sizes) ? form.sizes : [],
        related_product_ids: (form.related_product_ids || []).map(Number),
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
      if (data.category) {
        setCategoryOpen((prev) => ({ ...prev, [data.category]: true }));
      }
      await loadCatalog();
      showToast("Товар сохранён");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product) {
    const target = product || selected;
    if (!target || !window.confirm(`Удалить «${target.name}»?`)) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/products/${target.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Не удалось удалить");
      if (String(selectedId) === String(target.id)) {
        setSelectedId(null);
        setForm(emptyProductForm());
      }
      await loadCatalog();
      showToast("Удалено");
    } catch (e) {
      showToast(e.message || "Ошибка", { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function deleteCategory(cat) {
    if (!window.confirm(`Удалить категорию «${cat.name}» и вложенные? Товары останутся без категории.`)) return;
    setBusy(true);
    try {
      const res = await authFetch(`${API_URL}/shop/categories/${cat.id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error("Не удалось удалить категорию");
      await loadCatalog();
      showToast("Категория удалена");
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
    showToast("Статус обновлён");
    await loadOrders();
  }

  async function updateReturnStatus(returnId, statusValue) {
    const res = await authFetch(`${API_URL}/shop/returns/`, {
      method: "PATCH",
      body: JSON.stringify({ id: returnId, status: statusValue }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showToast(data.detail || "Не удалось обновить возврат", { tone: "error" });
      return;
    }
    showToast(
      data.refund_id ? "Возврат одобрен, деньги отправлены в ЮKassa" : "Заявка обновлена",
    );
    await loadReturns();
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
          ["returns", "Возвраты"],
          ["settings", "Настройки"],
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
            <div className="catalog-tree-head">
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
            </div>

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
            <div className="tree-list catalog-tree">
              {rootCats.map((cat) => (
                <CategoryBranch
                  key={cat.id}
                  cat={cat}
                  categories={categories}
                  products={products}
                  categoryOpen={categoryOpen}
                  setCategoryOpen={setCategoryOpen}
                  selectedId={selectedId}
                  onEditProduct={setSelectedId}
                  onDeleteProduct={(p) => void deleteProduct(p)}
                  onCreateProduct={startCreate}
                  onDeleteCategory={(c) => void deleteCategory(c)}
                />
              ))}
              {looseProducts.length ? (
                <div className="tree-children catalog-tree-services">
                  <p className="muted small">Без категории</p>
                  {looseProducts.map((p) => (
                    <ProductRow
                      key={p.id}
                      product={p}
                      selected={String(selectedId) === String(p.id)}
                      onEdit={() => setSelectedId(p.id)}
                      onDelete={() => void deleteProduct(p)}
                    />
                  ))}
                </div>
              ) : null}
              {!rootCats.length && !looseProducts.length ? (
                <p className="muted small">Добавьте категорию из каталога выше.</p>
              ) : null}
            </div>
          </section>

          <section className="card right-stack">
            <h2>{selected ? "Карточка товара" : "Новый товар"}</h2>
            <Field label="Название">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Категория">
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                <option value="">Без категории</option>
                {categoryOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
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
                <input
                  value={form.unit}
                  placeholder="шт"
                  onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                />
              </Field>
            </div>
            <Field label="Артикул">
              <input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </Field>

            <div className="shop-adaptive-attrs">
              <p className="shop-field-label">Характеристики {selectedPoolKey ? "(по категории)" : ""}</p>
              {(attrSchema.fields || []).map((field) => (
                <Field key={field.key} label={field.key}>
                  {field.type === "select" ? (
                    <select
                      value={form.attrs?.[field.key] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          attrs: { ...f.attrs, [field.key]: e.target.value },
                        }))
                      }
                    >
                      <option value="">Не указано</option>
                      {(field.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      rows={2}
                      placeholder={field.placeholder || ""}
                      value={form.attrs?.[field.key] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          attrs: { ...f.attrs, [field.key]: e.target.value },
                        }))
                      }
                    />
                  ) : (
                    <input
                      placeholder={field.placeholder || ""}
                      value={form.attrs?.[field.key] || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          attrs: { ...f.attrs, [field.key]: e.target.value },
                        }))
                      }
                    />
                  )}
                </Field>
              ))}
              <Field label="Дополнительно (строки «ключ: значение»)">
                <textarea
                  rows={2}
                  value={form.attrsExtra || ""}
                  placeholder={"Гарантия: 12 мес.\nСтрана: Италия"}
                  onChange={(e) => setForm((f) => ({ ...f, attrsExtra: e.target.value }))}
                />
              </Field>
            </div>

            {attrSchema.sizeOptions?.length ? (
              <div className="shop-sizes-picker">
                <p className="shop-field-label">Доступные размеры</p>
                <div className="shop-size-chips">
                  {attrSchema.sizeOptions.map((sz) => {
                    const on = (form.sizes || []).includes(sz);
                    return (
                      <button
                        key={sz}
                        type="button"
                        className={`shop-size-chip${on ? " is-on" : ""}`}
                        onClick={() =>
                          setForm((f) => {
                            const cur = new Set(f.sizes || []);
                            if (cur.has(sz)) cur.delete(sz);
                            else cur.add(sz);
                            return { ...f, sizes: [...cur] };
                          })
                        }
                      >
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <Field label="Размеры (через запятую, если нужны)">
                <input
                  value={(form.sizes || []).join(", ")}
                  placeholder="S, M, L"
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sizes: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </Field>
            )}

            <Field label="Связанные товары">
              <select
                multiple
                size={Math.min(6, Math.max(3, relatedCandidates.length || 3))}
                value={(form.related_product_ids || []).map(String)}
                onChange={(e) => {
                  const ids = Array.from(e.target.selectedOptions).map((o) => Number(o.value));
                  setForm((f) => ({ ...f, related_product_ids: ids }));
                }}
              >
                {relatedCandidates.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span className="muted small">Ctrl/⌘ — выбрать несколько. Показываются под фото в карточке.</span>
            </Field>

            <label className="checkbox shop-check">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
              />
              <span>В продаже</span>
            </label>
            <label className="checkbox shop-check">
              <input
                type="checkbox"
                checked={form.is_featured}
                onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))}
              />
              <span>Показывать в популярных на карточке (до 5)</span>
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

            {selected ? (
              <div className="shop-auth-box">
                <p className="field-label">Подлинность (оранжевая галочка)</p>
                <p className="muted small">
                  Статус:{" "}
                  {selected.authenticity_status === "verified"
                    ? "оригинал подтверждён"
                    : selected.authenticity_status === "pending"
                      ? "на проверке"
                      : selected.authenticity_status === "rejected"
                        ? "отклонён"
                        : "не заявлен"}
                </p>
                <div className="row-2" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const { requestAuthenticity } = await import("./vmagazine/vmagazineApi.js");
                        await requestAuthenticity(authFetch, API_URL, selected.id, "Заявка на проверку оригинала");
                        showToast("Заявка на проверку отправлена");
                        await loadCatalog();
                      } catch (e) {
                        showToast(e.message || "Ошибка");
                      }
                    }}
                  >
                    Запросить проверку
                  </button>
                  <button
                    type="button"
                    className="ghost-btn"
                    disabled={busy}
                    onClick={async () => {
                      try {
                        const { verifyAuthenticity } = await import("./vmagazine/vmagazineApi.js");
                        await verifyAuthenticity(authFetch, API_URL, selected.id, "verify");
                        showToast("Товар отмечен как оригинал");
                        await loadCatalog();
                      } catch (e) {
                        showToast(e.message || "Ошибка");
                      }
                    }}
                  >
                    Подтвердить оригинал
                  </button>
                </div>
              </div>
            ) : null}

            {selected ? (
              <>
                <h3 className="shop-section-title">Фото (до 5)</h3>
                <div className="shop-photos">
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
                </div>
              </>
            ) : (
              <p className="muted small">Сначала сохраните товар — затем можно добавить фото.</p>
            )}

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
                <h3 className="shop-section-title">Склад</h3>
                <p className="muted">
                  Сейчас на складе: <strong>{Number(selected.stock_qty)}</strong> {selected.unit || "шт"}
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
                <p className="muted small shop-stock-hint">{stockHint}</p>
                <Field label="Количество">
                  <input
                    type="number"
                    step="0.001"
                    value={stockQty}
                    onChange={(e) => setStockQty(e.target.value)}
                    placeholder="Например: 10"
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
          <p className="muted small">Меняйте статус по шагам сборки — покупатель получит пуш.</p>
          {!orders.length && <p className="muted">Пока нет заказов.</p>}
          <div className="stack" style={{ gap: 12 }}>
            {orders.map((o) => {
              const next = nextOrderStatus(o.status, o.mode);
              const nextLabel = nextOrderStatusLabel(o.status, o.mode);
              return (
                <article key={o.id} className="loyalty-package-card" style={{ minWidth: 0 }}>
                  <strong>
                    #{o.id} · {o.mode === "delivery" ? "Доставка" : "Самовывоз"} ·{" "}
                    {ORDER_STATUSES.find(([v]) => v === o.status)?.[1] || o.status}
                  </strong>
                  {o.mode === "delivery" && (o.chosen_delivery_provider || o.eta_text) ? (
                    <p className="muted small">
                      {o.chosen_delivery_provider === "yandex"
                        ? "Яндекс Доставка"
                        : o.chosen_delivery_provider === "cdek"
                          ? "СДЭК"
                          : o.chosen_delivery_provider === "russian_post"
                            ? "Почта России"
                            : o.chosen_delivery_provider === "dostavista"
                              ? "Dostavista"
                              : o.chosen_delivery_provider === "own"
                                ? "Курьер продавца"
                                : o.chosen_delivery_provider || "Доставка"}
                      {o.eta_text ? ` · ≈ ${o.eta_text}` : ""}
                    </p>
                  ) : null}
                  <p className="muted small">
                    {o.guest_name || "Гость"} {o.guest_phone} · {Number(o.total).toLocaleString("ru-RU")} ₽
                    {Number(o.bonus_spent) > 0
                      ? ` · бонусы −${Number(o.bonus_spent).toLocaleString("ru-RU")} ₽`
                      : ""}
                  </p>
                  {o.external_tracking_id ? (
                    <p className="small">
                      Доставка ({o.external_delivery_provider || "—"}):{" "}
                      <code>{o.external_tracking_id}</code>
                    </p>
                  ) : null}
                  {o.delivery_address ? <p className="small">{o.delivery_address}</p> : null}
                  <ul className="small">
                    {(o.items || []).map((it) => (
                      <li key={it.id}>
                        {it.name}
                        {it.selected_size ? ` · ${it.selected_size}` : ""} × {it.quantity}
                      </li>
                    ))}
                  </ul>
                  <div className="row-2" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    {next ? (
                      <button
                        type="button"
                        className="primary-btn"
                        onClick={() => void updateOrderStatus(o.id, next)}
                      >
                        → {nextLabel}
                      </button>
                    ) : null}
                    <select value={o.status} onChange={(e) => void updateOrderStatus(o.id, e.target.value)}>
                      {ORDER_STATUSES.map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {tab === "returns" && (
        <section className="card">
          <h2>Возвраты</h2>
          <p className="muted small">
            Одобрение по онлайн-заказу попытается вернуть сумму позиции через ЮKassa.
          </p>
          {!returnsList.length ? <p className="muted">Заявок пока нет.</p> : null}
          <div className="stack" style={{ gap: 12 }}>
            {returnsList.map((r) => (
              <article key={r.id} className="loyalty-package-card">
                <strong>
                  #{r.id} · заказ #{r.order_id} ·{" "}
                  {RETURN_STATUSES.find(([v]) => v === r.status)?.[1] || r.status}
                </strong>
                <p className="small">
                  {r.product_name}
                  {r.selected_size ? ` · ${r.selected_size}` : ""} × {r.quantity} —{" "}
                  {Number(r.line_total).toLocaleString("ru-RU")} ₽
                </p>
                <p className="muted small">
                  {r.client_name} {r.client_phone}
                </p>
                {r.reason ? <p className="small">{r.reason}</p> : null}
                {r.refund_id ? (
                  <p className="muted small">
                    Refund: <code>{r.refund_id}</code>
                  </p>
                ) : null}
                {r.status === "pending" ? (
                  <div className="row-2" style={{ gap: 8 }}>
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => void updateReturnStatus(r.id, "approved")}
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void updateReturnStatus(r.id, "rejected")}
                    >
                      Отклонить
                    </button>
                  </div>
                ) : r.status === "approved" ? (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => void updateReturnStatus(r.id, "done")}
                  >
                    Отметить выполненным
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "settings" && settings && (
        <section className="card shop-settings">
          <h2>Самовывоз и доставка</h2>
          <label className="checkbox shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.enable_pickup)}
              onChange={(e) => void saveSettings({ enable_pickup: e.target.checked })}
            />
            <span>Самовывоз</span>
          </label>
          <label className="checkbox shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.enable_delivery)}
              onChange={(e) => void saveSettings({ enable_delivery: e.target.checked })}
            />
            <span>Доставка</span>
          </label>
          <label className="checkbox shop-check">
            <input
              type="checkbox"
              checked={Boolean(settings.accept_online_payment)}
              onChange={(e) => void saveSettings({ accept_online_payment: e.target.checked })}
            />
            <span>Онлайн-оплата</span>
          </label>

          <h3 className="shop-section-title">Вбонусы</h3>
          <p className="muted small">Начисление после статуса «Завершён». Списание — на оформлении у покупателя.</p>
          <Field label="Начисление, % от суммы позиций">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={settings.bonus_earn_percent ?? 0}
              onBlur={(e) => void saveSettings({ bonus_earn_percent: e.target.value || 0 })}
            />
          </Field>
          <Field label="Макс. оплата бонусами, % от товаров">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={settings.bonus_max_spend_percent ?? 50}
              onBlur={(e) => void saveSettings({ bonus_max_spend_percent: e.target.value || 50 })}
            />
          </Field>

          {settings.enable_delivery ? (
            <div className="shop-delivery-methods">
              <h3 className="shop-section-title">Способы доставки для покупателя</h3>
              <p className="muted small">
                Можно включить несколько. Покупатель выберет удобный способ и увидит примерный срок.
              </p>
              <label className="checkbox shop-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_own_courier)}
                  onChange={(e) => void saveSettings({ enable_own_courier: e.target.checked })}
                />
                <span>Курьер продавца</span>
              </label>
              {settings.enable_own_courier ? (
                <Field label="Срок для курьера продавца">
                  <input
                    defaultValue={settings.own_eta_text || "1–3 часа"}
                    onBlur={(e) => void saveSettings({ own_eta_text: e.target.value.trim() || "1–3 часа" })}
                    placeholder="1–3 часа"
                  />
                </Field>
              ) : null}

              <label className="checkbox shop-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_yandex_delivery)}
                  onChange={(e) => void saveSettings({ enable_yandex_delivery: e.target.checked })}
                />
                <span>Яндекс Доставка</span>
              </label>
              {settings.enable_yandex_delivery ? (
                <>
                  <Field label="Срок для Яндекс Доставки">
                    <input
                      defaultValue={settings.yandex_eta_text || "от 40 минут"}
                      onBlur={(e) => void saveSettings({ yandex_eta_text: e.target.value.trim() || "от 40 минут" })}
                      placeholder="от 40 минут"
                    />
                  </Field>
                  <Field label="Токен Яндекс Доставки">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        settings.has_yandex_token
                          ? "•••••••• (сохранён, введите новый чтобы заменить)"
                          : "Bearer-токен из кабинета Яндекс Доставки"
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void saveSettings({ yandex_delivery_token: v });
                        e.target.value = "";
                      }}
                    />
                  </Field>
                </>
              ) : null}

              <label className="checkbox shop-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_cdek_delivery)}
                  onChange={(e) => void saveSettings({ enable_cdek_delivery: e.target.checked })}
                />
                <span>СДЭК</span>
              </label>
              {settings.enable_cdek_delivery ? (
                <>
                  <Field label="Срок для СДЭК">
                    <input
                      defaultValue={settings.cdek_eta_text || "1–5 дней"}
                      onBlur={(e) => void saveSettings({ cdek_eta_text: e.target.value.trim() || "1–5 дней" })}
                      placeholder="1–5 дней"
                    />
                  </Field>
                  <Field label="СДЭК Account (client_id)">
                    <input
                      defaultValue={settings.cdek_client_id || ""}
                      onBlur={(e) => void saveSettings({ cdek_client_id: e.target.value.trim() })}
                      placeholder="Идентификатор из кабинета СДЭК"
                    />
                  </Field>
                  <Field label="СДЭК Secure password (client_secret)">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        settings.has_cdek_secret
                          ? "•••••••• (сохранён, введите новый чтобы заменить)"
                          : "Секретный ключ СДЭК"
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void saveSettings({ cdek_client_secret: v });
                        e.target.value = "";
                      }}
                    />
                  </Field>
                </>
              ) : null}

              <label className="checkbox shop-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_russian_post)}
                  onChange={(e) => void saveSettings({ enable_russian_post: e.target.checked })}
                />
                <span>Почта России</span>
              </label>
              {settings.enable_russian_post ? (
                <>
                  <Field label="Срок для Почты России">
                    <input
                      defaultValue={settings.russian_post_eta_text || "3–10 дней"}
                      onBlur={(e) =>
                        void saveSettings({ russian_post_eta_text: e.target.value.trim() || "3–10 дней" })
                      }
                      placeholder="3–10 дней"
                    />
                  </Field>
                  <Field label="Токен API Почты России (AccessToken)">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        settings.has_russian_post
                          ? "•••••••• (сохранён, введите новый чтобы заменить)"
                          : "Токен из ЛК otpravka.pochta.ru"
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void saveSettings({ russian_post_token: v });
                        e.target.value = "";
                      }}
                    />
                  </Field>
                  <Field label="Ключ пользователя (Basic / X-User-Authorization)">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        settings.has_russian_post
                          ? "•••••••• (сохранён)"
                          : "Ключ авторизации пользователя из ЛК"
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void saveSettings({ russian_post_user_key: v });
                        e.target.value = "";
                      }}
                    />
                  </Field>
                  <p className="muted small">В адресе получателя нужен почтовый индекс из 6 цифр.</p>
                </>
              ) : null}

              <label className="checkbox shop-check">
                <input
                  type="checkbox"
                  checked={Boolean(settings.enable_dostavista)}
                  onChange={(e) => void saveSettings({ enable_dostavista: e.target.checked })}
                />
                <span>Dostavista</span>
              </label>
              {settings.enable_dostavista ? (
                <>
                  <Field label="Срок для Dostavista">
                    <input
                      defaultValue={settings.dostavista_eta_text || "1–3 часа"}
                      onBlur={(e) =>
                        void saveSettings({ dostavista_eta_text: e.target.value.trim() || "1–3 часа" })
                      }
                      placeholder="1–3 часа"
                    />
                  </Field>
                  <Field label="Токен Dostavista (X-DV-Auth-Token)">
                    <input
                      type="password"
                      autoComplete="off"
                      placeholder={
                        settings.has_dostavista_token
                          ? "•••••••• (сохранён, введите новый чтобы заменить)"
                          : "Токен из кабинета Dostavista Business"
                      }
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v) void saveSettings({ dostavista_token: v });
                        e.target.value = "";
                      }}
                    />
                  </Field>
                </>
              ) : null}

              <p className="muted small">
                Для внешних служб нужны ключи из их ЛК. Яндекс/Dostavista — ещё адрес организации с координатами.
                Почта России — индекс в адресе. При статусе «Курьеру» заказ уходит в способ, выбранный покупателем.
              </p>
            </div>
          ) : null}

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

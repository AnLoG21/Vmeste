import { useCallback, useEffect, useMemo, useState } from "react";
import "./marketplaceWorkspace.css";

const TABS = [
  ["create", "Создать товар"],
  ["products", "Товары"],
  ["manage", "Управление"],
  ["orders", "Заказы"],
  ["analytics", "Аналитика"],
  ["reviews", "Отзывы"],
];

const emptyProduct = () => ({
  offer_id: "",
  name: "",
  brand: "",
  price: "",
  stock: "0",
  description: "",
  barcode: "",
  category: "",
  type: "",
  images: "",
});

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19) + "Z";
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(/[;,]/).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = line.split(/[;,]/);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || "").trim();
    });
    return {
      offer_id: row.offer_id || row.sku || row.артикул || "",
      name: row.name || row.title || row.название || "",
      brand: row.brand || row.бренд || "",
      price: row.price || row.цена || "0",
      stock: Number(row.stock || row.остаток || 0),
      description: row.description || row.описание || "",
      barcode: row.barcode || row.штрихкод || "",
      category: row.category || row.категория || "",
    };
  });
}

function previewJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value || "");
  }
}

export default function MarketplaceWorkspace({ authFetch, API_URL }) {
  const [tab, setTab] = useState("create");
  const [mp, setMp] = useState("ozon");
  const [settings, setSettings] = useState(null);
  const [keysForm, setKeysForm] = useState({ ozon_client_id: "", ozon_api_key: "", wb_api_key: "", environment: "sandbox" });
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [product, setProduct] = useState(emptyProduct);
  const [batch, setBatch] = useState([emptyProduct()]);
  const [csvText, setCsvText] = useState("offer_id,name,brand,price,stock,description\nSKU-1,Товар,Бренд,1290,10,Описание");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [priceStock, setPriceStock] = useState({ offer_id: "", price: "", stock: "" });
  const [templateForm, setTemplateForm] = useState({ name: "", brand: "", description_text: "", price: "", stock: "0" });
  const [aiFeatures, setAiFeatures] = useState("");

  const base = `${API_URL}/marketplaces`;

  const loadSettings = useCallback(async () => {
    const res = await authFetch(`${base}/settings/`);
    if (!res.ok) return;
    const data = await res.json();
    setSettings(data);
    setKeysForm((prev) => ({
      ...prev,
      ozon_client_id: data.ozon_client_id || "",
      environment: data.environment || "sandbox",
      ozon_api_key: data.has_ozon_api_key ? "••••••••" : "",
      wb_api_key: data.has_wb_api_key ? "••••••••" : "",
    }));
  }, [authFetch, base]);

  const loadHistory = useCallback(async () => {
    const q = search ? `&q=${encodeURIComponent(search)}` : "";
    const res = await authFetch(`${base}/history/?marketplace=${mp === "wildberries" ? "wildberries" : "ozon"}${q}`);
    if (res.ok) {
      const data = await res.json();
      setHistory(data.results || []);
    }
  }, [authFetch, base, mp, search]);

  const loadTemplates = useCallback(async () => {
    const res = await authFetch(`${base}/templates/`);
    if (res.ok) {
      const data = await res.json();
      setTemplates(data.results || []);
    }
  }, [authFetch, base]);

  useEffect(() => {
    loadSettings().catch(() => setStatus("Не удалось загрузить настройки."));
    loadTemplates().catch(() => {});
  }, [loadSettings, loadTemplates]);

  useEffect(() => {
    loadHistory().catch(() => {});
  }, [loadHistory]);

  async function readError(res) {
    const data = await res.json().catch(() => ({}));
    return data.detail || data.error || `Ошибка ${res.status}`;
  }

  async function mpCall(action, payload = {}, params = {}) {
    const res = await authFetch(`${base}/call/`, {
      method: "POST",
      body: JSON.stringify({ marketplace: mp, action, payload, params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Ошибка площадки");
    return data;
  }

  async function withBusy(key, fn) {
    setBusy(key);
    setStatus("");
    try {
      await fn();
    } catch (err) {
      setStatus(err?.message || "Не удалось выполнить запрос.");
    } finally {
      setBusy("");
    }
  }

  async function saveKeys(e) {
    e?.preventDefault();
    await withBusy("keys", async () => {
      const body = {
        environment: keysForm.environment,
        ozon_client_id: keysForm.ozon_client_id,
      };
      if (keysForm.ozon_api_key && !keysForm.ozon_api_key.startsWith("•")) body.ozon_api_key = keysForm.ozon_api_key;
      if (keysForm.wb_api_key && !keysForm.wb_api_key.startsWith("•")) body.wb_api_key = keysForm.wb_api_key;
      const res = await authFetch(`${base}/settings/`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await readError(res));
      await loadSettings();
      setStatus("Ключи сохранены.");
    });
  }

  function productPayload(row) {
    const images = String(row.images || "")
      .split(/[\s,]+/)
      .map((u) => u.trim())
      .filter(Boolean);
    return {
      offer_id: row.offer_id,
      name: row.name,
      brand: row.brand,
      price: row.price,
      stock: Number(row.stock || 0),
      description: row.description,
      barcode: row.barcode,
      category: row.category,
      type: row.type,
      images,
      wb_sku: row.offer_id,
      wb_images: images,
    };
  }

  async function importProducts(products) {
    const res = await authFetch(`${base}/products/import/`, {
      method: "POST",
      body: JSON.stringify({ marketplace: mp, products }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Не удалось выгрузить товары.");
    setStatus(`Выгружено: ${data.ok} из ${data.total}.`);
    await loadHistory();
    return data;
  }

  async function submitOne(e) {
    e.preventDefault();
    await withBusy("create", async () => {
      if (!product.offer_id || !product.name) throw new Error("Нужны артикул и название.");
      await importProducts([productPayload(product)]);
      setProduct(emptyProduct());
    });
  }

  async function submitBatch() {
    await withBusy("batch", async () => {
      const products = batch.map(productPayload).filter((p) => p.offer_id && p.name);
      if (!products.length) throw new Error("Добавьте хотя бы один товар с артикулом и названием.");
      await importProducts(products);
    });
  }

  async function submitCsv() {
    await withBusy("csv", async () => {
      const products = parseCsv(csvText).filter((p) => p.offer_id && p.name);
      if (!products.length) throw new Error("В CSV нет строк с артикулом и названием.");
      await importProducts(products);
    });
  }

  async function uploadMedia(file) {
    if (!file) return;
    await withBusy("media", async () => {
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`${base}/media/`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось загрузить файл.");
      setProduct((p) => ({ ...p, images: [p.images, data.url].filter(Boolean).join("\n") }));
      setStatus(`Файл сохранён: ${data.url}`);
    });
  }

  async function generateDescription() {
    await withBusy("ai", async () => {
      const res = await authFetch(`${base}/generate-description/`, {
        method: "POST",
        body: JSON.stringify({
          marketplace: mp,
          product_name: product.name,
          brand: product.brand,
          category: product.category,
          key_features: aiFeatures.split(",").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "ИИ-описание недоступно.");
      setProduct((p) => ({ ...p, description: data.description || p.description }));
      setStatus("Описание сгенерировано.");
    });
  }

  async function applyPricesStocks() {
    await withBusy("prices", async () => {
      if (!priceStock.offer_id) throw new Error("Укажите артикул.");
      if (priceStock.price) {
        const payload =
          mp === "wildberries"
            ? { data: [{ nmId: Number(priceStock.offer_id) || priceStock.offer_id, price: Number(priceStock.price) }] }
            : {
                prices: [
                  {
                    offer_id: priceStock.offer_id,
                    price: String(priceStock.price),
                    old_price: "0",
                    min_price: "0",
                    currency_code: "RUB",
                  },
                ],
              };
        setLive(await mpCall("products.prices", payload));
      }
      if (priceStock.stock !== "") {
        const payload =
          mp === "wildberries"
            ? { stocks: [{ sku: priceStock.offer_id, amount: Number(priceStock.stock || 0) }] }
            : {
                stocks: [
                  {
                    offer_id: priceStock.offer_id,
                    stock: Number(priceStock.stock || 0),
                    warehouse_id: Number(warehouseId || 0),
                  },
                ],
              };
        const params = mp === "wildberries" ? { warehouseId: warehouseId || "0" } : {};
        setLive(await mpCall("products.stocks", payload, params));
      }
      setStatus("Цены и остатки отправлены.");
    });
  }

  async function deleteProduct(offerId) {
    if (!window.confirm(`Удалить карточку ${offerId} на площадке?`)) return;
    await withBusy("delete", async () => {
      const payload =
        mp === "wildberries"
          ? { nmIDs: [Number(offerId) || offerId] }
          : { products: [{ offer_id: offerId }] };
      setLive(await mpCall("products.delete", payload));
      setStatus("Запрос на удаление отправлен.");
    });
  }

  async function loadLiveProducts() {
    await withBusy("live-products", async () => {
      const ids = history.map((h) => h.offer_id).filter(Boolean).slice(0, 50);
      const payload =
        mp === "wildberries"
          ? { settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }
          : { offer_id: ids, product_id: [], sku: [] };
      setLive(await mpCall("products.list", payload));
    });
  }

  async function loadOrders() {
    await withBusy("orders", async () => {
      const payload =
        mp === "wildberries"
          ? {}
          : {
              dir: "DESC",
              filter: { since: daysAgoIso(14), to: new Date().toISOString().slice(0, 19) + "Z" },
              limit: 50,
              offset: 0,
              with: { analytics_data: true, financial_data: true },
            };
      setLive(await mpCall("orders.list", payload));
    });
  }

  async function loadWarehouses() {
    await withBusy("wh", async () => {
      setLive(await mpCall("warehouses.list", mp === "wildberries" ? {} : {}));
    });
  }

  async function loadSupplies() {
    await withBusy("supplies", async () => {
      if (mp !== "wildberries") throw new Error("Поставки доступны для Wildberries.");
      setLive(await mpCall("supplies.list"));
    });
  }

  async function loadAnalytics() {
    await withBusy("analytics", async () => {
      if (mp === "wildberries") {
        const payload = { dateFrom: daysAgoIso(30).slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) };
        setLive(await mpCall("analytics.sales", payload, payload));
      } else {
        setLive(
          await mpCall("analytics.data", {
            date_from: daysAgoIso(30).slice(0, 10),
            date_to: new Date().toISOString().slice(0, 10),
            metrics: ["revenue", "ordered_units"],
            dimension: ["sku"],
            limit: 50,
            offset: 0,
          }),
        );
      }
    });
  }

  async function loadReviews() {
    await withBusy("reviews", async () => {
      if (mp === "wildberries") {
        setLive(await mpCall("feedbacks.list", { isAnswered: false, take: 50, skip: 0 }, { isAnswered: false, take: 50, skip: 0 }));
      } else {
        setLive(await mpCall("reviews.list", { filter: {}, limit: 50, sort_dir: "DESC", last_id: 0 }));
      }
    });
  }

  async function loadQuestions() {
    await withBusy("questions", async () => {
      if (mp !== "wildberries") throw new Error("Вопросы покупателей — для Wildberries.");
      setLive(await mpCall("questions.list", { isAnswered: false, take: 50, skip: 0 }, { isAnswered: false, take: 50, skip: 0 }));
    });
  }

  async function loadCategories() {
    await withBusy("cats", async () => {
      if (mp === "wildberries") setLive(await mpCall("categories.parents"));
      else setLive(await mpCall("categories.tree", { language: "DEFAULT" }));
    });
  }

  async function saveTemplate(e) {
    e.preventDefault();
    await withBusy("tpl", async () => {
      const res = await authFetch(`${base}/templates/`, {
        method: "POST",
        body: JSON.stringify({
          ...templateForm,
          marketplace: mp,
          price: templateForm.price || 0,
          stock: Number(templateForm.stock || 0),
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setTemplateForm({ name: "", brand: "", description_text: "", price: "", stock: "0" });
      await loadTemplates();
      setStatus("Шаблон сохранён.");
    });
  }

  async function deleteTemplate(id) {
    await authFetch(`${base}/templates/${id}/`, { method: "DELETE" });
    await loadTemplates();
  }

  function applyTemplate(t) {
    setProduct((p) => ({
      ...p,
      brand: t.brand || p.brand,
      description: t.description_text || p.description,
      price: t.price || p.price,
      stock: String(t.stock ?? p.stock),
    }));
    setTab("create");
    setStatus(`Подставлен шаблон «${t.name}».`);
  }

  const envLabel = settings?.environment === "prod" ? "Боевой режим" : "Песочница";
  const filteredHistory = useMemo(
    () => history.filter((h) => !search || String(h.offer_id || "").toLowerCase().includes(search.toLowerCase()) || String(h.product?.name || "").toLowerCase().includes(search.toLowerCase())),
    [history, search],
  );

  return (
    <section className="card full-width cafe-provider mp-workspace">
      <div className="mp-head">
        <div>
          <h2>Маркетплейсы</h2>
          <p className="muted">
            Кабинет продавца Ozon и Wildberries. Ключи хранятся у организации. Сейчас: {envLabel}.
          </p>
        </div>
        <div className="mp-switch" role="group" aria-label="Площадка">
          <button type="button" className={`ghost-btn${mp === "ozon" ? " is-active" : ""}`} onClick={() => setMp("ozon")}>
            Ozon
          </button>
          <button type="button" className={`ghost-btn${mp === "wildberries" ? " is-active" : ""}`} onClick={() => setMp("wildberries")}>
            Wildberries
          </button>
        </div>
      </div>

      {status ? <p className="status">{status}</p> : null}

      <div className="cafe-provider-tabs">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={`ghost-btn${tab === id ? " is-active" : ""}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "create" && (
        <div className="mp-grid">
          <form className="cafe-form-panel" onSubmit={submitOne}>
            <h3>Карточка товара</h3>
            <div className="cafe-form-grid">
              <label>
                Артикул
                <input value={product.offer_id} onChange={(e) => setProduct((p) => ({ ...p, offer_id: e.target.value }))} required />
              </label>
              <label>
                Название
                <input value={product.name} onChange={(e) => setProduct((p) => ({ ...p, name: e.target.value }))} required />
              </label>
              <label>
                Бренд
                <input value={product.brand} onChange={(e) => setProduct((p) => ({ ...p, brand: e.target.value }))} />
              </label>
              <label>
                Цена, ₽
                <input value={product.price} onChange={(e) => setProduct((p) => ({ ...p, price: e.target.value }))} />
              </label>
              <label>
                Остаток
                <input value={product.stock} onChange={(e) => setProduct((p) => ({ ...p, stock: e.target.value }))} />
              </label>
              <label>
                Штрихкод
                <input value={product.barcode} onChange={(e) => setProduct((p) => ({ ...p, barcode: e.target.value }))} />
              </label>
              <label>
                Категория (id)
                <input value={product.category} onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))} />
              </label>
              <label>
                Тип (id)
                <input value={product.type} onChange={(e) => setProduct((p) => ({ ...p, type: e.target.value }))} />
              </label>
              <label className="cafe-form-span2">
                Описание
                <textarea rows={4} value={product.description} onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <label className="cafe-form-span2">
                Ссылки на фото (по одной в строке)
                <textarea rows={3} value={product.images} onChange={(e) => setProduct((p) => ({ ...p, images: e.target.value }))} />
              </label>
            </div>
            <div className="mp-actions">
              <label className="ghost-btn mp-file">
                Загрузить медиа
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => {
                    uploadMedia(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              <button type="button" className="ghost-btn" disabled={!settings?.ai_enabled || busy === "ai"} onClick={generateDescription}>
                {settings?.ai_enabled ? (busy === "ai" ? "Генерация…" : "ИИ-описание") : "ИИ выключен"}
              </button>
              <button type="button" className="ghost-btn" disabled title={settings?.video_enabled ? "" : "Генерация видео на сервере отключена"}>
                Видео карточки
              </button>
              <button type="submit" disabled={busy === "create"}>
                {busy === "create" ? "Выгрузка…" : "Выгрузить"}
              </button>
            </div>
            {settings?.ai_enabled ? (
              <label className="field-label">
                Особенности для ИИ (через запятую)
                <input value={aiFeatures} onChange={(e) => setAiFeatures(e.target.value)} />
              </label>
            ) : null}
          </form>

          <div className="cafe-form-panel">
            <h3>Пакет и CSV</h3>
            {batch.map((row, i) => (
              <div key={i} className="mp-batch-row">
                <input placeholder="Артикул" value={row.offer_id} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, offer_id: e.target.value } : r)))} />
                <input placeholder="Название" value={row.name} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} />
                <input placeholder="Цена" value={row.price} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, price: e.target.value } : r)))} />
              </div>
            ))}
            <div className="mp-actions">
              <button type="button" className="ghost-btn" onClick={() => setBatch((rows) => [...rows, emptyProduct()])}>
                Ещё товар
              </button>
              <button type="button" disabled={busy === "batch"} onClick={submitBatch}>
                Выгрузить пакет
              </button>
            </div>
            <label className="field-label">
              CSV (offer_id, name, brand, price, stock, description)
              <textarea rows={6} value={csvText} onChange={(e) => setCsvText(e.target.value)} />
            </label>
            <button type="button" disabled={busy === "csv"} onClick={submitCsv}>
              Выгрузить CSV
            </button>
            {templates.length ? (
              <div className="mp-templates">
                <h4>Шаблоны</h4>
                {templates.map((t) => (
                  <button key={t.id} type="button" className="ghost-btn" onClick={() => applyTemplate(t)}>
                    {t.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}

      {tab === "products" && (
        <div>
          <div className="mp-actions">
            <input placeholder="Поиск по артикулу" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button type="button" className="ghost-btn" onClick={loadHistory}>
              Обновить историю
            </button>
            <button type="button" className="ghost-btn" disabled={busy === "live-products"} onClick={loadLiveProducts}>
              С площадки
            </button>
          </div>
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Остаток</th>
                  <th>Статус</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{row.offer_id}</td>
                    <td>{row.product?.name || "—"}</td>
                    <td>{row.product?.price || "—"}</td>
                    <td>{row.product?.stock ?? "—"}</td>
                    <td>{row.status}</td>
                    <td>
                      <button type="button" className="ghost-btn" onClick={() => deleteProduct(row.offer_id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredHistory.length ? <p className="muted">Пока нет выгрузок. Создайте карточку на вкладке «Создать товар».</p> : null}
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div className="mp-grid">
          <form className="cafe-form-panel" onSubmit={saveKeys}>
            <h3>Ключи площадок</h3>
            <p className="muted small">Не хранятся в платформенном .env — только у этой организации.</p>
            <div className="cafe-form-grid">
              <label>
                Режим
                <select value={keysForm.environment} onChange={(e) => setKeysForm((p) => ({ ...p, environment: e.target.value }))}>
                  <option value="sandbox">Песочница (без реальных вызовов на запись)</option>
                  <option value="prod">Боевой</option>
                </select>
              </label>
              <label>
                Ozon Client ID
                <input value={keysForm.ozon_client_id} onChange={(e) => setKeysForm((p) => ({ ...p, ozon_client_id: e.target.value }))} />
              </label>
              <label>
                Ozon API Key
                <input type="password" autoComplete="off" value={keysForm.ozon_api_key} onChange={(e) => setKeysForm((p) => ({ ...p, ozon_api_key: e.target.value }))} />
              </label>
              <label>
                Wildberries API Key
                <input type="password" autoComplete="off" value={keysForm.wb_api_key} onChange={(e) => setKeysForm((p) => ({ ...p, wb_api_key: e.target.value }))} />
              </label>
            </div>
            <button type="submit" disabled={busy === "keys"}>
              Сохранить ключи
            </button>
          </form>

          <div className="cafe-form-panel">
            <h3>Цены, остатки, склады</h3>
            <div className="cafe-form-grid">
              <label>
                Артикул
                <input value={priceStock.offer_id} onChange={(e) => setPriceStock((p) => ({ ...p, offer_id: e.target.value }))} />
              </label>
              <label>
                Цена
                <input value={priceStock.price} onChange={(e) => setPriceStock((p) => ({ ...p, price: e.target.value }))} />
              </label>
              <label>
                Остаток
                <input value={priceStock.stock} onChange={(e) => setPriceStock((p) => ({ ...p, stock: e.target.value }))} />
              </label>
              <label>
                ID склада
                <input value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} />
              </label>
            </div>
            <div className="mp-actions">
              <button type="button" disabled={busy === "prices"} onClick={applyPricesStocks}>
                Обновить цены/остатки
              </button>
              <button type="button" className="ghost-btn" disabled={busy === "wh"} onClick={loadWarehouses}>
                Склады
              </button>
              <button type="button" className="ghost-btn" disabled={busy === "cats"} onClick={loadCategories}>
                Категории
              </button>
              {mp === "wildberries" ? (
                <button type="button" className="ghost-btn" disabled={busy === "supplies"} onClick={loadSupplies}>
                  Поставки WB
                </button>
              ) : null}
            </div>
            <form onSubmit={saveTemplate}>
              <h4>Новый шаблон</h4>
              <div className="cafe-form-grid">
                <label>
                  Название шаблона
                  <input value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} required />
                </label>
                <label>
                  Бренд
                  <input value={templateForm.brand} onChange={(e) => setTemplateForm((p) => ({ ...p, brand: e.target.value }))} />
                </label>
                <label>
                  Цена
                  <input value={templateForm.price} onChange={(e) => setTemplateForm((p) => ({ ...p, price: e.target.value }))} />
                </label>
                <label>
                  Остаток
                  <input value={templateForm.stock} onChange={(e) => setTemplateForm((p) => ({ ...p, stock: e.target.value }))} />
                </label>
                <label className="cafe-form-span2">
                  Текст описания
                  <textarea rows={3} value={templateForm.description_text} onChange={(e) => setTemplateForm((p) => ({ ...p, description_text: e.target.value }))} />
                </label>
              </div>
              <button type="submit">Сохранить шаблон</button>
            </form>
            {templates.map((t) => (
              <div key={t.id} className="mp-tpl-row">
                <span>
                  {t.name} · {t.marketplace}
                </span>
                <button type="button" className="ghost-btn" onClick={() => deleteTemplate(t.id)}>
                  Удалить
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "orders" && (
        <div>
          <div className="mp-actions">
            <button type="button" disabled={busy === "orders"} onClick={loadOrders}>
              Загрузить заказы
            </button>
            <button type="button" className="ghost-btn" disabled={busy === "wh"} onClick={loadWarehouses}>
              Склады
            </button>
            {mp === "wildberries" ? (
              <button type="button" className="ghost-btn" disabled={busy === "supplies"} onClick={loadSupplies}>
                Поставки
              </button>
            ) : null}
          </div>
          <p className="muted small">В песочнице изменяющие операции не уходят на площадку. Чтение заказов и складов выполняется, если указаны ключи.</p>
        </div>
      )}

      {tab === "analytics" && (
        <div>
          <div className="mp-actions">
            <button type="button" disabled={busy === "analytics"} onClick={loadAnalytics}>
              Отчёт за 30 дней
            </button>
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div>
          <div className="mp-actions">
            <button type="button" disabled={busy === "reviews"} onClick={loadReviews}>
              Отзывы
            </button>
            {mp === "wildberries" ? (
              <button type="button" className="ghost-btn" disabled={busy === "questions"} onClick={loadQuestions}>
                Вопросы
              </button>
            ) : null}
          </div>
        </div>
      )}

      {live ? (
        <pre className="mp-json" aria-label="Ответ площадки">
          {previewJson(live)}
        </pre>
      ) : null}
    </section>
  );
}

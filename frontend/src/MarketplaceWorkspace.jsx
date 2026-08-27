import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./marketplaceWorkspace.css";
import { renderProductCardVideo } from "./productCardVideo.js";
import {
  applyAttributeMirrors,
  extractOzonCategoryTree,
  flattenWbParents,
  flattenWbSubjects,
  normalizeOzonAttributes,
  normalizeOzonDictionaryValues,
  normalizeWbCharacteristics,
  splitCardAttributes,
  wbCharcInputType,
} from "./marketplaceCategoryHelpers.js";
import MarketplaceCategoryPicker from "./marketplaceCategoryPicker.jsx";
import SearchableSelect from "./marketplaceSearchableSelect.jsx";
import MarketplaceAnalyticsPanel from "./MarketplaceAnalyticsPanel.jsx";
import { aggregateBuhRows, extractRecords as extractAnalyticsRecords } from "./marketplaceAnalytics.js";

const TABS = [
  ["today", "Сегодня"],
  ["create", "Создать товар"],
  ["products", "Товары"],
  ["manage", "Настройки"],
  ["orders", "Заказы"],
  ["supplies", "Поставки"],
  ["analytics", "Аналитика"],
  ["finance", "Финансы"],
  ["reviews", "Отзывы и вопросы"],
  ["logs", "Логи"],
];

const BEGINNER_TAB_IDS = new Set(["today", "create", "products", "manage"]);
const MP_UI_MODE_KEY = "vmeste_mp_ui_mode";
const MP_ONBOARD_DONE_KEY = "vmeste_mp_onboard_done";

function readMpUiMode() {
  try {
    const v = localStorage.getItem(MP_UI_MODE_KEY);
    return v === "advanced" ? "advanced" : "beginner";
  } catch {
    return "beginner";
  }
}

function writeMpUiMode(mode) {
  try {
    localStorage.setItem(MP_UI_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

function readOnboardDone() {
  try {
    return localStorage.getItem(MP_ONBOARD_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeOnboardDone() {
  try {
    localStorage.setItem(MP_ONBOARD_DONE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function warehouseStorageKey(marketplace) {
  return `vmeste_mp_warehouse_${marketplace === "wildberries" ? "wb" : "ozon"}`;
}

function readStoredWarehouse(marketplace) {
  try {
    return String(localStorage.getItem(warehouseStorageKey(marketplace)) || "").trim();
  } catch {
    return "";
  }
}

function writeStoredWarehouse(marketplace, id) {
  try {
    if (id) localStorage.setItem(warehouseStorageKey(marketplace), String(id));
    else localStorage.removeItem(warehouseStorageKey(marketplace));
  } catch {
    /* ignore */
  }
}

const MEDIA_LIMITS = {
  ozon: { photos: 15, videos: 1 },
  wildberries: { photos: 30, videos: 1 },
};

function mediaLimitsFor(marketplace) {
  return marketplace === "wildberries" ? MEDIA_LIMITS.wildberries : MEDIA_LIMITS.ozon;
}

function isVideoMediaItem(item) {
  if (!item) return false;
  if (typeof item === "string") return /\.webm($|\?)/i.test(item);
  return item.kind === "video" || /\.webm($|\?)/i.test(item.url || item.previewUrl || "");
}

function countMediaItems(images) {
  const list = Array.isArray(images) ? images : [];
  let photos = 0;
  let videos = 0;
  for (const item of list) {
    if (isVideoMediaItem(item)) videos += 1;
    else photos += 1;
  }
  return { photos, videos };
}

function isVideoFile(file) {
  return (file?.type || "").startsWith("video/") || /\.(webm|mp4|mov)$/i.test(file?.name || "");
}

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
  characteristics: {},
  images: [],
});

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
      <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function sortAttributesRequiredFirst(fields) {
  return [...(fields || [])].sort((a, b) => {
    const ra = a?.required ? 0 : 1;
    const rb = b?.required ? 0 : 1;
    if (ra !== rb) return ra - rb;
    return String(a?.name || "").localeCompare(String(b?.name || ""), "ru");
  });
}

function charFilled(product, field) {
  const val = product?.characteristics?.[field.id];
  return val != null && String(val).trim() !== "";
}

function buildVisibilityChecklist(product, mp, attributeFields) {
  const images = (Array.isArray(product.images) ? product.images : [])
    .filter((x) => (typeof x === "string" ? true : x?.kind !== "video"))
    .map((x) => publicUrlFor(x))
    .filter(Boolean);
  const descLen = String(product.description || "").trim().length;
  const required = attributeFields.filter((f) => f.required);
  const optional = attributeFields.filter((f) => !f.required);
  const reqFilled = required.filter((f) => charFilled(product, f)).length;
  const optFilled = optional.filter((f) => charFilled(product, f)).length;
  const items = [
    {
      id: "name",
      label: "Название товара",
      hint: "Понятное название повышает поиск",
      done: Boolean(String(product.name || "").trim()),
      weight: 15,
    },
    {
      id: "category",
      label: mp === "wildberries" ? "Предмет WB" : "Категория и тип Ozon",
      hint: "Без категории карточку не примут",
      done:
        mp === "wildberries"
          ? Boolean(String(product.category || "").trim())
          : Boolean(String(product.category || "").trim() && String(product.type || "").trim()),
      weight: 15,
    },
    {
      id: "photos",
      label: images.length >= 5 ? "Фото (5+)" : images.length >= 3 ? "Фото (3+)" : "Фото (минимум 1)",
      hint: "3–5+ фото заметно поднимают CTR",
      done: images.length >= 1,
      partial: images.length >= 3,
      weight: 20,
    },
    {
      id: "description",
      label: descLen >= 200 ? "Описание (подробное)" : "Описание (от 80 символов)",
      hint: "Текст с пользой и характеристиками",
      done: descLen >= 80,
      partial: descLen >= 200,
      weight: 15,
    },
    {
      id: "brand",
      label: "Бренд",
      hint: "Бренд помогает в фильтрах",
      done: Boolean(String(product.brand || "").trim()),
      weight: 5,
    },
    {
      id: "price",
      label: "Цена",
      hint: "Актуальная цена продажи",
      done: Boolean(String(product.price || "").trim()) && !Number.isNaN(Number(String(product.price).replace(",", "."))),
      weight: 5,
    },
    {
      id: "barcode",
      label: "Штрихкод",
      hint: "Нужен для склада и поставок",
      done: Boolean(String(product.barcode || "").trim()),
      weight: 5,
    },
    {
      id: "required_attrs",
      label: required.length ? `Обязательные характеристики (${reqFilled}/${required.length})` : "Обязательные характеристики",
      hint: "Без них площадка отклонит карточку",
      done: required.length === 0 || reqFilled === required.length,
      weight: 15,
    },
    {
      id: "optional_attrs",
      label: optional.length ? `Доп. характеристики (${optFilled}/${optional.length})` : "Доп. характеристики",
      hint: "Чем больше заполнено — тем выше видимость",
      done: optional.length === 0 || optFilled >= Math.ceil(optional.length * 0.5),
      partial: optional.length > 0 && optFilled > 0,
      weight: 5,
    },
  ];
  let score = 0;
  let max = 0;
  for (const item of items) {
    max += item.weight;
    if (item.done) score += item.weight;
    else if (item.partial) score += item.weight * 0.5;
  }
  const percent = max ? Math.round((score / max) * 100) : 0;
  return { items, percent, reqFilled, requiredCount: required.length, optFilled, optionalCount: optional.length };
}

function MpBarChart({ items, valueKey = "value", labelKey = "label", color = "#1f6feb" }) {
  const list = (items || []).slice(0, 12);
  const max = Math.max(1, ...list.map((x) => Number(x[valueKey]) || 0));
  if (!list.length) return <p className="muted small">Нет данных для графика</p>;
  return (
    <div className="mp-bars" role="img" aria-label="Столбчатая диаграмма">
      {list.map((item, i) => {
        const v = Number(item[valueKey]) || 0;
        const pct = Math.round((v / max) * 100);
        return (
          <div key={item.id ?? item[labelKey] ?? i} className="mp-bar-row">
            <span className="mp-bar-label" title={item[labelKey]}>
              {item[labelKey]}
            </span>
            <div className="mp-bar-track">
              <div className="mp-bar-fill" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="mp-bar-value">{Number.isFinite(v) ? (Math.round(v * 100) / 100).toLocaleString("ru-RU") : v}</span>
          </div>
        );
      })}
    </div>
  );
}

function normalizeQuestions(data) {
  const rows = extractRecords(data);
  return rows.map((row, i) => ({
    key: String(row.id || i),
    id: row.id,
    text: row.text || row.questionText || "",
    product: row.productDetails?.productName || row.productName || row.nmId || "—",
    date: row.createdDate || row.created_at || "",
    answered: Boolean(row.answer?.text || row.state === "wbRuAnswered" || row.wasViewed),
    raw: row,
  }));
}

function parseAnalyticsCharts(data, marketplace) {
  const sales = [];
  const stocks = [];
  const unit = [];
  if (!data || data.sandbox) return { sales, stocks, unit };

  if (marketplace === "wildberries") {
    const rows = Array.isArray(data) ? data : extractRecords(data);
    const bySku = {};
    for (const row of rows) {
      const sku = String(row.supplierArticle || row.sa_name || row.nmId || row.barcode || "SKU");
      const qty = Number(row.quantity || row.quantityFull || row.sale_qty || 1) || 0;
      const money = Number(row.ppvz_for_pay || row.finishedPrice || row.priceWithDisc || row.retail_amount || 0) || 0;
      if (!bySku[sku]) bySku[sku] = { label: sku, qty: 0, revenue: 0 };
      bySku[sku].qty += qty;
      bySku[sku].revenue += money;
    }
    for (const v of Object.values(bySku)) {
      sales.push({ label: v.label, value: v.qty });
      unit.push({
        label: v.label,
        value: v.qty ? Math.round((v.revenue / v.qty) * 100) / 100 : 0,
        revenue: Math.round(v.revenue * 100) / 100,
        qty: v.qty,
      });
    }
    sales.sort((a, b) => b.value - a.value);
    unit.sort((a, b) => b.revenue - a.revenue);
  } else {
    const result = data.result || data;
    const rows = result?.data || result?.items || extractRecords(data);
    for (const row of rows) {
      const dims = row.dimensions || row.dimension || [];
      const metrics = row.metrics || [];
      const label = Array.isArray(dims) ? String(dims[0] ?? "SKU") : String(dims || "SKU");
      const revenue = Number(metrics[0] ?? row.revenue ?? 0) || 0;
      const qty = Number(metrics[1] ?? row.ordered_units ?? 0) || 0;
      sales.push({ label, value: qty });
      unit.push({
        label,
        value: qty ? Math.round((revenue / qty) * 100) / 100 : revenue,
        revenue,
        qty,
      });
    }
    sales.sort((a, b) => b.value - a.value);
    unit.sort((a, b) => b.revenue - a.revenue);
  }
  return { sales: sales.slice(0, 12), stocks, unit: unit.slice(0, 12) };
}

function parseStocksChart(data, marketplace) {
  const stocks = [];
  if (!data || data.sandbox) return stocks;
  if (marketplace === "wildberries") {
    const rows = Array.isArray(data) ? data : extractRecords(data);
    const byWh = {};
    for (const row of rows) {
      const label = String(row.warehouseName || row.warehouse || row.scName || "Склад");
      const qty = Number(row.quantity || row.quantityFull || row.quantityWarehousesFull || 0) || 0;
      byWh[label] = (byWh[label] || 0) + qty;
    }
    for (const [label, value] of Object.entries(byWh)) stocks.push({ label, value });
  } else {
    const rows = data?.result?.rows || data?.rows || extractRecords(data);
    for (const row of rows) {
      const label = String(row.warehouse_name || row.warehouse || row.name || "Склад");
      const qty = Number(row.free_to_sell_amount ?? row.promised_amount ?? row.stock ?? row.quantity ?? 0) || 0;
      stocks.push({ label, value: qty });
    }
  }
  stocks.sort((a, b) => b.value - a.value);
  return stocks.slice(0, 12);
}

function humanizeMarketplaceError(raw, status) {
  const text = String(raw || "").trim();
  const low = text.toLowerCase();
  const code = Number(status) || 0;
  if (low.includes("obsolete method") || low.includes("method is deprecated")) {
    return "Метод API устарел. Обновите кабинет — используется новая версия endpoint.";
  }
  if (code === 429 || low.includes("rate limit") || low.includes("max rate") || low.includes("too many requests")) {
    return "Слишком частые запросы к площадке (лимит ~2/сек). Подождите пару секунд и повторите.";
  }
  if (
    low.includes("permissiondenied") ||
    low.includes("permission denied") ||
    low.includes("not available with existing subscription") ||
    (low.includes("subscription") && (low.includes("not available") || low.includes("rpc error")))
  ) {
    return "Раздел недоступен на тарифе кабинета продавца (часто отзывы Premium). Проверьте подписку в Ozon/WB.";
  }
  if (low.includes("раздел недоступен") || low.includes("слишком частые")) return text;
  if (code === 401 || low.includes("unauthorized") || low.includes("invalid api")) {
    return "Ключ API отклонён. Проверьте ключи в Управлении и боевой режим.";
  }
  if (code === 403 || low.includes("forbidden")) {
    return "Нет доступа к методу API. Проверьте права ключа и тариф площадки.";
  }
  if (low.includes("desc =")) {
    const parts = text.split(/desc\s*=/i);
    if (parts[1]) return parts[1].trim().slice(0, 400);
  }
  return text || "Ошибка площадки";
}

function daysAgoIso(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 19) + "Z";
}

/** RFC3339 for Ozon finance / protobuf Timestamp (date-only "YYYY-MM-DD" is rejected). */
function ozonTimestampDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().replace(/\.\d{3}Z$/, ".000Z");
}

function ozonTimestampNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, ".000Z");
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

function extractRecords(data) {
  if (!data || data.sandbox) return [];
  const queue = [data];
  const seen = new Set();
  while (queue.length) {
    const cur = queue.shift();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if (Array.isArray(cur)) {
      if (cur.length && cur.every((x) => x && typeof x === "object" && !Array.isArray(x))) return cur;
      cur.forEach((x) => queue.push(x));
      continue;
    }
    Object.values(cur).forEach((v) => queue.push(v));
  }
  return [];
}

function recordTitle(row) {
  if (!row || typeof row !== "object") return String(row ?? "—");
  return (
    row.name ||
    row.title ||
    row.offer_id ||
    row.vendorCode ||
    row.posting_number ||
    row.text ||
    row.nmID ||
    row.id ||
    row.sku ||
    "Запись"
  );
}

function recordHint(row) {
  if (!row || typeof row !== "object") return "";
  const bits = [row.offer_id, row.vendorCode, row.status, row.price, row.date, row.createdDate].filter(Boolean);
  return bits.slice(0, 3).join(" · ");
}

function normalizeOrders(data, marketplace) {
  const rows = extractRecords(data);
  return rows.map((row, i) => {
    if (marketplace === "wildberries") {
      const status = row.supplierStatus || row.wbStatus || row.status || "new";
      return {
        key: String(row.id || row.orderUid || i),
        id: row.id,
        number: String(row.id || row.orderUid || "—"),
        status,
        status_label: orderStatusLabel(status, "wildberries"),
        date: row.createdAt || row.created_at || "",
        sku: row.skus?.[0] || row.article || row.nmId || "",
        price: row.convertedPrice != null ? (Number(row.convertedPrice) / 100).toFixed(2) : row.price || "",
        raw: row,
      };
    }
    const products = row.products || [];
    const names = products.map((p) => p.name || p.offer_id).filter(Boolean).slice(0, 2).join(", ");
    const status = row.status || row.posting_status || "—";
    return {
      key: String(row.posting_number || row.order_id || i),
      id: row.posting_number,
      number: row.posting_number || String(row.order_id || "—"),
      status,
      status_label: orderStatusLabel(status, "ozon"),
      date: row.in_process_at || row.created_at || "",
      sku: products[0]?.offer_id || "",
      price: products[0]?.price || "",
      title: names || "—",
      can_ship: ["awaiting_packaging", "awaiting_approve"].includes(String(status)),
      can_label: ["awaiting_deliver", "delivering", "awaiting_packaging"].includes(String(status)) || Boolean(row.posting_number),
      raw: row,
    };
  });
}

function orderStatusLabel(status, marketplace) {
  const s = String(status || "").toLowerCase();
  const ozon = {
    awaiting_registration: "Ожидает регистрации",
    acceptance_in_progress: "Идёт приёмка",
    awaiting_approve: "Ожидает подтверждения",
    awaiting_packaging: "Ожидает сборки",
    awaiting_deliver: "Ожидает отгрузки",
    delivering: "Доставляется",
    driver_pickup: "У водителя",
    delivered: "Доставлен",
    cancelled: "Отменён",
    not_accepted: "Не принят на сортировке",
  };
  const wb = {
    new: "Новый",
    confirm: "На сборке",
    complete: "В доставке",
    cancel: "Отменён",
  };
  if (marketplace === "wildberries") return wb[s] || status || "—";
  return ozon[s] || status || "—";
}

function emptyBulkRow() {
  return { offer_id: "", nm_id: "", product_id: "", price: "", stock: "" };
}

function parseBulkCsv(text) {
  const lines = String(text || "")
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const sep = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(sep).map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idx = (names) => {
    for (const n of names) {
      const i = headers.indexOf(n);
      if (i >= 0) return i;
    }
    return -1;
  };
  const iOffer = idx(["offer_id", "артикул", "vendorcode", "vendor_code", "sku"]);
  const iNm = idx(["nm_id", "nmid", "nm"]);
  const iPid = idx(["product_id", "productid"]);
  const iPrice = idx(["price", "цена"]);
  const iStock = idx(["stock", "остаток", "qty", "quantity"]);
  const start = headers.some((h) => ["offer_id", "артикул", "price", "цена", "stock", "остаток"].includes(h)) ? 1 : 0;
  const rows = [];
  for (let li = start; li < lines.length; li += 1) {
    const cols = lines[li].split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const offer = iOffer >= 0 ? cols[iOffer] : cols[0] || "";
    if (!offer && !(iNm >= 0 && cols[iNm])) continue;
    rows.push({
      offer_id: offer || "",
      nm_id: iNm >= 0 ? cols[iNm] || "" : "",
      product_id: iPid >= 0 ? cols[iPid] || "" : "",
      price: iPrice >= 0 ? cols[iPrice] || "" : cols[1] || "",
      stock: iStock >= 0 ? cols[iStock] || "" : cols[2] || "",
    });
  }
  return rows;
}

function normalizeReviews(data, marketplace) {
  const rows = extractRecords(data);
  return rows.map((row, i) => {
    if (marketplace === "wildberries") {
      return {
        key: String(row.id || i),
        id: row.id,
        rating: row.productValuation ?? row.valuation ?? "—",
        text: row.text || row.feedbackText || "",
        product: row.productDetails?.productName || row.productName || row.nmId || "—",
        date: row.createdDate || row.created_at || "",
        answered: Boolean(row.answer?.text || row.wasViewed),
        raw: row,
      };
    }
    return {
      key: String(row.id || row.uuid || i),
      id: row.id || row.uuid,
      rating: row.score ?? row.rating ?? "—",
      text: row.text || row.comment || "",
      product: row.sku || row.offer_id || row.product_id || "—",
      date: row.published_at || row.created_at || "",
      answered: Boolean(row.comments_amount || row.is_commented),
      raw: row,
    };
  });
}

function downloadCsv(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    if (/[;"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(";")];
  for (const row of rows) lines.push(row.map(escape).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function cleanAiDescription(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[*_`#]+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function publicUrlFor(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.public_url || item.disk_url || item.url || "";
}

function importStatusLabel(row) {
  if (!row) return "—";
  if (row.import_status) return row.import_status;
  if (row.import_task_id) return "pending";
  return row.status || "—";
}

function formatMarketplaceId(value) {
  if (value == null || value === "") return "—";
  return String(value);
}

function validateProductForImport(row, marketplace, fields) {
  const errors = [];
  const offerId = String(row.offer_id || row.wb_sku || "").trim();
  const name = String(row.name || "").trim();
  if (!offerId) errors.push("Укажите артикул.");
  if (!name) errors.push("Укажите название.");
  if (marketplace === "wildberries") {
    if (!String(row.category || "").trim()) errors.push("Выберите предмет Wildberries.");
  } else {
    if (!String(row.category || "").trim()) errors.push("Выберите категорию Ozon.");
    if (!String(row.type || "").trim()) errors.push("Выберите тип товара Ozon.");
  }
  for (const field of fields.filter((f) => f.required)) {
    const val = row.characteristics?.[field.id];
    if (val == null || String(val).trim() === "") {
      errors.push(`Заполните обязательную характеристику «${field.name}».`);
    }
  }
  const price = String(row.price ?? "").trim();
  if (price && Number.isNaN(Number(price.replace(",", ".")))) {
    errors.push("Цена должна быть числом.");
  }
  const images = (Array.isArray(row.images) ? row.images : [])
    .filter((x) => (typeof x === "string" ? true : x?.kind !== "video"))
    .map((x) => publicUrlFor(x))
    .filter(Boolean);
  if (!images.length) {
    errors.push("Добавьте хотя бы одно фото (публичный HTTPS URL — Яндекс Диск или загрузка в кабинете).");
  }
  return errors;
}

function marketplaceIdsFromRow(row) {
  const product = row?.product || {};
  return {
    vendorCode: row?.vendor_code || product.vendor_code || row?.offer_id || product.offer_id || "",
    nmId: row?.nm_id ?? product.nm_id ?? product.nmID ?? product.nmId ?? "",
    productId: row?.product_id ?? product.product_id ?? product.ozon_product_id ?? "",
  };
}

export default function MarketplaceWorkspace({ authFetch, API_URL, accessPerms, initialTab = null, onInitialTabConsumed }) {
  const canViewKeys = accessPerms?.marketplace_view_keys !== false;
  const canManageOrders = accessPerms?.marketplace_manage_orders !== false;
  const canManageCatalog = accessPerms?.marketplace_manage_catalog !== false;
  const [uiMode, setUiMode] = useState(readMpUiMode);
  const isBeginner = uiMode === "beginner";
  const [onboardStep, setOnboardStep] = useState(1);
  const [onboardDismissed, setOnboardDismissed] = useState(readOnboardDone);
  const [tab, setTab] = useState(canManageOrders ? "today" : canManageCatalog ? "create" : "manage");

  useEffect(() => {
    if (!initialTab) return;
    setTab(initialTab);
    onInitialTabConsumed?.();
  }, [initialTab, onInitialTabConsumed]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mp, setMp] = useState("ozon");
  const [settings, setSettings] = useState(null);
  const [keysForm, setKeysForm] = useState({
    ozon_client_id: "",
    ozon_api_key: "",
    wb_api_key: "",
    yandex_disk_token: "",
    environment: "sandbox",
    low_stock_threshold: 5,
    price_protect_enabled: false,
    price_min_floor_percent: 10,
    ozon_disable_auto_actions: true,
    notify_telegram: true,
    notify_push: true,
    notify_on_new_orders: true,
    notify_on_sync_errors: true,
  });
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [replyTemplates, setReplyTemplates] = useState([]);
  const [replyTemplateForm, setReplyTemplateForm] = useState({ name: "", kind: "review", body: "" });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState("");
  const [product, setProduct] = useState(emptyProduct);
  const [batch, setBatch] = useState([emptyProduct()]);
  const [csvText, setCsvText] = useState("offer_id,name,brand,price,stock,description\nSKU-1,Товар,Бренд,1290,10,Описание");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(null);
  const [orderRows, setOrderRows] = useState([]);
  const [reviewRows, setReviewRows] = useState([]);
  const [questionRows, setQuestionRows] = useState([]);
  const [reviewsUnansweredOnly, setReviewsUnansweredOnly] = useState(true);
  const [replyDraft, setReplyDraft] = useState({ open: false, kind: "review", id: null, text: "", label: "" });
  const [selectedReplyTemplateId, setSelectedReplyTemplateId] = useState("");
  const [logRows, setLogRows] = useState([]);
  const [financeRows, setFinanceRows] = useState([]);
  const [actionRows, setActionRows] = useState([]);
  const [alerts, setAlerts] = useState(null);
  const [opsSummary, setOpsSummary] = useState(null);
  const [analyticsCharts, setAnalyticsCharts] = useState({ sales: [], stocks: [], unit: [] });
  const [webhookSecretOnce, setWebhookSecretOnce] = useState("");
  const [warehouseId, setWarehouseId] = useState(() => readStoredWarehouse("ozon"));
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [supplyRows, setSupplyRows] = useState([]);
  const [supplyName, setSupplyName] = useState("");
  const [selectedSupplyId, setSelectedSupplyId] = useState("");
  const [rowMenuId, setRowMenuId] = useState(null);
  const [rowMenuPos, setRowMenuPos] = useState(null);
  const [priceStock, setPriceStock] = useState({ offer_id: "", nm_id: "", price: "", stock: "" });
  const [bulkRows, setBulkRows] = useState([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
  const [bulkCsv, setBulkCsv] = useState("offer_id,price,stock\nSKU-1,1290,10\nSKU-2,990,5");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [templateForm, setTemplateForm] = useState({ name: "", brand: "", description_text: "", price: "", stock: "0" });
  const [aiFeatures, setAiFeatures] = useState("");
  const [viewer, setViewer] = useState(null);
  const [dotsTick, setDotsTick] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [ozonCategoryTree, setOzonCategoryTree] = useState([]);
  const [wbParents, setWbParents] = useState([]);
  const [wbParentId, setWbParentId] = useState("");
  const [wbSubjectsLoading, setWbSubjectsLoading] = useState(false);
  const [attributeFields, setAttributeFields] = useState([]);
  const [attributeMirrors, setAttributeMirrors] = useState([]);
  const [attributeDictOptions, setAttributeDictOptions] = useState({});
  const [attributesHint, setAttributesHint] = useState("");
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const keysFormDirtyRef = useRef(false);

  useEffect(() => {
    setCategoryOptions([]);
    setOzonCategoryTree([]);
    setWbParents([]);
    setWbParentId("");
    setAttributeFields([]);
    setAttributeMirrors([]);
    setAttributeDictOptions({});
    setAttributesHint("");
    setOrderRows([]);
    setReviewRows([]);
    setLogRows([]);
    setFinanceRows([]);
    setActionRows([]);
    setBulkRows([emptyBulkRow(), emptyBulkRow(), emptyBulkRow()]);
    setOrderStatusFilter("");
    setWarehouseOptions([]);
    setSupplyRows([]);
    setSelectedSupplyId("");
    setSupplyName("");
    setWarehouseId(readStoredWarehouse(mp));
    setRowMenuId(null);
    setRowMenuPos(null);
    setLive(null);
  }, [mp]);

  function selectWarehouse(id) {
    const next = String(id || "");
    setWarehouseId(next);
    writeStoredWarehouse(mp, next);
  }

  useEffect(() => {
    if (!rowMenuId) return undefined;
    const close = () => {
      setRowMenuId(null);
      setRowMenuPos(null);
    };
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [rowMenuId]);

  useEffect(() => {
    if (!settings || settings.environment !== "prod") return;
    if (!["manage", "orders", "supplies", "today"].includes(tab)) return;
    if (warehouseOptions.length) return;
    loadWarehouses().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mp, settings?.environment]);

  useEffect(() => {
    if ((tab !== "supplies" && tab !== "today") || mp !== "wildberries") return;
    if (!settings || settings.environment !== "prod") return;
    loadSupplies().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, mp, settings?.environment]);

  useEffect(() => {
    if (busy === "ai" || busy === "video") {
      const id = setInterval(() => setDotsTick((t) => t + 1), 450);
      return () => clearInterval(id);
    }
    setDotsTick(0);
    return undefined;
  }, [busy]);

  const dots = busy === "ai" || busy === "video" ? ".".repeat((dotsTick % 3) + 1) : "";

  const base = `${API_URL}/marketplaces`;
  const liveRows = useMemo(() => extractRecords(live), [live]);

  const hydrateKeysForm = useCallback((data) => {
    setKeysForm({
      ozon_client_id: data.ozon_client_id || "",
      environment: data.environment || "sandbox",
      ozon_api_key: data.has_ozon_api_key ? "••••••••" : "",
      wb_api_key: data.has_wb_api_key ? "••••••••" : "",
      yandex_disk_token: data.has_yandex_disk ? "••••••••" : "",
      low_stock_threshold: data.low_stock_threshold ?? 5,
      price_protect_enabled: Boolean(data.price_protect_enabled),
      price_min_floor_percent: data.price_min_floor_percent ?? 10,
      ozon_disable_auto_actions: data.ozon_disable_auto_actions !== false,
      notify_telegram: data.notify_telegram !== false,
      notify_push: data.notify_push !== false,
      notify_on_new_orders: data.notify_on_new_orders !== false,
      notify_on_sync_errors: data.notify_on_sync_errors !== false,
    });
    keysFormDirtyRef.current = false;
  }, []);

  const loadSettings = useCallback(
    async ({ syncForm = false } = {}) => {
      const res = await authFetch(`${base}/settings/`);
      if (!res.ok) return;
      const data = await res.json();
      setSettings(data);
      // Do not wipe keys the user is typing when settings re-fetch (authFetch churn).
      if (syncForm || !keysFormDirtyRef.current) {
        hydrateKeysForm(data);
      }
    },
    [authFetch, base, hydrateKeysForm],
  );

  function updateKeysForm(patch) {
    keysFormDirtyRef.current = true;
    setKeysForm((prev) => ({ ...prev, ...patch }));
  }

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

  const loadReplyTemplates = useCallback(async () => {
    const res = await authFetch(`${base}/reply-templates/`);
    if (res.ok) {
      const data = await res.json();
      setReplyTemplates(data.results || []);
    }
  }, [authFetch, base]);

  const loadAlerts = useCallback(async () => {
    const res = await authFetch(`${base}/alerts/?marketplace=${mp === "wildberries" ? "wildberries" : "ozon"}`);
    if (res.ok) setAlerts(await res.json());
  }, [authFetch, base, mp]);

  const loadOpsSummary = useCallback(async () => {
    const res = await authFetch(`${base}/ops/summary/?hours=24`);
    if (res.ok) setOpsSummary(await res.json());
  }, [authFetch, base]);

  useEffect(() => {
    loadSettings().catch(() => setStatus("Не удалось загрузить настройки."));
    loadTemplates().catch(() => {});
    loadReplyTemplates().catch(() => {});
  }, [loadSettings, loadTemplates, loadReplyTemplates]);

  useEffect(() => {
    loadHistory().catch(() => {});
    loadAlerts().catch(() => {});
  }, [loadHistory, loadAlerts]);

  useEffect(() => {
    const disk = new URLSearchParams(window.location.search).get("disk");
    if (!disk) return;
    if (disk === "ok") setStatus("Яндекс Диск подключён.");
    if (disk === "error") setStatus("Не удалось подключить Яндекс Диск. В кабинете Яндекса OAuth добавьте Redirect URI и право Disk.");
    const next = new URL(window.location.href);
    next.searchParams.delete("disk");
    window.history.replaceState({}, document.title, `${next.pathname}${next.search}${next.hash}`);
    loadSettings({ syncForm: true }).catch(() => {});
  }, [loadSettings]);

  async function readError(res) {
    const data = await res.json().catch(() => ({}));
    return humanizeMarketplaceError(data.detail || data.error || data.message || `Ошибка ${res.status}`, res.status);
  }

  async function mpCall(action, payload = {}, params = {}) {
    const res = await authFetch(`${base}/call/`, {
      method: "POST",
      body: JSON.stringify({ marketplace: mp, action, payload, params }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(humanizeMarketplaceError(data.detail || data.message || "Ошибка площадки", res.status));
    return data;
  }

  function showLive(data) {
    if (!data || data.sandbox) {
      setLive(null);
      if (data?.sandbox) {
        setStatus(data.message || "Тестовый режим: запросы на площадку не уходят. Включите «Боевой» в Управлении.");
      }
      return;
    }
    setLive(data);
  }

  async function withBusy(key, fn) {
    setBusy(key);
    setStatus("");
    try {
      await fn();
    } catch (err) {
      setStatus(humanizeMarketplaceError(err?.message || "Не удалось выполнить запрос."));
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
        low_stock_threshold: Number(keysForm.low_stock_threshold ?? 5),
        price_protect_enabled: Boolean(keysForm.price_protect_enabled),
        price_min_floor_percent: Number(keysForm.price_min_floor_percent ?? 10),
        ozon_disable_auto_actions: Boolean(keysForm.ozon_disable_auto_actions),
        notify_telegram: Boolean(keysForm.notify_telegram),
        notify_push: Boolean(keysForm.notify_push),
        notify_on_new_orders: Boolean(keysForm.notify_on_new_orders),
        notify_on_sync_errors: Boolean(keysForm.notify_on_sync_errors),
      };
      if (keysForm.ozon_api_key && !keysForm.ozon_api_key.startsWith("•")) body.ozon_api_key = keysForm.ozon_api_key;
      if (keysForm.wb_api_key && !keysForm.wb_api_key.startsWith("•")) body.wb_api_key = keysForm.wb_api_key;
      if (keysForm.yandex_disk_token && !keysForm.yandex_disk_token.startsWith("•")) {
        body.yandex_disk_token = keysForm.yandex_disk_token;
      }
      const res = await authFetch(`${base}/settings/`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await readError(res));
      await loadSettings({ syncForm: true });
      setStatus("Ключи сохранены.");
    });
  }

  function productPayload(row) {
    const list = Array.isArray(row.images) ? row.images : [];
    const images = list
      .filter((x) => (typeof x === "string" ? true : x?.kind !== "video"))
      .map((x) => publicUrlFor(x))
      .filter(Boolean);
    const videos = list
      .filter((x) => (typeof x === "string" ? /\.(webm|mp4|mov)($|\?)/i.test(x) : isVideoMediaItem(x)))
      .map((x) => publicUrlFor(x))
      .filter(Boolean);
    const characteristics = applyAttributeMirrors(row.characteristics || {}, attributeMirrors, row);
    const requiredIds = attributeFields.filter((f) => f.required).map((f) => f.id);
    const requiredNames = {};
    const characteristicsMeta = {};
    for (const field of attributeFields) {
      if (field.required) requiredNames[field.id] = field.name;
      if (field.dictionaryId || field.dictionary) {
        characteristicsMeta[field.id] = { dictionary: true };
      }
    }
    for (const field of attributeMirrors) {
      if (field.dictionaryId || field.dictionary) {
        characteristicsMeta[field.id] = { dictionary: true };
      }
    }
    return {
      offer_id: row.offer_id,
      vendor_code: row.vendor_code || row.offer_id,
      name: row.name,
      brand: row.brand,
      price: row.price,
      stock: Number(row.stock || 0),
      description: row.description,
      barcode: row.barcode,
      category: row.category,
      type: row.type,
      characteristics,
      required_attributes: requiredIds,
      required_attribute_names: requiredNames,
      characteristics_meta: characteristicsMeta,
      images,
      videos,
      wb_sku: row.offer_id,
      wb_images: images,
      nm_id: row.nm_id,
      product_id: row.product_id,
    };
  }

  async function refreshImportStatus(row) {
    const body = row?.id ? { history_id: row.id } : { task_id: row.import_task_id };
    const res = await authFetch(`${base}/products/import-status/`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(humanizeMarketplaceError(data.detail || "Не удалось получить статус импорта.", res.status));
    await loadHistory();
    return data;
  }

  async function pollImportStatus(historyId, taskId, attempts = 8) {
    for (let i = 0; i < attempts; i += 1) {
      await new Promise((r) => setTimeout(r, i === 0 ? 1500 : 2500));
      try {
        const data = await refreshImportStatus({ id: historyId, import_task_id: taskId });
        const status = data.import_status || "pending";
        if (status === "success") {
          setStatus(`Ozon: карточка импортирована (task ${taskId}).`);
          return;
        }
        if (status === "failed") {
          const err = (data.items || []).map((x) => x.errors).filter(Boolean).join("; ");
          setStatus(err ? `Ozon: ошибка импорта — ${humanizeMarketplaceError(err)}` : "Ozon: ошибка импорта.");
          return;
        }
      } catch {
        /* keep polling */
      }
    }
    setStatus(`Ozon: импорт ещё обрабатывается (task ${taskId}). Нажмите «Статус импорта» позже.`);
  }

  async function importProducts(products) {
    const res = await authFetch(`${base}/products/import/`, {
      method: "POST",
      body: JSON.stringify({ marketplace: mp, products }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(humanizeMarketplaceError(data.detail || "Не удалось выгрузить товары.", res.status));
    const failed = (data.results || []).filter((r) => !r.ok);
    if (failed.length) {
      const msg = humanizeMarketplaceError(failed[0]?.error || failed[0]?.detail || "Ошибка выгрузки.");
      setStatus(`Не удалось выгрузить: ${msg}`);
    } else {
      setStatus(`Выгружено: ${data.ok} из ${data.total}.`);
    }
    await loadHistory();
    if (mp === "ozon") {
      for (const row of data.results || []) {
        if (row.ok && row.task_id) pollImportStatus(row.id, row.task_id);
      }
    }
    return data;
  }

  async function submitOne(e) {
    e.preventDefault();
    await withBusy("create", async () => {
      const validationErrors = validateProductForImport(product, mp, attributeFields);
      if (validationErrors.length) {
        throw new Error(validationErrors.slice(0, 4).join(" "));
      }
      await importProducts([productPayload(product)]);
      setProduct(emptyProduct());
      setEditingHistoryId(null);
      setAttributeFields([]);
      setAttributeMirrors([]);
      setAttributeDictOptions({});
      setAttributesHint("");
      if (!onboardDismissed) finishOnboard();
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

  async function loadCategoryOptions() {
    await withBusy("cats", async () => {
      if (settings?.environment !== "prod") {
        throw new Error("Категории с площадки доступны в боевом режиме (Меню → Настройки).");
      }
      if (mp === "wildberries") {
        const data = await mpCall("categories.parents");
        if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
        const parents = flattenWbParents(data);
        if (!parents.length) throw new Error("Wildberries не вернул родительские категории.");
        setWbParents(parents);
        setWbParentId("");
        setCategoryOptions([]);
        setOzonCategoryTree([]);
        setStatus(`Загружено разделов WB: ${parents.length}. Выберите раздел, затем предмет.`);
        return;
      }
      const data = await mpCall("categories.tree", { language: "DEFAULT" });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      const tree = extractOzonCategoryTree(data);
      if (!tree.length) throw new Error("Ozon не вернул дерево категорий.");
      setOzonCategoryTree(tree);
      setCategoryOptions([]);
      setWbParents([]);
      setStatus(`Дерево Ozon загружено (${tree.length} корневых разделов). Откройте список и идите по уровням или ищите.`);
    });
  }

  async function loadWbSubjectsForParent(parentId) {
    setWbParentId(parentId || "");
    setCategoryOptions([]);
    if (!parentId) return;
    setWbSubjectsLoading(true);
    try {
      const data = await mpCall("categories.subjects", {}, { parentID: parentId, limit: 1000, offset: 0 });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      const options = flattenWbSubjects(data);
      setCategoryOptions(options);
      if (!options.length) setStatus("В этом разделе WB нет предметов.");
    } catch (err) {
      setCategoryOptions([]);
      setStatus(err?.message || "Не удалось загрузить предметы WB.");
    } finally {
      setWbSubjectsLoading(false);
    }
  }

  async function loadOzonDictionaryOptions(categoryId, typeId, fields) {
    const dictFields = fields.filter((f) => f.dictionaryId);
    if (!dictFields.length) {
      setAttributeDictOptions({});
      return;
    }
    const next = {};
    for (const field of dictFields) {
      try {
        const data = await mpCall("categories.attribute_values", {
          attribute_id: Number(field.id),
          description_category_id: Number(categoryId),
          type_id: Number(typeId),
          language: "DEFAULT",
          limit: 200,
          last_value_id: 0,
        });
        next[field.id] = normalizeOzonDictionaryValues(data);
      } catch {
        next[field.id] = [];
      }
    }
    setAttributeDictOptions(next);
  }

  async function loadAttributesForCategory(categoryId, typeId = "") {
    if (!categoryId) {
      setAttributeFields([]);
      setAttributeMirrors([]);
      setAttributeDictOptions({});
      setAttributesHint("");
      return;
    }
    await withBusy("attrs", async () => {
      if (settings?.environment !== "prod") {
        setAttributesHint("Характеристики подгружаются в боевом режиме с ключами площадки.");
        return;
      }
      if (mp === "wildberries") {
        const data = await mpCall("categories.charcs", {}, { subject_id: categoryId });
        if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
        const { visible, mirrors } = splitCardAttributes(normalizeWbCharacteristics(data));
        setAttributeFields(sortAttributesRequiredFirst(visible));
        setAttributeMirrors(mirrors);
        setAttributeDictOptions({});
        const hidden = mirrors.length ? ` (скрыто дублей карточки: ${mirrors.length})` : "";
        const req = visible.filter((f) => f.required).length;
        setAttributesHint(
          visible.length
            ? `Характеристик WB: ${visible.length} (обязательных: ${req})${hidden}. Сначала обязательные.`
            : `Для предмета нет доп. характеристик.${hidden}`,
        );
        return;
      }
      if (!typeId) {
        setAttributeFields([]);
        setAttributeMirrors([]);
        setAttributeDictOptions({});
        setAttributesHint("Для Ozon выберите категорию с типом товара.");
        return;
      }
      const data = await mpCall("categories.attributes", {
        description_category_id: Number(categoryId),
        type_id: Number(typeId),
        language: "DEFAULT",
      });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      const { visible, mirrors } = splitCardAttributes(normalizeOzonAttributes(data));
      const ordered = sortAttributesRequiredFirst(visible);
      setAttributeFields(ordered);
      setAttributeMirrors(mirrors);
      const hidden = mirrors.length ? ` (скрыто дублей карточки: ${mirrors.length})` : "";
      const req = visible.filter((f) => f.required).length;
      setAttributesHint(
        visible.length
          ? `Характеристик Ozon: ${visible.length} (обязательных: ${req})${hidden}. Сначала обязательные.`
          : `Для категории нет доп. характеристик.${hidden}`,
      );
      await loadOzonDictionaryOptions(categoryId, typeId, ordered);
    });
  }

  function onOzonCategoryPick(value) {
    const [categoryId, typeId] = String(value || "").split(":");
    setProduct((p) => ({ ...p, category: categoryId || "", type: typeId || "", characteristics: {} }));
    setAttributeDictOptions({});
    loadAttributesForCategory(categoryId, typeId).catch(() => {});
  }

  function onWbCategoryPick(value) {
    setProduct((p) => ({ ...p, category: value || "", type: "", characteristics: {} }));
    setAttributeDictOptions({});
    loadAttributesForCategory(value).catch(() => {});
  }

  function setCharacteristic(id, value) {
    setProduct((p) => ({
      ...p,
      characteristics: { ...(p.characteristics || {}), [id]: value },
    }));
  }

  async function uploadSingleMediaFile(file) {
    const previewUrl = URL.createObjectURL(file);
    const fd = new FormData();
    fd.append("file", file);
    const res = await authFetch(`${base}/media/`, { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      URL.revokeObjectURL(previewUrl);
      throw new Error(data.detail || `Не удалось загрузить «${file.name}».`);
    }
    return {
      url: data.url,
      public_url: data.public_url || data.disk_url || data.url,
      thumb_url: data.thumb_url || data.url,
      disk_url: data.disk_url || "",
      previewUrl,
      name: file.name || data.name || "файл",
      kind: isVideoFile(file) ? "video" : "image",
      stored: data.stored,
    };
  }

  async function uploadMedia(input) {
    const files = Array.from(
      input instanceof FileList ? input : input instanceof File ? [input] : Array.isArray(input) ? input : [],
    ).filter(Boolean);
    if (!files.length) return;

    await withBusy("media", async () => {
      const limits = mediaLimitsFor(mp);
      const mpLabel = mp === "wildberries" ? "Wildberries" : "Ozon";
      const counts = countMediaItems(product.images);

      const photoFiles = [];
      const videoFiles = [];
      for (const file of files) {
        (isVideoFile(file) ? videoFiles : photoFiles).push(file);
      }

      let photoRoom = limits.photos - counts.photos;
      let videoRoom = limits.videos - counts.videos;
      const skipped = [];
      const queue = [];

      for (const file of photoFiles) {
        if (photoRoom <= 0) {
          skipped.push(file.name);
          continue;
        }
        queue.push(file);
        photoRoom -= 1;
      }
      for (const file of videoFiles) {
        if (videoRoom <= 0) {
          skipped.push(file.name);
          continue;
        }
        queue.push(file);
        videoRoom -= 1;
      }

      if (!queue.length) {
        const parts = [];
        if (photoFiles.length && counts.photos >= limits.photos) {
          parts.push(`лимит фото для ${mpLabel}: ${limits.photos}`);
        }
        if (videoFiles.length && counts.videos >= limits.videos) {
          parts.push(`лимит видео: ${limits.videos}`);
        }
        throw new Error(parts.length ? `Достигнут ${parts.join("; ")}.` : "Нет файлов для загрузки.");
      }

      const added = [];
      const failures = [];
      let diskCount = 0;
      for (const file of queue) {
        try {
          const item = await uploadSingleMediaFile(file);
          if (item.stored === "yandex_disk") diskCount += 1;
          added.push({
            url: item.url,
            public_url: item.public_url,
            disk_url: item.disk_url,
            previewUrl: item.previewUrl,
            name: item.name,
            kind: item.kind,
          });
        } catch (err) {
          failures.push(err?.message || file.name);
        }
      }

      if (!added.length) {
        throw new Error(failures[0] || "Не удалось загрузить файлы.");
      }

      setProduct((p) => ({
        ...p,
        images: [...(Array.isArray(p.images) ? p.images : []), ...added],
      }));

      let msg = `Загружено: ${added.length}.`;
      if (skipped.length) {
        msg += ` Не загружено ${skipped.length} — лимит ${mpLabel}: ${limits.photos} фото, ${limits.videos} видео.`;
      }
      if (failures.length) {
        msg += ` Ошибки: ${failures.slice(0, 2).join("; ")}`;
      }
      if (diskCount === added.length) {
        msg = `Загружено на Яндекс Диск: ${added.length}.`;
        if (skipped.length) msg += ` Пропущено из‑за лимита: ${skipped.length}.`;
      }
      setStatus(msg);
    });
  }

  function mediaSrc(item) {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.previewUrl || item.thumb_url || item.url || "";
  }

  function removeImage(url) {
    setProduct((p) => ({
      ...p,
      images: (p.images || []).filter((x) => {
        const itemUrl = x?.url || x;
        if (itemUrl !== url) return true;
        if (x?.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(x.previewUrl);
        return false;
      }),
    }));
  }

  async function generateDescription() {
    await withBusy("ai", async () => {
      if (!settings?.ai_enabled) throw new Error("ИИ-описание выключено. Включите OPENROUTER/OLLAMA на сервере.");
      if (!String(product?.name || "").trim()) throw new Error("Укажите название товара для генерации описания.");
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
      setProduct((p) => ({ ...p, description: cleanAiDescription(data.description || p.description) }));
      setStatus("Описание сгенерировано.");
    });
  }

  async function generateVideo() {
    await withBusy("video", async () => {
      if (typeof MediaRecorder === "undefined") throw new Error("Ваш браузер не поддерживает генерацию видео.");
      if (!String(product?.name || "").trim()) throw new Error("Укажите название товара для генерации видео карточки.");
      const limits = mediaLimitsFor(mp);
      const counts = countMediaItems(product.images);
      if (counts.videos >= limits.videos) {
        const mpLabel = mp === "wildberries" ? "Wildberries" : "Ozon";
        throw new Error(`Лимит видео для ${mpLabel}: ${limits.videos}. Удалите текущее видео перед генерацией нового.`);
      }
      const photos = (Array.isArray(product?.images) ? product.images : []).filter((x) => {
        if (typeof x === "string") return true;
        return x?.kind !== "video";
      });
      if (!photos.length) throw new Error("Загрузите хотя бы одно фото для генерации видео карточки.");
      const blob = await renderProductCardVideo({ images: product.images });
      const localPreview = URL.createObjectURL(blob);
      const file = new File([blob], "card-video.webm", { type: blob.type || "video/webm" });
      const fd = new FormData();
      fd.append("file", file);
      const res = await authFetch(`${base}/media/`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        URL.revokeObjectURL(localPreview);
        throw new Error(data.detail || "Не удалось сохранить видео.");
      }
      const videoItem = {
        url: data.url,
        public_url: data.public_url || data.disk_url || data.url,
        previewUrl: localPreview,
        name: "Видео карточки",
        kind: "video",
      };
      setProduct((p) => ({
        ...p,
        images: [...(Array.isArray(p.images) ? p.images : []), videoItem],
      }));
      setStatus("Видео карточки готово.");
    });
  }

  async function connectYandexDisk() {
    await withBusy("disk", async () => {
      const res = await authFetch(`${base}/yandex-disk/start/`, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось начать подключение Диска.");
      if (!data.authorize_url) throw new Error("Яндекс не вернул ссылку авторизации.");
      window.location.href = data.authorize_url;
    });
  }

  async function disconnectYandexDisk() {
    await withBusy("disk", async () => {
      const res = await authFetch(`${base}/settings/`, {
        method: "PATCH",
        body: JSON.stringify({ yandex_disk_token: "" }),
      });
      if (!res.ok) throw new Error(await readError(res));
      await loadSettings({ syncForm: true });
      setStatus("Яндекс Диск отключён.");
    });
  }

  async function applyPricesStocks() {
    await withBusy("prices", async () => {
      if (!priceStock.offer_id && !priceStock.nm_id) throw new Error("Укажите артикул или nmID.");
      const data = await sendPriceStockRows([
        {
          offer_id: priceStock.offer_id,
          nm_id: priceStock.nm_id,
          price: priceStock.price,
          stock: priceStock.stock,
        },
      ]);
      if (data?.sandbox) {
        setStatus(data.message || "Тестовый режим: на площадку ничего не ушло.");
        return;
      }
      setStatus("Цены и остатки отправлены.");
    });
  }

  async function sendPriceStockRows(rows) {
    const list = (rows || []).filter((r) => r.offer_id || r.nm_id || r.product_id);
    if (!list.length) throw new Error("Нет строк для обновления.");
    if (list.some((r) => r.stock !== "" && r.stock != null) && !warehouseId) {
      throw new Error("Укажите ID склада для обновления остатков.");
    }
    const withPrice = list.filter((r) => r.price !== "" && r.price != null);
    const withStock = list.filter((r) => r.stock !== "" && r.stock != null);
    let last = null;
    if (withPrice.length) {
      const protect = Boolean(settings?.price_protect_enabled ?? keysForm.price_protect_enabled);
      const floorPct = Math.max(0, Math.min(90, Number(settings?.price_min_floor_percent ?? keysForm.price_min_floor_percent ?? 10)));
      const disableAuto = Boolean(settings?.ozon_disable_auto_actions ?? keysForm.ozon_disable_auto_actions);
      const payload =
        mp === "wildberries"
          ? {
              data: withPrice.map((r) => ({
                nmID: Number(r.nm_id || r.offer_id),
                price: Number(r.price),
                discount: protect ? 0 : 0,
              })),
            }
          : {
              prices: withPrice.map((r) => {
                const priceNum = Number(String(r.price).replace(",", "."));
                const minPrice =
                  protect && Number.isFinite(priceNum)
                    ? String(Math.max(1, Math.round(priceNum * (100 - floorPct)) / 100))
                    : "0";
                const item = {
                  offer_id: r.offer_id,
                  product_id: r.product_id ? Number(r.product_id) : undefined,
                  price: String(r.price),
                  old_price: "0",
                  min_price: minPrice,
                  currency_code: "RUB",
                };
                if (protect && disableAuto) item.auto_action_enabled = "DISABLED";
                return item;
              }),
            };
      last = await mpCall("products.prices", payload);
      showLive(last);
    }
    if (withStock.length) {
      const payload =
        mp === "wildberries"
          ? {
              stocks: withStock.map((r) => ({
                sku: r.barcode || r.offer_id || String(r.nm_id || ""),
                amount: Number(r.stock || 0),
              })),
            }
          : {
              stocks: withStock.map((r) => ({
                offer_id: r.offer_id,
                product_id: r.product_id ? Number(r.product_id) : undefined,
                stock: Number(r.stock || 0),
                warehouse_id: Number(warehouseId || 0),
              })),
            };
      const params = mp === "wildberries" ? { warehouseId: warehouseId || "0" } : {};
      last = await mpCall("products.stocks", payload, params);
      showLive(last);
    }
    if (!withPrice.length && !withStock.length) {
      throw new Error("Заполните цену и/или остаток хотя бы в одной строке.");
    }
    return last;
  }

  async function applyBulkPricesStocks() {
    await withBusy("bulk-prices", async () => {
      const data = await sendPriceStockRows(bulkRows);
      if (data?.sandbox) {
        setStatus(data.message || "Тестовый режим: на площадку ничего не ушло.");
        return;
      }
      const updated = bulkRows.filter((r) => r.offer_id || r.nm_id);
      setHistory((prev) =>
        (prev || []).map((row) => {
          const ids = marketplaceIdsFromRow(row);
          const hit = updated.find(
            (r) =>
              (r.offer_id && r.offer_id === ids.vendorCode) ||
              (r.nm_id && String(r.nm_id) === String(ids.nmId)),
          );
          if (!hit || hit.stock === "" || hit.stock == null) return row;
          const product = { ...(row.product || {}), stock: Number(hit.stock) };
          return { ...row, product };
        }),
      );
      setStatus(`Массово отправлено строк: ${updated.length}.`);
    });
  }

  function fillBulkFromHistory() {
    const rows = (history || [])
      .slice(0, 50)
      .map((row) => {
        const ids = marketplaceIdsFromRow(row);
        return {
          offer_id: ids.vendorCode || row.offer_id || "",
          nm_id: ids.nmId ? String(ids.nmId) : "",
          product_id: ids.productId ? String(ids.productId) : "",
          barcode: row.product?.barcode || row.barcode || "",
          price: row.product?.price != null ? String(row.product.price) : "",
          stock: row.product?.stock != null ? String(row.product.stock) : "",
        };
      })
      .filter((r) => r.offer_id || r.nm_id);
    setBulkRows(rows.length ? rows : [emptyBulkRow()]);
    setStatus(rows.length ? `В таблицу подставлено ${rows.length} из истории.` : "В истории пока нет товаров.");
  }

  function importBulkCsv() {
    const rows = parseBulkCsv(bulkCsv);
    if (!rows.length) {
      setStatus("CSV пуст или не разобран. Нужны колонки offer_id,price,stock.");
      return;
    }
    setBulkRows(rows);
    setStatus(`Из CSV загружено строк: ${rows.length}.`);
  }

  async function deleteProduct(row) {
    const ids = typeof row === "object" ? marketplaceIdsFromRow(row) : { vendorCode: row, nmId: "", productId: "" };
    const label = ids.vendorCode || ids.nmId || ids.productId || "товар";
    if (!window.confirm(`Удалить карточку ${label} на площадке?`)) return;
    await withBusy("delete", async () => {
      const payload =
        mp === "wildberries"
          ? { nmIDs: [Number(ids.nmId || ids.vendorCode)] }
          : { product_id: [Number(ids.productId || ids.vendorCode)] };
      showLive(await mpCall("products.delete", payload));
      setStatus("Запрос на удаление отправлен.");
    });
  }

  function fillPriceStockFromHistory(row) {
    const ids = marketplaceIdsFromRow(row);
    setPriceStock({
      offer_id: ids.vendorCode,
      nm_id: ids.nmId ? String(ids.nmId) : "",
      price: row.product?.price != null ? String(row.product.price) : "",
      stock: row.product?.stock != null ? String(row.product.stock) : "",
    });
    setTab("manage");
    setMenuOpen(false);
    setStatus(`Подставлены данные для ${ids.vendorCode || ids.nmId || "товара"}.`);
  }

  function productFromHistory(row) {
    const p = row?.product || {};
    const images = (Array.isArray(p.images) ? p.images : []).map((img) => {
      if (typeof img === "string") {
        return { url: img, public_url: img };
      }
      return {
        ...img,
        public_url: img.public_url || img.disk_url || img.url || "",
        url: img.url || img.public_url || "",
      };
    });
    return {
      offer_id: p.offer_id || row.offer_id || "",
      vendor_code: p.vendor_code || row.vendor_code || p.offer_id || row.offer_id || "",
      nm_id: p.nm_id ?? row.nm_id,
      product_id: p.product_id ?? row.product_id,
      name: p.name || "",
      brand: p.brand || "",
      price: p.price != null ? String(p.price) : "",
      stock: p.stock != null ? String(p.stock) : "0",
      description: p.description || "",
      barcode: p.barcode || "",
      category: p.category != null ? String(p.category) : "",
      type: p.type != null ? String(p.type) : "",
      characteristics: p.characteristics || {},
      images,
    };
  }

  function openEditorFromHistory(row) {
    setProduct(productFromHistory(row));
    setEditingHistoryId(row.id);
    setTab("create");
    setStatus(`Редактирование ${row.offer_id}. Измените поля и нажмите «Сохранить на площадке».`);
    if (row.product?.category) {
      loadAttributesForCategory(String(row.product.category), String(row.product.type || "")).catch(() => {});
    }
  }

  async function fetchProductForEdit(offerId) {
    await withBusy("fetch-product", async () => {
      if (!offerId) throw new Error("Укажите артикул.");
      const res = await authFetch(`${base}/products/fetch/`, {
        method: "POST",
        body: JSON.stringify({ marketplace: mp, offer_id: offerId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось загрузить товар.");
      setProduct({ ...emptyProduct(), ...data.product });
      setEditingHistoryId(null);
      setTab("create");
      setStatus(`Загружено с ${mp === "wildberries" ? "Wildberries" : "Ozon"}: ${offerId}`);
      if (data.product?.category) {
        loadAttributesForCategory(String(data.product.category), String(data.product.type || "")).catch(() => {});
      }
    });
  }

  async function checkImportStatus(row) {
    await withBusy("import-status", async () => {
      const data = await refreshImportStatus(row);
      const err = (data.items || []).map((x) => x.errors).filter(Boolean).join("; ");
      setStatus(
        err
          ? `Статус импорта: ${data.import_status}. ${err}`
          : `Статус импорта Ozon: ${data.import_status || "pending"}`,
      );
    });
  }

  async function loadLiveProducts() {
    await withBusy("live-products", async () => {
      const payload =
        mp === "wildberries"
          ? { settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }
          : { filter: { visibility: "ALL" }, last_id: "", limit: 100 };
      const data = await mpCall("products.list", payload);
      if (data?.sandbox) {
        setLive(null);
        setStatus(data.message || "Тестовый режим: список с площадки не загружен.");
        return;
      }
      const rows = extractRecords(data);
      setLive(null);
      setStatus(rows.length ? `С площадки получено карточек: ${rows.length}` : "На площадке товаров не найдено.");
    });
  }

  async function syncCatalogFromMarketplace() {
    await withBusy("catalog-sync", async () => {
      const res = await authFetch(`${base}/products/sync-catalog/`, {
        method: "POST",
        body: JSON.stringify({ marketplace: mp, limit: 50 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeMarketplaceError(data.detail || data.message || `Ошибка ${res.status}`, res.status));
      await loadHistory();
      setStatus(
        `Каталог подтянут: новых ${data.created || 0}, обновлено ${data.updated || 0}` +
          (data.skipped ? `, пропущено ${data.skipped}` : "") +
          ".",
      );
    });
  }

  function cloneProductToOtherMp() {
    const target = mp === "wildberries" ? "ozon" : "wildberries";
    const snapshot = {
      ...emptyProduct(),
      offer_id: product.offer_id,
      vendor_code: product.vendor_code || product.offer_id,
      name: product.name,
      brand: product.brand,
      price: product.price,
      stock: product.stock,
      description: product.description,
      barcode: product.barcode,
      images: Array.isArray(product.images) ? product.images.map((img) => ({ ...img })) : [],
    };
    setMp(target);
    setProduct(snapshot);
    setEditingHistoryId(null);
    setAttributeFields([]);
    setAttributeMirrors([]);
    setAttributeDictOptions({});
    setAttributesHint("");
    setCategoryOptions([]);
    setOzonCategoryTree([]);
    setWbParents([]);
    setTab("create");
    setStatus(
      `Карточка скопирована на ${target === "ozon" ? "Ozon" : "Wildberries"}. Выберите категорию этой площадки и нажмите «Выгрузить».`,
    );
  }

  function saveCurrentAsTemplate() {
    setTemplateForm({
      name: product.name || product.offer_id || "Шаблон",
      brand: product.brand || "",
      description_text: product.description || "",
      price: product.price || "",
      stock: String(product.stock || "0"),
    });
    setTab("manage");
    setStatus("Заполнена форма шаблона внизу «Управления» — нажмите «Сохранить шаблон».");
  }

  async function loadOrders() {
    await withBusy("orders", async () => {
      const payload =
        mp === "wildberries"
          ? {}
          : {
              dir: "DESC",
              filter: {
                since: daysAgoIso(14),
                to: new Date().toISOString().slice(0, 19) + "Z",
                ...(orderStatusFilter ? { status: orderStatusFilter } : {}),
                ...(warehouseId ? { warehouse_id: Number(warehouseId) } : {}),
              },
              limit: 50,
              offset: 0,
              with: { analytics_data: true, financial_data: true },
            };
      const data = await mpCall("orders.list", payload);
      if (data?.sandbox) {
        setOrderRows([]);
        setStatus(data.message || "Тестовый режим: заказы не загружены.");
        return;
      }
      const rows = normalizeOrders(data, mp);
      setOrderRows(rows);
      setLive(null);
      setStatus(rows.length ? `Заказов: ${rows.length}` : "Заказов не найдено.");
    });
  }

  async function linkOrderToChat(row) {
    await withBusy("order-chat", async () => {
      const res = await authFetch(`${base}/orders/link-chat/`, {
        method: "POST",
        body: JSON.stringify({
          marketplace: mp,
          order_id: row.number || row.id,
          text: `Заказ ${mp === "wildberries" ? "WB" : "Ozon"} ${row.number || row.id}${row.sku ? ` · ${row.sku}` : ""}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(humanizeMarketplaceError(data.detail || "Не удалось связать с чатом", res.status));
      setStatus(`Заказ сохранён в чат Вместе (conversation #${data.conversation_id}).`);
    });
  }

  async function loadOpsSummaryClick() {
    await withBusy("ops", loadOpsSummary);
    setStatus("Сводка за 24 часа обновлена.");
  }

  async function cancelOrder(row) {
    const label = row.number || row.id;
    if (!window.confirm(`Отменить заказ ${label}?`)) return;
    await withBusy("order-cancel", async () => {
      if (mp === "wildberries") {
        showLive(await mpCall("orders.cancel", {}, { id: row.id }));
      } else {
        showLive(
          await mpCall("orders.cancel", {
            posting_number: row.number,
            cancel_reason_id: 352, // Прочее
          }),
        );
      }
      setStatus(`Запрос на отмену ${label} отправлен.`);
      await loadOrders();
    });
  }

  async function shipOrder(row) {
    if (mp !== "ozon") {
      setStatus("Отгрузка из кабинета пока для Ozon FBS.");
      return;
    }
    if (!window.confirm(`Собрать и отгрузить отправление ${row.number}?`)) return;
    await withBusy("order-ship", async () => {
      const products = (row.raw?.products || [])
        .map((p) => ({
          product_id: Number(p.sku || p.product_id || 0),
          quantity: Number(p.quantity || 1),
        }))
        .filter((p) => p.product_id);
      if (!products.length) throw new Error("В отправлении нет товаров с SKU — отгрузка невозможна.");
      showLive(
        await mpCall("orders.ship", {
          posting_number: row.number,
          packages: [{ products }],
        }),
      );
      setStatus(`Отправление ${row.number} передано в сборку/отгрузку. Через ~1 мин можно печатать этикетку.`);
      await loadOrders();
    });
  }

  async function printOrderLabel(row) {
    if (mp !== "ozon") {
      setStatus("Этикетки PDF из кабинета — для Ozon FBS.");
      return;
    }
    await withBusy("order-label", async () => {
      const res = await authFetch(`${base}/orders/label/`, {
        method: "POST",
        body: JSON.stringify({ posting_numbers: [row.number] }),
      });
      const ctype = res.headers.get("content-type") || "";
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || "Не удалось получить этикетку. Обычно нужно подождать 45–60 сек после сборки.");
      }
      if (!ctype.includes("pdf")) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || data.message || "Ozon не вернул PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ozon-label-${String(row.number).replace(/[^\w.-]+/g, "_")}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus(`Этикетка ${row.number} скачана.`);
    });
  }

  async function loadReviews() {
    await withBusy("reviews", async () => {
      const unanswered = reviewsUnansweredOnly;
      let data;
      if (mp === "wildberries") {
        data = await mpCall(
          "feedbacks.list",
          { isAnswered: !unanswered, take: 50, skip: 0 },
          { isAnswered: !unanswered, take: 50, skip: 0 },
        );
      } else {
        data = await mpCall("reviews.list", {
          filter: unanswered ? { processed: false } : {},
          limit: 50,
          sort_dir: "DESC",
          last_id: "",
        });
      }
      if (data?.sandbox) {
        setReviewRows([]);
        setStatus(data.message || "Тестовый режим: отзывы не загружены.");
        return;
      }
      let rows = normalizeReviews(data, mp);
      if (unanswered) rows = rows.filter((r) => !r.answered);
      setReviewRows(rows);
      setLive(null);
      setStatus(rows.length ? `Отзывов: ${rows.length}${unanswered ? " (без ответа)" : ""}` : "Отзывов не найдено.");
    });
  }

  function openReplyDraft(kind, row) {
    setReplyDraft({
      open: true,
      kind,
      id: row.id,
      text: "",
      label: kind === "question" ? `Вопрос: ${row.text?.slice(0, 80) || row.id}` : `Отзыв ${row.rating}: ${row.text?.slice(0, 80) || row.id}`,
    });
    setSelectedReplyTemplateId("");
  }

  function applySelectedReplyTemplate() {
    const t = replyTemplates.find((x) => String(x.id) === String(selectedReplyTemplateId));
    if (!t) return;
    setReplyDraft((d) => ({ ...d, text: t.body || "" }));
  }

  async function submitReplyDraft() {
    const answer = String(replyDraft.text || "").trim();
    if (!answer) throw new Error("Введите текст ответа.");
    await withBusy("review-answer", async () => {
      if (replyDraft.kind === "question") {
        showLive(await mpCall("questions.answer", { id: replyDraft.id, text: answer, answer: { text: answer } }));
        setStatus("Ответ на вопрос отправлен.");
        setReplyDraft({ open: false, kind: "review", id: null, text: "", label: "" });
        await loadQuestions();
        return;
      }
      if (mp === "wildberries") {
        showLive(await mpCall("feedbacks.answer", { id: replyDraft.id, text: answer }));
      } else {
        showLive(
          await mpCall("reviews.answer", {
            review_id: replyDraft.id,
            text: answer,
            mark_review_as_processed: true,
          }),
        );
      }
      setStatus("Ответ на отзыв отправлен.");
      setReplyDraft({ open: false, kind: "review", id: null, text: "", label: "" });
      await loadReviews();
    });
  }

  async function answerReview(row) {
    openReplyDraft("review", row);
  }

  async function answerQuestion(row) {
    openReplyDraft("question", row);
  }

  function exportHistoryCsv() {
    const rows = filteredHistory.map((h) => {
      const ids = marketplaceIdsFromRow(h);
      return [
        h.offer_id || "",
        ids.vendorCode || "",
        ids.nmId || "",
        ids.productId || "",
        h.product?.name || "",
        h.product?.brand || "",
        h.product?.price ?? "",
        h.product?.stock ?? "",
        h.status || "",
        importStatusLabel(h),
        h.updated_at || "",
      ];
    });
    downloadCsv(
      `marketplace-history-${mp}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["offer_id", "vendor_code", "nm_id", "product_id", "name", "brand", "price", "stock", "status", "import_status", "updated_at"],
      rows,
    );
    setStatus(`Экспортировано в CSV: ${rows.length}`);
  }

  async function exportHistoryServer(format = "csv") {
    await withBusy("export", async () => {
      const res = await authFetch(
        `${base}/export/?export=${encodeURIComponent(format)}&marketplace=${mp === "wildberries" ? "wildberries" : "ozon"}`,
      );
      if (!res.ok) throw new Error(await readError(res));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = format === "xlsx" ? "marketplace-history.xlsx" : "marketplace-history.csv";
      a.click();
      URL.revokeObjectURL(url);
      setStatus(format === "xlsx" ? "Excel скачан." : "CSV с сервера скачан.");
    });
  }

  async function generateBarcode() {
    await withBusy("barcode", async () => {
      const productId = product.product_id || product.productId;
      const body = {
        marketplace: mp,
        count: 1,
      };
      if (mp === "ozon") {
        if (productId) {
          body.product_ids = [productId];
        } else {
          body.local = true;
        }
      }
      const res = await authFetch(`${base}/barcodes/generate/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось сгенерировать штрихкод.");
      if (data.sandbox) throw new Error(data.message || "Тестовый режим.");
      const code = (data.barcodes || [])[0];
      if (!code) throw new Error("Площадка не вернула штрихкод.");
      setProduct((p) => ({ ...p, barcode: String(code) }));
      setStatus(
        data.source === "local"
          ? `Локальный штрихкод для новой карточки: ${code}`
          : `Штрихкод с площадки: ${code}`,
      );
    });
  }

  async function loadApiLogs() {
    await withBusy("logs", async () => {
      const res = await authFetch(`${base}/logs/?limit=100&marketplace=${mp === "wildberries" ? "wb" : "ozon"}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось загрузить логи.");
      setLogRows(data.results || []);
      setStatus(`Логов: ${(data.results || []).length}`);
    });
  }

  async function loadFinance() {
    await withBusy("finance", async () => {
      if (mp === "ozon") {
        const from = ozonTimestampDaysAgo(30);
        const to = ozonTimestampNow();
        const fin = await mpCall("finance.list", {
          filter: { date: { from, to }, operation_type: [] },
          page: 1,
          page_size: 50,
        });
        if (fin?.sandbox) {
          setFinanceRows([]);
          setStatus(fin.message || "Тестовый режим.");
          return;
        }
        const ops = fin?.result?.operations || fin?.operations || extractRecords(fin);
        setFinanceRows(Array.isArray(ops) ? ops.slice(0, 80) : []);
        const acts = await mpCall("actions.list");
        const list = acts?.result || acts?.actions || extractRecords(acts);
        setActionRows(Array.isArray(list) ? list.slice(0, 80) : []);
        setStatus(`Финансы: ${(Array.isArray(ops) ? ops : []).length}, акций: ${(Array.isArray(list) ? list : []).length}`);
        return;
      }
      // WB: reportDetailByPeriod → нормализованный срез
      const payload = {
        dateFrom: daysAgoIso(30).slice(0, 10),
        dateTo: new Date().toISOString().slice(0, 10),
      };
      const salesData = await mpCall("analytics.sales", payload, payload);
      if (salesData?.sandbox) {
        setFinanceRows([]);
        setStatus(salesData.message || "Тестовый режим.");
        return;
      }
      const rows = Array.isArray(salesData) ? salesData : extractAnalyticsRecords(salesData);
      const agg = aggregateBuhRows(rows);
      setFinanceRows(
        (agg.by_day || []).map((d) => ({
          operation_date: d.date,
          operation_type: "WB period",
          amount: d.for_pay,
          operation_type_name: `шт ${d.qty}`,
        })),
      );
      setActionRows(
        (agg.by_brand || []).slice(0, 40).map((b) => ({
          id: b.brand,
          title: b.brand,
          name: `шт ${b.qty} · ${Number(b.for_pay).toLocaleString("ru-RU")} ₽`,
          date_start: "бренд",
          date_end: "",
        })),
      );
      setStatus(`WB финансы: к выплате ${agg.kpis.for_pay.toLocaleString("ru-RU")} ₽ за 30 дн.`);
    });
  }

  async function runSync() {
    await withBusy("sync", async () => {
      const res = await authFetch(`${base}/sync/`, { method: "POST", body: "{}" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Синхронизация не запущена.");
      await loadSettings({ syncForm: false });
      await loadHistory();
      setStatus(data.eager ? `Синк выполнен: ${JSON.stringify(data.result || {})}` : `Синк поставлен в очередь (${data.task_id || "ok"}).`);
    });
  }

  async function rotateWebhookSecret() {
    await withBusy("webhook", async () => {
      const res = await authFetch(`${base}/settings/`, {
        method: "PATCH",
        body: JSON.stringify({ rotate_webhook_secret: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Не удалось создать secret.");
      setSettings(data);
      setWebhookSecretOnce(data.webhook_secret || "");
      setStatus("Webhook secret создан — скопируйте сейчас, повторно не показывается.");
    });
  }

  function exportOrdersCsv() {
    downloadCsv(
      `marketplace-orders-${mp}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["number", "status", "date", "sku", "price", "title"],
      orderRows.map((r) => [r.number, r.status, r.date, r.sku, r.price, r.title || ""]),
    );
    setStatus(`Экспорт заказов: ${orderRows.length}`);
  }

  function exportReviewsCsv() {
    downloadCsv(
      `marketplace-reviews-${mp}-${new Date().toISOString().slice(0, 10)}.csv`,
      ["id", "rating", "product", "date", "text"],
      reviewRows.map((r) => [r.id, r.rating, r.product, r.date, r.text]),
    );
    setStatus(`Экспорт отзывов: ${reviewRows.length}`);
  }

  async function loadWarehouses() {
    await withBusy("wh", async () => {
      const payload = mp === "ozon" ? { limit: 100, cursor: "" } : {};
      const data = await mpCall("warehouses.list", payload);
      if (data?.sandbox) {
        setWarehouseOptions([]);
        setStatus(data.message || "Тестовый режим: склады не загружены.");
        return;
      }
      const result = data?.result && typeof data.result === "object" ? data.result : data;
      const rows = Array.isArray(data)
        ? data
        : result?.warehouses || result?.result || data?.warehouses || extractRecords(data);
      const options = (Array.isArray(rows) ? rows : [])
        .map((w) => ({
          id: String(w.warehouse_id || w.id || w.warehouseId || w.officeId || ""),
          name: String(w.name || w.title || w.warehouse_name || `Склад ${w.warehouse_id || w.id || ""}`).trim(),
          is_rfbs: Boolean(w.is_rfbs ?? w.isRFBS),
        }))
        .filter((w) => w.id);
      setWarehouseOptions(options);
      setLive(null);
      const stored = readStoredWarehouse(mp);
      const pick = options.find((o) => o.id === stored) || options[0];
      if (pick) selectWarehouse(pick.id);
      setStatus(options.length ? `Складов: ${options.length}` : "Склады не найдены. Проверьте ключи и боевой режим.");
    });
  }

  function normalizeSupplies(data) {
    const list = data?.supplies || extractRecords(data);
    return (Array.isArray(list) ? list : []).map((row, i) => ({
      key: String(row.id || i),
      id: String(row.id || ""),
      name: row.name || `Поставка ${row.id || i + 1}`,
      done: Boolean(row.done),
      closedAt: row.closedAt || row.closed_at || "",
      createdAt: row.createdAt || row.created_at || "",
      cargoType: row.cargoType ?? row.cargo_type,
      raw: row,
    }));
  }

  async function loadSupplies() {
    await withBusy("supplies", async () => {
      if (mp !== "wildberries") throw new Error("Поставки FBS — для Wildberries.");
      const data = await mpCall("supplies.list", { limit: 1000 });
      if (data?.sandbox) {
        setSupplyRows([]);
        setStatus(data.message || "Тестовый режим.");
        return;
      }
      const rows = normalizeSupplies(data);
      setSupplyRows(rows);
      setLive(null);
      if (!selectedSupplyId && rows[0]) setSelectedSupplyId(rows[0].id);
      setStatus(rows.length ? `Поставок WB: ${rows.length}` : "Открытых поставок нет — создайте новую.");
    });
  }

  async function createSupply() {
    await withBusy("supply-create", async () => {
      if (mp !== "wildberries") throw new Error("Поставки — для Wildberries.");
      const name = String(supplyName || "").trim() || `Поставка ${new Date().toLocaleString("ru-RU")}`;
      const data = await mpCall("supplies.create", { name });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      const id = String(data?.id || "");
      setSupplyName("");
      await loadSupplies();
      if (id) setSelectedSupplyId(id);
      setStatus(id ? `Поставка создана: ${id}` : "Поставка создана.");
    });
  }

  async function deliverSupply(id) {
    const supplyId = String(id || selectedSupplyId || "").trim();
    if (!supplyId) throw new Error("Выберите поставку.");
    if (!window.confirm(`Передать поставку ${supplyId} в доставку? После этого добавить заказы нельзя.`)) return;
    await withBusy("supply-deliver", async () => {
      const data = await mpCall("supplies.deliver", {}, { id: supplyId });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      await loadSupplies();
      setStatus(`Поставка ${supplyId} передана в доставку.`);
    });
  }

  async function deleteSupply(id) {
    const supplyId = String(id || "").trim();
    if (!supplyId) return;
    if (!window.confirm(`Удалить пустую поставку ${supplyId}?`)) return;
    await withBusy("supply-delete", async () => {
      const data = await mpCall("supplies.delete", {}, { id: supplyId });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      if (selectedSupplyId === supplyId) setSelectedSupplyId("");
      await loadSupplies();
      setStatus(`Поставка ${supplyId} удалена.`);
    });
  }

  async function addOrderToSupply(orderRow) {
    if (mp !== "wildberries") {
      setStatus("Добавление в поставку — для заказов Wildberries.");
      return;
    }
    const supplyId = String(selectedSupplyId || "").trim();
    if (!supplyId) {
      setStatus("Сначала выберите или создайте поставку во вкладке «Поставки».");
      return;
    }
    const orderId = orderRow?.id;
    if (orderId == null || orderId === "") throw new Error("Нет ID заказа.");
    if (!window.confirm(`Добавить заказ ${orderRow.number} в поставку ${supplyId}?`)) return;
    await withBusy("supply-add", async () => {
      const data = await mpCall("supplies.add_order", {}, { id: supplyId, orderId });
      if (data?.sandbox) throw new Error(data.message || "Тестовый режим.");
      setStatus(`Заказ ${orderRow.number} добавлен в поставку ${supplyId}.`);
      await loadOrders();
    });
  }

  async function loadAnalytics() {
    await withBusy("analytics", async () => {
      let salesData;
      let stocksData = null;
      if (mp === "wildberries") {
        const payload = { dateFrom: daysAgoIso(30).slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) };
        salesData = await mpCall("analytics.sales", payload, payload);
        try {
          stocksData = await mpCall("analytics.stocks", { dateFrom: daysAgoIso(1).slice(0, 10) }, { dateFrom: daysAgoIso(1).slice(0, 10) });
        } catch {
          stocksData = null;
        }
      } else {
        salesData = await mpCall("analytics.data", {
          date_from: daysAgoIso(30).slice(0, 10),
          date_to: new Date().toISOString().slice(0, 10),
          metrics: ["revenue", "ordered_units"],
          dimension: ["sku"],
          limit: 50,
          offset: 0,
        });
        try {
          stocksData = await mpCall("analytics.stocks", {
            limit: 100,
            offset: 0,
            warehouse_type: "ALL",
          });
        } catch {
          stocksData = null;
        }
      }
      const charts = parseAnalyticsCharts(salesData, mp);
      charts.stocks = parseStocksChart(stocksData, mp);
      setAnalyticsCharts(charts);
      showLive(salesData);
      setStatus(
        charts.sales.length || charts.stocks.length
          ? `Аналитика: SKU ${charts.sales.length}, складов ${charts.stocks.length}.`
          : "Данных аналитики мало — проверьте боевой режим и период.",
      );
    });
  }

  async function loadQuestions() {
    await withBusy("questions", async () => {
      if (mp !== "wildberries") throw new Error("Вопросы покупателей — для Wildberries.");
      const unanswered = reviewsUnansweredOnly;
      const data = await mpCall(
        "questions.list",
        { isAnswered: !unanswered, take: 50, skip: 0 },
        { isAnswered: !unanswered, take: 50, skip: 0 },
      );
      if (data?.sandbox) {
        setQuestionRows([]);
        setStatus(data.message || "Тестовый режим.");
        return;
      }
      let rows = normalizeQuestions(data);
      if (unanswered) rows = rows.filter((r) => !r.answered);
      setQuestionRows(rows);
      setLive(null);
      setStatus(rows.length ? `Вопросов WB: ${rows.length}${unanswered ? " (без ответа)" : ""}` : "Вопросов нет.");
    });
  }

  async function saveReplyTemplate(e) {
    e.preventDefault();
    await withBusy("reply-tpl", async () => {
      const res = await authFetch(`${base}/reply-templates/`, {
        method: "POST",
        body: JSON.stringify({
          ...replyTemplateForm,
          marketplace: mp === "wildberries" ? "wildberries" : "ozon",
        }),
      });
      if (!res.ok) throw new Error(await readError(res));
      setReplyTemplateForm({ name: "", kind: "review", body: "" });
      await loadReplyTemplates();
      setStatus("Шаблон ответа сохранён.");
    });
  }

  async function deleteReplyTemplate(id) {
    await authFetch(`${base}/reply-templates/${id}/`, { method: "DELETE" });
    await loadReplyTemplates();
  }

  async function loadCategories() {
    setLive(null);
    await loadCategoryOptions();
    setStatus(
      mp === "wildberries"
        ? "Категории WB загружены — выберите предмет в «Создать товар»."
        : "Категории Ozon загружены — выберите категорию в «Создать товар».",
    );
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
    setMenuOpen(false);
    setStatus(`Подставлен шаблон «${t.name}».`);
  }

  const envLabel = settings?.environment === "prod" ? "Боевой режим" : "Тестовый режим";
  const isSandbox = settings?.environment !== "prod";
  const filteredHistory = useMemo(
    () =>
      history.filter((h) => {
        if (!search) return true;
        const q = search.toLowerCase();
        const ids = marketplaceIdsFromRow(h);
        return (
          String(h.offer_id || "").toLowerCase().includes(q) ||
          String(h.product?.name || "").toLowerCase().includes(q) ||
          String(ids.vendorCode || "").toLowerCase().includes(q) ||
          String(ids.nmId || "").includes(q) ||
          String(ids.productId || "").includes(q)
        );
      }),
    [history, search],
  );
  const tabLabel = TABS.find(([id]) => id === tab)?.[1] || "";
  const hasMpKeys = Boolean(settings?.has_ozon_api_key || settings?.has_wb_api_key);
  const showOnboard =
    isBeginner &&
    Boolean(settings) &&
    !onboardDismissed &&
    canViewKeys &&
    (!hasMpKeys || (canManageCatalog && history.length === 0));
  const visibleTabs = useMemo(
    () =>
      TABS.filter(([id]) => {
        if (isBeginner && !BEGINNER_TAB_IDS.has(id)) return false;
        if (["create", "products", "analytics"].includes(id)) return canManageCatalog;
        if (id === "manage") return canViewKeys || canManageCatalog;
        if (["today", "orders", "supplies", "reviews", "finance"].includes(id)) return canManageOrders || canManageCatalog;
        if (id === "logs") return canViewKeys || canManageCatalog || canManageOrders;
        return true;
      }),
    [canManageCatalog, canManageOrders, canViewKeys, isBeginner],
  );

  useEffect(() => {
    if (!visibleTabs.some(([id]) => id === tab) && visibleTabs.length) {
      setTab(visibleTabs[0][0]);
    }
  }, [visibleTabs, tab]);

  useEffect(() => {
    if (!settings || onboardDismissed) return;
    if (hasMpKeys && history.length > 0) {
      writeOnboardDone();
      setOnboardDismissed(true);
    } else if (!hasMpKeys) {
      setOnboardStep(1);
    } else if (history.length === 0) {
      setOnboardStep((s) => Math.max(s, 2));
    }
  }, [settings, hasMpKeys, history.length, onboardDismissed]);

  function switchUiMode(mode) {
    setUiMode(mode);
    writeMpUiMode(mode);
    setMenuOpen(false);
    if (mode === "beginner" && tab !== "today" && BEGINNER_TAB_IDS.has("today") && canManageOrders) {
      setTab("today");
    }
  }

  function finishOnboard() {
    writeOnboardDone();
    setOnboardDismissed(true);
    setTab(canManageCatalog ? "create" : canManageOrders ? "today" : "manage");
  }
  const ozonCategoryValue = product.category && product.type ? `${product.category}:${product.type}` : "";
  const categoriesReady = mp === "wildberries" ? wbParents.length > 0 : ozonCategoryTree.length > 0;
  const requiredAttributeCount = attributeFields.filter((f) => f.required).length;
  const requiredAttrs = useMemo(() => attributeFields.filter((f) => f.required), [attributeFields]);
  const optionalAttrs = useMemo(() => attributeFields.filter((f) => !f.required), [attributeFields]);
  const visibility = useMemo(() => buildVisibilityChecklist(product, mp, attributeFields), [product, mp, attributeFields]);
  const mediaLimits = mediaLimitsFor(mp);
  const mediaCounts = countMediaItems(product.images);
  const alertCount = alerts
    ? (alerts.counts?.low_stock || 0) + (alerts.counts?.failed_imports || 0) + (alerts.counts?.log_errors || 0)
    : 0;
  const filteredReplyTemplates = useMemo(
    () =>
      replyTemplates.filter(
        (t) =>
          (t.marketplace === "any" || t.marketplace === mp || (mp === "wildberries" ? t.marketplace === "wildberries" : t.marketplace === "ozon")) &&
          (!replyDraft.open || t.kind === replyDraft.kind),
      ),
    [replyTemplates, mp, replyDraft.open, replyDraft.kind],
  );

  return (
    <section
      className={`card full-width cafe-provider mp-workspace ${mp === "wildberries" ? "mp-wb" : "mp-ozon"} ${isBeginner ? "mp-ui-beginner" : "mp-ui-advanced"}`}
    >
      <div className="mp-head">
        <div className="mp-head-title">
          <h2>Маркетплейсы</h2>
          <p className="muted">{envLabel} · {mp === "wildberries" ? "Wildberries" : "Ozon"}</p>
        </div>
        <div className="mp-toggle" role="group" aria-label="Площадка">
          <button type="button" className={mp === "ozon" ? "is-active" : ""} onClick={() => setMp("ozon")}>
            Ozon
          </button>
          <button type="button" className={mp === "wildberries" ? "is-active" : ""} onClick={() => setMp("wildberries")}>
            WB
          </button>
        </div>
        <div className="mp-ui-mode" role="group" aria-label="Режим интерфейса">
          <button type="button" className={isBeginner ? "is-active" : ""} onClick={() => switchUiMode("beginner")}>
            Простой
          </button>
          <button type="button" className={!isBeginner ? "is-active" : ""} onClick={() => switchUiMode("advanced")}>
            Все функции
          </button>
        </div>
        <div className="mp-menu">
          <button type="button" className="mp-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            Меню
          </button>
          {menuOpen ? (
            <div className="mp-menu-drop">
              {visibleTabs.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={tab === id ? "is-active" : ""}
                  onClick={() => {
                    setTab(id);
                    setMenuOpen(false);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showOnboard ? (
        <div className="mp-onboard" role="region" aria-label="Онбординг">
          <div className="mp-onboard-head">
            <div>
              <strong>Старт за 3 шага</strong>
              <p className="muted small">Ключи → фото → первая карточка. Потом откроется дневной путь «Сегодня».</p>
            </div>
            <button type="button" className="ghost-btn" onClick={finishOnboard}>
              Пропустить
            </button>
          </div>
          <div className="mp-onboard-steps" role="tablist">
            {[
              { n: 1, label: "Ключи" },
              { n: 2, label: "Фото" },
              { n: 3, label: "Карточка" },
            ].map((s) => (
              <button
                key={s.n}
                type="button"
                role="tab"
                aria-selected={onboardStep === s.n}
                className={`mp-onboard-step${onboardStep === s.n ? " is-on" : ""}${onboardStep > s.n ? " is-done" : ""}`}
                onClick={() => setOnboardStep(s.n)}
              >
                <span>{s.n}</span>
                {s.label}
              </button>
            ))}
          </div>

          {onboardStep === 1 ? (
            <form
              className="cafe-form-panel mp-onboard-panel"
              onSubmit={async (e) => {
                e.preventDefault();
                await saveKeys(e);
                setOnboardStep(2);
              }}
            >
              <h3>1. Ключи площадки</h3>
              <p className="muted small">Вставьте ключ Ozon и/или WB. Для реальных выгрузок выберите «Боевой».</p>
              <div className="cafe-form-grid">
                <label>
                  Режим
                  <select value={keysForm.environment} onChange={(e) => updateKeysForm({ environment: e.target.value })}>
                    <option value="sandbox">Тестовый</option>
                    <option value="prod">Боевой</option>
                  </select>
                </label>
                <label>
                  Ozon Client ID
                  <input value={keysForm.ozon_client_id} onChange={(e) => updateKeysForm({ ozon_client_id: e.target.value })} />
                </label>
                <label>
                  Ozon API Key
                  <input type="password" autoComplete="off" value={keysForm.ozon_api_key} onChange={(e) => updateKeysForm({ ozon_api_key: e.target.value })} />
                </label>
                <label>
                  Wildberries API Key
                  <input type="password" autoComplete="off" value={keysForm.wb_api_key} onChange={(e) => updateKeysForm({ wb_api_key: e.target.value })} />
                </label>
              </div>
              <div className="mp-actions">
                <button type="submit" disabled={busy === "keys"}>
                  {busy === "keys" ? "Сохранение…" : "Сохранить и дальше"}
                </button>
              </div>
            </form>
          ) : null}

          {onboardStep === 2 ? (
            <div className="cafe-form-panel mp-onboard-panel">
              <h3>2. Фото для карточки</h3>
              <p className="muted small">
                Загрузите хотя бы одно фото. Удобнее — через Яндекс Диск (публичные ссылки в карточку).
              </p>
              <div className="mp-actions">
                {settings?.has_yandex_disk ? (
                  <span className="muted small">Яндекс Диск подключён ✓</span>
                ) : (
                  <button type="button" disabled={busy === "disk" || !settings?.yandex_disk_oauth} onClick={connectYandexDisk}>
                    {busy === "disk" ? "Подключение…" : "Подключить Яндекс Диск"}
                  </button>
                )}
              </div>
              <div className="mp-media">
                <label className="mp-plus-btn">
                  + Фото
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                      const files = [...(e.target.files || [])];
                      e.target.value = "";
                      if (files.length) uploadMedia(files);
                    }}
                  />
                </label>
                {(product.images || []).length ? (
                  <ul className="mp-media-list">
                    {(product.images || []).slice(0, 8).map((item, idx) => {
                      const src = typeof item === "string" ? item : item.previewUrl || item.url;
                      return (
                        <li key={idx}>
                          <img src={src} alt="" />
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">Пока нет фото — нажмите «+ Фото».</p>
                )}
              </div>
              <div className="mp-actions">
                <button type="button" className="ghost-btn" onClick={() => setOnboardStep(1)}>
                  Назад
                </button>
                <button
                  type="button"
                  className="mp-btn mp-btn-primary"
                  onClick={() => {
                    setOnboardStep(3);
                    setTab("create");
                  }}
                >
                  Дальше к карточке
                </button>
              </div>
            </div>
          ) : null}

          {onboardStep === 3 ? (
            <div className="cafe-form-panel mp-onboard-panel">
              <h3>3. Первая карточка</h3>
              <p className="muted small">
                Ниже откройте форму: артикул, название, категория, цена, фото → «Выгрузить». После первой выгрузки онбординг закроется.
              </p>
              <div className="mp-actions">
                <button type="button" className="ghost-btn" onClick={() => setOnboardStep(2)}>
                  Назад
                </button>
                <button
                  type="button"
                  className="mp-btn mp-btn-primary"
                  onClick={() => {
                    setTab("create");
                    if ((product.images || []).length > 0 || history.length > 0) finishOnboard();
                  }}
                >
                  Открыть форму создания
                </button>
                <button type="button" className="ghost-btn" onClick={finishOnboard}>
                  Готово
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isSandbox ? (
        <div className="mp-mode-banner" role="status">
          <div>
            <strong>Тестовый режим</strong>
            <p>Запросы на Ozon/WB не уходят. Чтобы выгружать товары и заказы — откройте Настройки и выберите «Боевой».</p>
          </div>
          <button
            type="button"
            className="mp-btn"
            onClick={() => {
              setTab("manage");
              setMenuOpen(false);
            }}
          >
            К управлению
          </button>
        </div>
      ) : null}

      {status ? <p className="status mp-status-line">{status}</p> : null}
      {alertCount > 0 ? (
        <div className="mp-alerts-banner" role="status">
          <div>
            <strong>Алерты ({alertCount})</strong>
            <p>
              {[
                alerts?.counts?.low_stock ? `низкий остаток: ${alerts.counts.low_stock}` : null,
                alerts?.counts?.failed_imports ? `failed-импорт: ${alerts.counts.failed_imports}` : null,
                alerts?.counts?.log_errors ? `ошибки в логах: ${alerts.counts.log_errors}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="mp-actions">
            <button type="button" className="mp-btn" onClick={() => { setTab("manage"); setMenuOpen(false); }}>
              К настройкам
            </button>
            <button type="button" className="ghost-btn" disabled={busy === "alerts"} onClick={() => withBusy("alerts", loadAlerts)}>
              Обновить
            </button>
          </div>
        </div>
      ) : null}
      <p className="mp-section-title">{tabLabel}</p>

      {tab === "create" && (
        <div className="mp-stack">
          <form className="cafe-form-panel" onSubmit={submitOne}>
            <h3>{editingHistoryId ? `Редактирование · ${product.offer_id || "—"}` : "Карточка товара"}</h3>
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
                <div className="mp-inline-field">
                  <input value={product.barcode} onChange={(e) => setProduct((p) => ({ ...p, barcode: e.target.value }))} />
                  <button type="button" className="ghost-btn" disabled={busy === "barcode"} onClick={generateBarcode} title={mp === "ozon" && !product.product_id ? "Локальный EAN-13 для новой карточки" : "Сгенерировать на площадке"}>
                    {busy === "barcode" ? "…" : "Сгенерировать"}
                  </button>
                </div>
              </label>
              <div className="cafe-form-span2 mp-category-block">
                <div className="mp-media-head">
                  <h3>Категория и характеристики</h3>
                  <button type="button" className="ghost-btn" disabled={busy === "cats"} onClick={loadCategoryOptions}>
                    {busy === "cats" ? "Загрузка…" : "Загрузить с площадки"}
                  </button>
                </div>
                {mp === "wildberries" ? (
                  <label>
                    Предмет (subjectID)
                    <MarketplaceCategoryPicker
                      marketplace="wildberries"
                      value={product.category}
                      parents={wbParents}
                      subjects={categoryOptions}
                      parentId={wbParentId}
                      onParentChange={loadWbSubjectsForParent}
                      subjectsLoading={wbSubjectsLoading}
                      onChange={onWbCategoryPick}
                      placeholder="Выберите предмет"
                      disabled={!categoriesReady}
                    />
                  </label>
                ) : (
                  <label>
                    Категория и тип
                    <MarketplaceCategoryPicker
                      marketplace="ozon"
                      tree={ozonCategoryTree}
                      value={ozonCategoryValue}
                      onChange={onOzonCategoryPick}
                      placeholder="Выберите категорию"
                      disabled={!categoriesReady}
                    />
                  </label>
                )}
                {!categoriesReady ? (
                  <p className="muted small">
                    Нажмите «Загрузить с площадки» в боевом режиме — подтянутся категории по уровням (без зависания).
                  </p>
                ) : null}
                {attributesHint ? <p className="muted small">{attributesHint}</p> : null}
                {attributeFields.length ? (
                  <>
                    <div className="mp-visibility-card">
                      <div className="mp-visibility-head">
                        <strong>Видимость карточки</strong>
                        <span className={`mp-visibility-score ${visibility.percent >= 80 ? "is-good" : visibility.percent >= 50 ? "is-mid" : "is-low"}`}>
                          {visibility.percent}%
                        </span>
                      </div>
                      <div className="mp-visibility-track" aria-hidden="true">
                        <div className="mp-visibility-fill" style={{ width: `${visibility.percent}%` }} />
                      </div>
                      <p className="muted small">Заполните пункты ниже — как рекомендации Ozon для поиска и конверсии.</p>
                      <ul className="mp-visibility-list">
                        {visibility.items.map((item) => (
                          <li key={item.id} className={item.done ? "is-done" : item.partial ? "is-partial" : ""}>
                            <span className="mp-visibility-mark">{item.done ? "✓" : item.partial ? "…" : "○"}</span>
                            <span>
                              <strong>{item.label}</strong>
                              <em>{item.hint}</em>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {requiredAttrs.length ? (
                      <>
                        <h4 className="mp-attrs-title">Обязательные характеристики</h4>
                        <div className="mp-attrs-grid">
                          {requiredAttrs.map((field) => {
                            const value = product.characteristics?.[field.id] || "";
                            const dictOptions = attributeDictOptions[field.id] || [];
                            const inputType = mp === "wildberries" ? wbCharcInputType(field.charcType) : "text";
                            return (
                              <label key={field.id} className="mp-attr-required">
                                {field.name} *
                                {field.unit ? ` (${field.unit})` : ""}
                                {field.dictionaryId && dictOptions.length ? (
                                  <SearchableSelect
                                    value={value}
                                    options={dictOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                                    onChange={(next) => setCharacteristic(field.id, next)}
                                    placeholder="Выберите значение"
                                    searchPlaceholder={`Поиск: ${field.name}`}
                                  />
                                ) : (
                                  <input
                                    type={inputType}
                                    value={value}
                                    onChange={(e) => setCharacteristic(field.id, e.target.value)}
                                    placeholder="Обязательно"
                                  />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                    {optionalAttrs.length ? (
                      <>
                        <h4 className="mp-attrs-title">Необязательные — повышают видимость</h4>
                        <div className="mp-attrs-grid">
                          {optionalAttrs.map((field) => {
                            const value = product.characteristics?.[field.id] || "";
                            const dictOptions = attributeDictOptions[field.id] || [];
                            const inputType = mp === "wildberries" ? wbCharcInputType(field.charcType) : "text";
                            return (
                              <label key={field.id}>
                                {field.name}
                                {field.unit ? ` (${field.unit})` : ""}
                                {field.dictionaryId && dictOptions.length ? (
                                  <SearchableSelect
                                    value={value}
                                    options={dictOptions.map((opt) => ({ value: opt.id, label: opt.label }))}
                                    onChange={(next) => setCharacteristic(field.id, next)}
                                    placeholder="Необязательно"
                                    searchPlaceholder={`Поиск: ${field.name}`}
                                  />
                                ) : (
                                  <input
                                    type={inputType}
                                    value={value}
                                    onChange={(e) => setCharacteristic(field.id, e.target.value)}
                                    placeholder="Необязательно"
                                  />
                                )}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    ) : null}
                  </>
                ) : null}
                {requiredAttributeCount ? (
                  <p className="muted small">Обязательных характеристик: {requiredAttributeCount}</p>
                ) : null}
                <div className="cafe-form-grid">
                  <label>
                    Категория (id вручную)
                    <input value={product.category} onChange={(e) => setProduct((p) => ({ ...p, category: e.target.value }))} />
                  </label>
                  {mp === "ozon" ? (
                    <label>
                      Тип (id вручную)
                      <input value={product.type} onChange={(e) => setProduct((p) => ({ ...p, type: e.target.value }))} />
                    </label>
                  ) : null}
                </div>
              </div>
              <label className="cafe-form-span2">
                Описание
                <textarea rows={4} value={product.description} onChange={(e) => setProduct((p) => ({ ...p, description: e.target.value }))} />
              </label>
              <div className="cafe-form-span2 mp-media">
                <div className="mp-media-head">
                  <h3>Медиа</h3>
                  <label className="mp-plus-btn" title="Загрузить фото (можно несколько)">
                    <PlusIcon />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      hidden
                      onChange={(e) => {
                        uploadMedia(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                <p className="muted small">
                  Фото: {mediaCounts.photos} / {mediaLimits.photos}
                  {mediaLimits.videos ? ` · Видео: ${mediaCounts.videos} / ${mediaLimits.videos}` : ""}
                  {mp === "ozon"
                    ? " · На Ozon видео уходит в карточку отдельным блоком."
                    : " · На WB видео в API карточки не отправляется — только превью здесь."}
                </p>
                {(product.images || []).length ? (
                  <ul className="mp-media-list">
                    {(product.images || []).map((item) => {
                      const url = item.url || item;
                      const src = mediaSrc(item);
                      const name = item.name || url;
                      const isVideo = isVideoMediaItem(item) || /\.webm($|\?)/i.test(src);
                      return (
                        <li key={url}>
                          {isVideo ? (
                            <video src={src} muted playsInline preload="metadata" onClick={() => setViewer({ url: src, name, isVideo: true })} />
                          ) : (
                            <img src={src} alt="" onClick={() => setViewer({ url: src, name, isVideo: false })} />
                          )}
                          <span title={name}>{name}</span>
                          <button type="button" className="mp-trash-btn" title="Убрать" aria-label="Убрать" onClick={() => removeImage(url)}>
                            <TrashIcon />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="muted small">Файлы ещё не загружены. Нажмите плюс, чтобы добавить фото.</p>
                )}
              </div>
            </div>
            <div className="mp-actions">
              <button type="button" className="ghost-btn" disabled={!settings?.ai_enabled || busy === "ai"} onClick={generateDescription}>
                {settings?.ai_enabled
                  ? busy === "ai"
                    ? `Сгенерировать ИИ описание${dots}`
                    : "Сгенерировать ИИ описание"
                  : "ИИ выключен"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                disabled={busy === "video" || (mp === "wildberries" && mediaCounts.videos >= mediaLimits.videos)}
                onClick={generateVideo}
                title={mp === "wildberries" ? "Превью в кабинете; на WB через cards/upload видео не уходит" : "Видео отправится на Ozon при выгрузке"}
              >
                {busy === "video"
                  ? `Сгенерировать видео карточки${dots}`
                  : mp === "ozon"
                    ? "Сгенерировать видео (Ozon)"
                    : "Сгенерировать превью-видео"}
              </button>
              <button type="submit" disabled={busy === "create"}>
                {busy === "create" ? "Выгрузка…" : editingHistoryId ? "Сохранить на площадке" : "Выгрузить"}
              </button>
              {!isBeginner ? (
                <>
                  <button type="button" className="mp-btn" disabled={!product.offer_id && !product.name} onClick={cloneProductToOtherMp}>
                    Клонировать на {mp === "ozon" ? "WB" : "Ozon"}
                  </button>
                  <button type="button" className="mp-btn" disabled={!product.name && !product.offer_id} onClick={saveCurrentAsTemplate}>
                    В шаблон
                  </button>
                </>
              ) : null}
              {editingHistoryId ? (
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setProduct(emptyProduct());
                    setEditingHistoryId(null);
                    setAttributeFields([]);
                    setAttributeMirrors([]);
                    setAttributeDictOptions({});
                    setAttributesHint("");
                  }}
                >
                  Отмена
                </button>
              ) : null}
            </div>
            {settings?.ai_enabled ? (
              <label className="field-label">
                Особенности для ИИ (через запятую)
                <input value={aiFeatures} onChange={(e) => setAiFeatures(e.target.value)} />
              </label>
            ) : null}
          </form>

          {!isBeginner ? (
          <div className="cafe-form-panel mp-panel mp-advanced-only">
            <div className="mp-media-head">
              <h3>Пакетная выгрузка</h3>
              <button type="button" className="mp-plus-btn" title="Добавить строку" onClick={() => setBatch((rows) => [...rows, emptyProduct()])}>
                <PlusIcon />
              </button>
            </div>
            <p className="muted small">Несколько артикулов сразу — без полного заполнения карточки.</p>
            {batch.map((row, i) => (
              <div key={i} className="mp-batch-row">
                <input placeholder="Артикул" value={row.offer_id} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, offer_id: e.target.value } : r)))} />
                <input placeholder="Название" value={row.name} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} />
                <input placeholder="Цена" value={row.price} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, price: e.target.value } : r)))} />
              </div>
            ))}
            <div className="mp-actions">
              <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "batch"} onClick={submitBatch}>
                Выгрузить пакет
              </button>
            </div>

            <div className="mp-csv-block">
              <h3>Импорт из CSV</h3>
              <p className="muted small">Колонки: offer_id, name, brand, price, stock, description (разделитель ; или ,).</p>
              <textarea
                className="mp-csv-area"
                rows={7}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={"offer_id,name,brand,price,stock,description\nSKU-1,Товар,Бренд,1290,10,Описание"}
              />
              <div className="mp-actions">
                <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "csv"} onClick={submitCsv}>
                  Выгрузить CSV
                </button>
                <button type="button" className="mp-btn" disabled={!filteredHistory.length} onClick={exportHistoryCsv}>
                  Скачать историю
                </button>
              </div>
            </div>

            <div className="mp-templates-block">
              <h4>Шаблоны</h4>
              <p className="muted small">
                Шаблон подставляет бренд, цену, остаток и описание в форму слева. Артикул, категорию и фото
                добавьте сами. Новые шаблоны — в «Управление» или кнопкой «В шаблон» у формы создания.
              </p>
              {templates.length ? (
                <div className="mp-templates">
                  {templates.map((t) => (
                    <button key={t.id} type="button" className="mp-btn" onClick={() => applyTemplate(t)}>
                      {t.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted small">Пока нет шаблонов.</p>
              )}
            </div>
          </div>
          ) : (
            <p className="muted small mp-beginner-hint">
              Пакетная выгрузка, CSV и шаблоны — в режиме «Все функции».
            </p>
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="cafe-form-panel mp-panel mp-products-panel">
          <div className="mp-toolbar">
            <input
              className="mp-toolbar-search"
              placeholder="Поиск: артикул, vendorCode, nmID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="mp-toolbar-actions">
              <button type="button" className="mp-btn" onClick={loadHistory}>
                Обновить
              </button>
              <button type="button" className="mp-btn" disabled={busy === "catalog-sync"} onClick={syncCatalogFromMarketplace}>
                {busy === "catalog-sync" ? "Тянем…" : "Подтянуть с площадки"}
              </button>
              <button type="button" className="mp-btn" disabled={!filteredHistory.length} onClick={exportHistoryCsv}>
                CSV
              </button>
              <button type="button" className="mp-btn" disabled={busy === "export"} onClick={() => exportHistoryServer("xlsx")}>
                Excel
              </button>
              <button type="button" className="mp-btn" disabled={busy === "live-products"} onClick={loadLiveProducts}>
                Список API
              </button>
              <button
                type="button"
                className="mp-btn mp-btn-primary"
                disabled={busy === "fetch-product" || !search.trim()}
                onClick={() => fetchProductForEdit(search.trim())}
              >
                Открыть по артикулу
              </button>
            </div>
          </div>
          <div className="mp-table-wrap">
            <table className="mp-table mp-table-products">
              <thead>
                <tr>
                  <th>Артикул</th>
                  <th>Код</th>
                  {mp === "wildberries" ? <th>nmID</th> : <th>product_id</th>}
                  <th>Название</th>
                  <th>Цена</th>
                  <th>Ост.</th>
                  <th>Статус</th>
                  {mp === "ozon" ? <th>Импорт</th> : null}
                  <th className="mp-col-menu" />
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((row) => {
                  const ids = marketplaceIdsFromRow(row);
                  const menuOpenRow = rowMenuId === row.id;
                  return (
                    <tr key={row.id}>
                      <td>{row.offer_id}</td>
                      <td>{formatMarketplaceId(ids.vendorCode)}</td>
                      <td>{formatMarketplaceId(mp === "wildberries" ? ids.nmId : ids.productId)}</td>
                      <td className="mp-cell-name" title={row.product?.name || ""}>
                        {row.product?.name || "—"}
                      </td>
                      <td>{row.product?.price || "—"}</td>
                      <td>{row.product?.stock ?? "—"}</td>
                      <td>
                        <span className={`mp-pill mp-pill--${String(row.status || "").slice(0, 12)}`}>{row.status}</span>
                      </td>
                      {mp === "ozon" ? (
                        <td>
                          {importStatusLabel(row)}
                          {row.import_errors ? (
                            <span className="muted small" title={row.import_errors}>
                              {" "}
                              ⚠
                            </span>
                          ) : null}
                        </td>
                      ) : null}
                      <td className="mp-col-menu">
                        <div className="mp-kebab">
                          <button
                            type="button"
                            className="mp-kebab-btn"
                            aria-label="Действия"
                            aria-expanded={menuOpenRow}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (menuOpenRow) {
                                setRowMenuId(null);
                                setRowMenuPos(null);
                                return;
                              }
                              const rect = e.currentTarget.getBoundingClientRect();
                              const menuH = 200;
                              const openUp = rect.bottom + menuH > window.innerHeight - 8;
                              setRowMenuPos({
                                top: openUp ? Math.max(8, rect.top - menuH) : rect.bottom + 4,
                                right: Math.max(8, window.innerWidth - rect.right),
                              });
                              setRowMenuId(row.id);
                            }}
                          >
                            ⋮
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filteredHistory.length ? (
              <p className="muted">Пока нет выгрузок. Создайте карточку или нажмите «Подтянуть с площадки».</p>
            ) : null}
          </div>
          {rowMenuId && rowMenuPos
            ? createPortal(
                <div
                  className="mp-kebab-menu mp-kebab-menu-fixed"
                  role="menu"
                  style={{ top: rowMenuPos.top, right: rowMenuPos.right }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {(() => {
                    const row = filteredHistory.find((h) => h.id === rowMenuId) || history.find((h) => h.id === rowMenuId);
                    if (!row) return null;
                    return (
                      <>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setRowMenuId(null);
                            setRowMenuPos(null);
                            openEditorFromHistory(row);
                          }}
                        >
                          Редактировать
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setRowMenuId(null);
                            setRowMenuPos(null);
                            fillPriceStockFromHistory(row);
                          }}
                        >
                          Цены и остатки
                        </button>
                        {mp === "ozon" && row.import_task_id ? (
                          <button
                            type="button"
                            role="menuitem"
                            disabled={busy === "import-status"}
                            onClick={() => {
                              setRowMenuId(null);
                              setRowMenuPos(null);
                              checkImportStatus(row);
                            }}
                          >
                            Статус импорта
                          </button>
                        ) : null}
                        <button
                          type="button"
                          role="menuitem"
                          className="mp-kebab-danger"
                          onClick={() => {
                            setRowMenuId(null);
                            setRowMenuPos(null);
                            deleteProduct(row);
                          }}
                        >
                          Удалить на площадке
                        </button>
                      </>
                    );
                  })()}
                </div>,
                document.body,
              )
            : null}
        </div>
      )}

      {tab === "manage" && (
        <div className="mp-stack">
          <div className="cafe-form-panel">
            <h3>Что нужно для функций</h3>
            <ul className="mp-need-list">
              <li>
                <strong>Ozon / WB:</strong> ключи ниже. Реальные запросы — только в режиме «Боевой».
              </li>
              <li>
                <strong>ИИ-описание:</strong> {settings?.ai_enabled ? `включено (${settings.ai_model || "OpenRouter"}).` : "выключено. На сервере задайте OPENROUTER_API_KEY."}
              </li>
              <li>
                <strong>Яндекс Диск:</strong>{" "}
                {settings?.has_yandex_disk
                  ? "подключён — в карточку уходят публичные URL с Диска."
                  : settings?.yandex_disk_oauth
                    ? "нажмите «Подключить Яндекс Диск»."
                    : "на сервере не заданы YANDEX_OAUTH_CLIENT_ID/SECRET."}
              </li>
              <li>
                <strong>Видео карточки:</strong> собирается в браузере из фото. На Ozon уходит в карточку; на WB — только превью в кабинете (API cards/upload видео не принимает).
              </li>
            </ul>
          </div>
          {canViewKeys ? (
          <form className="cafe-form-panel" onSubmit={saveKeys}>
            <h3>Ключи площадок</h3>
            <p className="muted small">Не хранятся в платформенном .env — только у этой организации.</p>
            <div className="cafe-form-grid">
              <label>
                Режим работы
                <select value={keysForm.environment} onChange={(e) => updateKeysForm({ environment: e.target.value })}>
                  <option value="sandbox">Тестовый — запросы на площадку не уходят</option>
                  <option value="prod">Боевой — реальные выгрузки, заказы, цены</option>
                </select>
              </label>
              <label>
                Ozon Client ID
                <input value={keysForm.ozon_client_id} onChange={(e) => updateKeysForm({ ozon_client_id: e.target.value })} />
              </label>
              <label>
                Ozon API Key
                <input type="password" autoComplete="off" value={keysForm.ozon_api_key} onChange={(e) => updateKeysForm({ ozon_api_key: e.target.value })} />
              </label>
              <label>
                Wildberries API Key
                <input type="password" autoComplete="off" value={keysForm.wb_api_key} onChange={(e) => updateKeysForm({ wb_api_key: e.target.value })} />
              </label>
              <div className="cafe-form-span2 mp-disk-row">
                <span>Яндекс Диск</span>
                <div className="mp-actions">
                  {settings?.has_yandex_disk ? (
                    <button type="button" className="ghost-btn" disabled={busy === "disk"} onClick={disconnectYandexDisk}>
                      Отключить Диск
                    </button>
                  ) : (
                    <button type="button" disabled={busy === "disk" || !settings?.yandex_disk_oauth} onClick={connectYandexDisk}>
                      {busy === "disk" ? "Подключение…" : "Подключить Яндекс Диск"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button type="submit" disabled={busy === "keys"}>
              Сохранить ключи
            </button>
          </form>
          ) : (
            <div className="cafe-form-panel">
              <p className="muted">Ключи площадок скрыты — нет права «видеть/менять ключи». Настраивает руководитель в «Сотрудники».</p>
            </div>
          )}

          {!isBeginner ? (
          <>
          <div className="cafe-form-panel">
            <h3>Контроль цены и алерты</h3>
            <p className="muted small">
              При выгрузке цен задаём нижний порог и (для Ozon) запрет автоакций. Настройки сохраняются вместе с ключами.
            </p>
            <div className="mp-price-control">
              <label className="mp-switch-row">
                <span className="mp-switch-text">
                  <strong>Защитить цену от автоскидок и акций</strong>
                  <em>Площадка не опустит цену ниже вашего минимума при автоакциях</em>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(keysForm.price_protect_enabled)}
                  onChange={(e) => updateKeysForm({ price_protect_enabled: e.target.checked })}
                />
              </label>
              <label className="mp-switch-row">
                <span className="mp-switch-text">
                  <strong>Ozon: не включать в автоакции при смене цены</strong>
                  <em>В API уходит auto_action_enabled = DISABLED</em>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(keysForm.ozon_disable_auto_actions)}
                  onChange={(e) => updateKeysForm({ ozon_disable_auto_actions: e.target.checked })}
                />
              </label>
              <div className="cafe-form-grid">
                <label>
                  Макс. снижение цены, %
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={keysForm.price_min_floor_percent}
                    onChange={(e) => updateKeysForm({ price_min_floor_percent: e.target.value })}
                    disabled={!keysForm.price_protect_enabled}
                  />
                  <span className="muted small">
                    Пример: цена 1000 ₽ и 10% → минимум 900 ₽. Ниже Ozon не опустит через акции.
                  </span>
                </label>
                <label>
                  Порог низкого остатка, шт.
                  <input
                    type="number"
                    min={0}
                    value={keysForm.low_stock_threshold}
                    onChange={(e) => updateKeysForm({ low_stock_threshold: e.target.value })}
                  />
                  <span className="muted small">Алерт, если в истории остаток ≤ этого числа.</span>
                </label>
              </div>
            </div>
            <button type="button" className="mp-btn" disabled={busy === "keys"} onClick={saveKeys}>
              Сохранить контроль цены
            </button>
            {alerts ? (
              <div className="mp-alerts-detail">
                <h4>Сейчас</h4>
                <ul className="mp-need-list">
                  <li>
                    Низкий остаток (≤ {alerts.low_stock_threshold}): {alerts.counts?.low_stock || 0}
                    {alerts.low_stock?.slice(0, 5).map((x) => (
                      <span key={x.id} className="muted small">
                        {" "}
                        · {x.offer_id} ({x.stock})
                      </span>
                    ))}
                    {(alerts.counts?.low_stock || 0) > 0 ? (
                      <p className="muted small">Что делать: пополните остаток во вкладке Управление → цены/остатки или на складе площадки.</p>
                    ) : null}
                  </li>
                  <li>
                    Failed-импорт: {alerts.counts?.failed_imports || 0}
                    {alerts.failed_imports?.slice(0, 3).map((x) => (
                      <span key={x.id} className="muted small">
                        {" "}
                        · {x.offer_id}
                      </span>
                    ))}
                    {(alerts.counts?.failed_imports || 0) > 0 ? (
                      <p className="muted small">
                        Что делать: откройте товар в «Товарах» → статус импорта / ошибка, исправьте атрибуты или фото и выгрузите снова.
                      </p>
                    ) : null}
                  </li>
                  <li>
                    Ошибки в логах: {alerts.counts?.log_errors || 0}
                    {(alerts.log_errors || []).slice(0, 3).map((x) => (
                      <div key={x.id} className="mp-alert-log-hint">
                        <code>{x.status_code || "—"}</code> {x.hint || x.error}
                      </div>
                    ))}
                    {(alerts.counts?.log_errors || 0) > 0 ? (
                      <p className="muted small">
                        Только актуальные сбои: если запрос уже прошёл успешно, алерт пропадёт после «Обновить».
                        История остаётся во вкладке «Логи». При 401/403 проверьте ключи в Управлении.
                      </p>
                    ) : null}
                  </li>
                </ul>
                <div className="mp-actions">
                  <button type="button" className="ghost-btn" onClick={() => withBusy("alerts", loadAlerts)}>
                    Обновить алерты
                  </button>
                  <button
                    type="button"
                    className="mp-btn"
                    onClick={() => {
                      setTab("logs");
                      setMenuOpen(false);
                    }}
                  >
                    Открыть логи
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {canViewKeys ? (
            <div className="cafe-form-panel">
              <h3>Уведомления Telegram / push</h3>
              <p className="muted small">
                Telegram: тот же чат организации, что в разделе «Организация → Уведомления и мессенджеры»
                {settings?.telegram_ready
                  ? " (подключён)."
                  : " (пока не подключён — откройте Организацию, включите Telegram и привяжите чат)."}{" "}
                Push — на устройства с приложением.
              </p>
              <div className="mp-price-control">
                <label className="mp-switch-row">
                  <span className="mp-switch-text">
                    <strong>Telegram</strong>
                    <em>Сообщения в org-чат бота</em>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(keysForm.notify_telegram)}
                    onChange={(e) => updateKeysForm({ notify_telegram: e.target.checked })}
                  />
                </label>
                <label className="mp-switch-row">
                  <span className="mp-switch-text">
                    <strong>Push / in-app</strong>
                    <em>Владелец и сотрудники с правами маркетплейсов</em>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(keysForm.notify_push)}
                    onChange={(e) => updateKeysForm({ notify_push: e.target.checked })}
                  />
                </label>
                <label className="mp-switch-row">
                  <span className="mp-switch-text">
                    <strong>Новые заказы</strong>
                    <em>Опрос площадки раз в ~10 мин</em>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(keysForm.notify_on_new_orders)}
                    onChange={(e) => updateKeysForm({ notify_on_new_orders: e.target.checked })}
                  />
                </label>
                <label className="mp-switch-row">
                  <span className="mp-switch-text">
                    <strong>Ошибки синка</strong>
                    <em>Failed-импорт и сбои фоновых задач</em>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(keysForm.notify_on_sync_errors)}
                    onChange={(e) => updateKeysForm({ notify_on_sync_errors: e.target.checked })}
                  />
                </label>
              </div>
              <button type="button" className="mp-btn" disabled={busy === "keys"} onClick={saveKeys}>
                Сохранить уведомления
              </button>
            </div>
          ) : null}

          <div className="cafe-form-panel">
            <h3>Что сломалось за сутки</h3>
            <p className="muted small">Сводка failed-импортов и ошибок API за последние 24 часа. Фоновые задачи с retry и dedup-блокировкой.</p>
            <div className="mp-actions">
              <button type="button" className="mp-btn" disabled={busy === "ops"} onClick={loadOpsSummaryClick}>
                {busy === "ops" ? "Загрузка…" : "Обновить сводку"}
              </button>
            </div>
            {opsSummary ? (
              <ul className="mp-need-list">
                <li>Pending-импортов сейчас: {opsSummary.counts?.pending_imports || 0}</li>
                <li>Failed за {opsSummary.hours} ч: {opsSummary.counts?.failed_imports || 0}</li>
                <li>Ошибок в логах за {opsSummary.hours} ч: {opsSummary.counts?.log_errors || 0}</li>
                {(opsSummary.log_errors || []).slice(0, 5).map((x) => (
                  <li key={x.id} className="muted small">
                    <code>{x.status_code || "—"}</code> {x.hint || x.error}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted small">Нажмите «Обновить сводку».</p>
            )}
          </div>

          <div className="cafe-form-panel">
            <h3>Статусы выгрузки и внешний сигнал</h3>
            <div className="mp-help-cards">
              <div className="mp-help-card">
                <strong>Что делает «Синхронизировать»</strong>
                <p>
                  После выгрузки на Ozon карточка сначала в статусе «ожидает». Кнопка (и автозадача каждые 15 мин)
                  спрашивает у Ozon: уже готово или ошибка — и обновляет список в «Товарах».
                </p>
              </div>
              <div className="mp-help-card">
                <strong>Зачем webhook</strong>
                <p>
                  Это ссылка для вашего скрипта/сервиса: по секрету можно запустить ту же синхронизацию снаружи
                  (например из n8n или cron), без входа в кабинет.
                </p>
              </div>
            </div>
            <p className="muted small">
              {settings?.last_sync_at
                ? `Последний запуск: ${String(settings.last_sync_at).slice(0, 19).replace("T", " ")}.`
                : "Ещё не запускалась."}
            </p>
            <div className="mp-actions">
              <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "sync"} onClick={runSync}>
                {busy === "sync" ? "Обновляем…" : "Обновить статусы выгрузки"}
              </button>
              <button type="button" className="mp-btn" disabled={busy === "webhook"} onClick={rotateWebhookSecret}>
                {settings?.has_webhook_secret ? "Обновить секрет webhook" : "Создать секрет webhook"}
              </button>
            </div>
            {settings?.webhook_url ? (
              <p className="muted small">
                Адрес: <code>{settings.webhook_url}</code>
              </p>
            ) : null}
            {webhookSecretOnce ? (
              <p className="status">
                Секрет (покажите один раз, скопируйте): <code>{webhookSecretOnce}</code>
              </p>
            ) : null}
          </div>

          <div className="cafe-form-panel">
            <h3>Цены, остатки, склады</h3>
            <div className="cafe-form-grid">
              <label>
                Артикул (vendorCode)
                <input value={priceStock.offer_id} onChange={(e) => setPriceStock((p) => ({ ...p, offer_id: e.target.value }))} />
              </label>
              {mp === "wildberries" ? (
                <label>
                  nmID (для цен/удаления)
                  <input value={priceStock.nm_id} onChange={(e) => setPriceStock((p) => ({ ...p, nm_id: e.target.value }))} />
                </label>
              ) : null}
              <label>
                Цена
                <input value={priceStock.price} onChange={(e) => setPriceStock((p) => ({ ...p, price: e.target.value }))} />
              </label>
              <label>
                Остаток
                <input value={priceStock.stock} onChange={(e) => setPriceStock((p) => ({ ...p, stock: e.target.value }))} />
              </label>
              <label>
                Склад для остатков
                {warehouseOptions.length ? (
                  <select value={warehouseId} onChange={(e) => selectWarehouse(e.target.value)}>
                    <option value="">Выберите склад</option>
                    {warehouseOptions.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                        {w.is_rfbs ? " · rFBS" : ""} ({w.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={warehouseId}
                    onChange={(e) => selectWarehouse(e.target.value)}
                    placeholder="Нажмите «Загрузить склады»"
                  />
                )}
              </label>
            </div>
            <div className="mp-actions">
              <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "prices"} onClick={applyPricesStocks}>
                Обновить одну строку
              </button>
              <button type="button" className="mp-btn" disabled={busy === "wh"} onClick={loadWarehouses}>
                Загрузить склады
              </button>
              <button type="button" className="mp-btn" disabled={busy === "cats"} onClick={loadCategories}>
                Загрузить категории
              </button>
              {mp === "wildberries" ? (
                <button
                  type="button"
                  className="mp-btn"
                  onClick={() => {
                    setTab("supplies");
                    setMenuOpen(false);
                  }}
                >
                  К поставкам WB
                </button>
              ) : null}
            </div>

            <h4>Массовое обновление (таблица)</h4>
            <p className="muted small">
              Для остатков нужен ID склада. Можно подставить из истории или вставить CSV с колонками offer_id,price,stock
              {mp === "wildberries" ? ", nm_id" : ", product_id"}.
            </p>
            <div className="mp-table-wrap">
              <table className="mp-table mp-bulk-table">
                <thead>
                  <tr>
                    <th>Артикул</th>
                    {mp === "wildberries" ? <th>nmID</th> : <th>product_id</th>}
                    <th>Цена</th>
                    <th>Остаток</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>
                        <input
                          value={row.offer_id}
                          onChange={(e) =>
                            setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, offer_id: e.target.value } : r)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={mp === "wildberries" ? row.nm_id : row.product_id}
                          onChange={(e) =>
                            setBulkRows((rows) =>
                              rows.map((r, i) =>
                                i === idx
                                  ? mp === "wildberries"
                                    ? { ...r, nm_id: e.target.value }
                                    : { ...r, product_id: e.target.value }
                                  : r,
                              ),
                            )
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.price}
                          onChange={(e) =>
                            setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, price: e.target.value } : r)))
                          }
                        />
                      </td>
                      <td>
                        <input
                          value={row.stock}
                          onChange={(e) =>
                            setBulkRows((rows) => rows.map((r, i) => (i === idx ? { ...r, stock: e.target.value } : r)))
                          }
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => setBulkRows((rows) => rows.filter((_, i) => i !== idx))}
                          aria-label="Удалить строку"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mp-actions">
              <button type="button" className="ghost-btn" onClick={() => setBulkRows((rows) => [...rows, emptyBulkRow()])}>
                + Строка
              </button>
              <button type="button" className="ghost-btn" onClick={fillBulkFromHistory}>
                Из истории
              </button>
              <button type="button" disabled={busy === "bulk-prices"} onClick={applyBulkPricesStocks}>
                {busy === "bulk-prices" ? "Отправка…" : "Отправить все"}
              </button>
            </div>
            <div className="mp-csv-block">
              <h4>CSV</h4>
              <p className="muted small">Вставьте таблицу целиком. Колонки: offer_id, price, stock (или ;).</p>
              <textarea
                className="mp-csv-area"
                rows={5}
                value={bulkCsv}
                onChange={(e) => setBulkCsv(e.target.value)}
                placeholder={"offer_id,price,stock\nSKU-1,1290,10\nSKU-2,990,5"}
              />
              <button type="button" className="mp-btn" onClick={importBulkCsv}>
                Загрузить CSV в таблицу
              </button>
            </div>

            <div className="mp-templates-block">
              <h4>Шаблоны карточек</h4>
              <p className="muted small">
                Шаблон — заготовка бренда, цены, остатка и текста описания. Примените его в «Создать товар», затем
                допишите артикул, категорию и фото. Можно сохранить текущую карточку как шаблон кнопкой ниже формы
                создания.
              </p>
              <form onSubmit={saveTemplate}>
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
                <button type="submit" className="mp-btn mp-btn-primary">
                  Сохранить шаблон
                </button>
              </form>
              {templates.map((t) => (
                <div key={t.id} className="mp-tpl-row">
                  <span>
                    {t.name} · {t.marketplace}
                  </span>
                  <div className="mp-actions">
                    <button type="button" className="mp-btn" onClick={() => applyTemplate(t)}>
                      Применить
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => deleteTemplate(t.id)}>
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </>
          ) : (
            <div className="cafe-form-panel">
              <p className="muted small">
                Цены, остатки, вебхуки, шаблоны ответов и пакетные операции — в режиме «Все функции».
              </p>
              <button type="button" className="mp-btn" onClick={() => switchUiMode("advanced")}>
                Показать все функции
              </button>
            </div>
          )}
        </div>
      )}

      {(tab === "orders" || tab === "today") && (
        <div className="cafe-form-panel mp-panel">
          {tab === "today" ? (
            <div className="mp-today-intro">
              <h3>Дневной путь</h3>
              <ol className="mp-today-steps">
                {mp === "ozon" ? (
                  <>
                    <li>
                      <strong>Заказы</strong> — загрузите FBS-отправления
                    </li>
                    <li>
                      <strong>Сборка</strong> — «Собрать», затем через ~1 мин
                    </li>
                    <li>
                      <strong>Этикетки</strong> — печать PDF на отправление
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <strong>Поставка</strong> — создайте или выберите ниже
                    </li>
                    <li>
                      <strong>Заказы</strong> — «В поставку» по сборочным заданиям
                    </li>
                    <li>
                      <strong>Отгрузка</strong> — «В доставку» у поставки
                    </li>
                  </>
                )}
              </ol>
            </div>
          ) : null}
          {tab === "today" && mp === "wildberries" ? (
            <div className="mp-today-supplies">
              <h4>Поставки WB</h4>
              <div className="mp-warehouse-bar">
                <label>
                  Новая поставка
                  <input
                    value={supplyName}
                    onChange={(e) => setSupplyName(e.target.value)}
                    placeholder={`Поставка ${new Date().toLocaleDateString("ru-RU")}`}
                  />
                </label>
                <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "supply-create"} onClick={createSupply}>
                  {busy === "supply-create" ? "…" : "Создать"}
                </button>
                <button type="button" className="mp-btn" disabled={busy === "supplies"} onClick={loadSupplies}>
                  Обновить
                </button>
              </div>
              {supplyRows.filter((s) => !s.done).length ? (
                <ul className="mp-today-supply-list">
                  {supplyRows
                    .filter((s) => !s.done)
                    .slice(0, 6)
                    .map((row) => (
                      <li key={row.key}>
                        <button
                          type="button"
                          className={`mp-btn${selectedSupplyId === row.id ? " mp-btn-primary" : ""}`}
                          onClick={() => setSelectedSupplyId(row.id)}
                        >
                          {row.name || row.id}
                        </button>
                        <button type="button" className="mp-btn" disabled={busy === "supply-deliver"} onClick={() => deliverSupply(row.id)}>
                          В доставку
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="muted small">Открытых поставок нет — создайте первую.</p>
              )}
            </div>
          ) : null}
          <div className="mp-warehouse-bar">
            <label>
              Склад
              {warehouseOptions.length ? (
                <select value={warehouseId} onChange={(e) => selectWarehouse(e.target.value)}>
                  <option value="">Все / не выбран</option>
                  {warehouseOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id})
                    </option>
                  ))}
                </select>
              ) : (
                <input value={warehouseId} onChange={(e) => selectWarehouse(e.target.value)} placeholder="ID склада" />
              )}
            </label>
            <button type="button" className="mp-btn" disabled={busy === "wh"} onClick={loadWarehouses}>
              {busy === "wh" ? "…" : "Склады"}
            </button>
            {mp === "wildberries" ? (
              <label>
                Поставка для заказов
                <select value={selectedSupplyId} onChange={(e) => setSelectedSupplyId(e.target.value)}>
                  <option value="">Не выбрана</option>
                  {supplyRows
                    .filter((s) => !s.done)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.id})
                      </option>
                    ))}
                </select>
              </label>
            ) : null}
          </div>
          <div className="mp-actions">
            <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "orders"} onClick={loadOrders}>
              Загрузить заказы
            </button>
            {!isBeginner ? (
              <button type="button" className="mp-btn" disabled={!orderRows.length} onClick={exportOrdersCsv}>
                Экспорт CSV
              </button>
            ) : null}
            {mp === "wildberries" && !isBeginner ? (
              <button type="button" className="mp-btn" disabled={busy === "supplies"} onClick={loadSupplies}>
                Обновить поставки
              </button>
            ) : null}
          </div>
          {mp === "ozon" ? (
            <div className="mp-actions">
              <label className="mp-inline-filter">
                Статус FBS
                <select value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="">Все за 14 дней</option>
                  <option value="awaiting_packaging">Ожидает сборки</option>
                  <option value="awaiting_deliver">Ожидает отгрузки</option>
                  <option value="delivering">Доставляется</option>
                  <option value="delivered">Доставлен</option>
                  <option value="cancelled">Отменён</option>
                </select>
              </label>
              <button type="button" className="mp-btn" disabled={busy === "orders"} onClick={loadOrders}>
                Применить фильтр
              </button>
            </div>
          ) : null}
          <p className="muted small">
            {mp === "ozon"
              ? "FBS: «Собрать» → через ~1 мин «Этикетка». Склад фильтрует список отправлений."
              : "WB: выберите поставку и нажмите «В поставку», затем «В доставку» у поставки выше."}
          </p>
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Номер</th>
                  <th>Статус</th>
                  <th>Дата</th>
                  <th>Артикул / SKU</th>
                  <th>Цена</th>
                  {mp === "ozon" ? <th>Товары</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody>
                {orderRows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.number}</td>
                    <td>
                      <span className={`mp-status mp-status--${String(row.status || "").replace(/[^a-z0-9_-]/gi, "")}`}>
                        {row.status_label || row.status}
                      </span>
                    </td>
                    <td>{row.date ? String(row.date).slice(0, 19).replace("T", " ") : "—"}</td>
                    <td>{row.sku || "—"}</td>
                    <td>{row.price || "—"}</td>
                    {mp === "ozon" ? <td>{row.title || "—"}</td> : null}
                    <td className="mp-row-actions">
                      {mp === "ozon" ? (
                        <>
                          <button
                            type="button"
                            className="mp-btn"
                            disabled={busy === "order-ship" || row.status === "cancelled"}
                            onClick={() => shipOrder(row)}
                          >
                            Собрать
                          </button>
                          <button type="button" className="mp-btn" disabled={busy === "order-label"} onClick={() => printOrderLabel(row)}>
                            {busy === "order-label" ? "…" : "Этикетка"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="mp-btn"
                          disabled={busy === "supply-add" || !selectedSupplyId}
                          onClick={() => addOrderToSupply(row)}
                        >
                          В поставку
                        </button>
                      )}
                      <button
                        type="button"
                        className="ghost-btn"
                        disabled={busy === "order-chat"}
                        onClick={() => linkOrderToChat(row)}
                        title="Сохранить заказ в чат Вместе"
                      >
                        В чат
                      </button>
                      <button
                        type="button"
                        className="mp-btn"
                        disabled={busy === "order-cancel" || String(row.status).includes("cancel")}
                        onClick={() => cancelOrder(row)}
                      >
                        Отменить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orderRows.length ? <p className="muted">Заказов пока нет — нажмите «Загрузить заказы».</p> : null}
          </div>
        </div>
      )}

      {tab === "supplies" && (
        <div className="cafe-form-panel mp-panel">
          {mp !== "wildberries" ? (
            <p className="muted">
              Поставки FBS (создание / закрытие) — для Wildberries. На Ozon используйте сборку и этикетки во вкладке «Заказы».
              Склады Ozon нужны для обновления остатков в «Управлении».
            </p>
          ) : (
            <>
              <h3>Поставки WB (FBS)</h3>
              <p className="muted small">
                Создайте поставку → во вкладке «Заказы» добавьте сборочные задания → «В доставку». Это закрывает поставку
                (аналог FBO-сборки на стороне продавца для FBS).
              </p>
              <div className="mp-warehouse-bar">
                <label>
                  Название новой поставки
                  <input
                    value={supplyName}
                    onChange={(e) => setSupplyName(e.target.value)}
                    placeholder={`Поставка ${new Date().toLocaleDateString("ru-RU")}`}
                  />
                </label>
                <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "supply-create"} onClick={createSupply}>
                  {busy === "supply-create" ? "…" : "Создать"}
                </button>
                <button type="button" className="mp-btn" disabled={busy === "supplies"} onClick={loadSupplies}>
                  Обновить список
                </button>
              </div>
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Название</th>
                      <th>Статус</th>
                      <th>Создана</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {supplyRows.map((row) => (
                      <tr key={row.key} className={selectedSupplyId === row.id ? "mp-row-selected" : ""}>
                        <td>
                          <button type="button" className="ghost-btn" onClick={() => setSelectedSupplyId(row.id)}>
                            {row.id}
                          </button>
                        </td>
                        <td>{row.name}</td>
                        <td>{row.done ? "Закрыта / в доставке" : "Открыта"}</td>
                        <td>{row.createdAt ? String(row.createdAt).slice(0, 19).replace("T", " ") : "—"}</td>
                        <td className="mp-row-actions">
                          {!row.done ? (
                            <button
                              type="button"
                              className="mp-btn mp-btn-primary"
                              disabled={busy === "supply-deliver"}
                              onClick={() => deliverSupply(row.id)}
                            >
                              В доставку
                            </button>
                          ) : null}
                          {!row.done ? (
                            <button type="button" className="mp-btn" disabled={busy === "supply-delete"} onClick={() => deleteSupply(row.id)}>
                              Удалить
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!supplyRows.length ? <p className="muted">Поставок нет — создайте первую или нажмите «Обновить список».</p> : null}
              </div>
              {selectedSupplyId ? <p className="muted small">Выбрана для заказов: {selectedSupplyId}</p> : null}
            </>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <MarketplaceAnalyticsPanel
          mp={mp}
          mpCall={mpCall}
          withBusy={withBusy}
          busy={busy}
          settings={settings}
          authFetch={authFetch}
          API_URL={API_URL}
          history={history}
          onStatus={setStatus}
        />
      )}

      {tab === "finance" && (
        <div>
          <div className="mp-actions">
            <button type="button" disabled={busy === "finance"} onClick={loadFinance}>
              {mp === "ozon" ? "Финансы и акции Ozon" : "Финансовый срез WB (30 дн.)"}
            </button>
          </div>
          {financeRows.length ? (
            <div className="mp-table-wrap">
              <h4>Операции</h4>
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Тип</th>
                    <th>Сумма</th>
                    <th>Описание</th>
                  </tr>
                </thead>
                <tbody>
                  {financeRows.map((row, i) => (
                    <tr key={row.operation_id || row.id || i}>
                      <td>{String(row.operation_date || row.date || "—").slice(0, 19)}</td>
                      <td>{row.operation_type || row.type || "—"}</td>
                      <td>{row.amount ?? row.accruals_for_sale ?? "—"}</td>
                      <td>{row.operation_type_name || row.name || row.posting?.posting_number || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {actionRows.length ? (
            <div className="mp-table-wrap">
              <h4>{mp === "ozon" ? "Акции" : "Топ брендов (из отчёта)"}</h4>
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Название</th>
                    <th>{mp === "ozon" ? "Даты" : "Детали"}</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRows.map((row, i) => (
                    <tr key={row.id || i}>
                      <td>{row.id || "—"}</td>
                      <td>{row.title || row.name || "—"}</td>
                      <td>
                        {mp === "ozon"
                          ? `${row.date_start || row.action_start || "—"} — ${row.date_end || row.action_end || "—"}`
                          : row.name || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!financeRows.length && !actionRows.length ? (
            <p className="muted">Нажмите кнопку загрузки (боевой режим + ключи площадки).</p>
          ) : null}
        </div>
      )}

      {tab === "logs" && (
        <div>
          <div className="mp-actions">
            <button type="button" disabled={busy === "logs"} onClick={loadApiLogs}>
              Обновить логи
            </button>
          </div>
          <div className="mp-table-wrap">
            <table className="mp-table">
              <thead>
                <tr>
                  <th>Время</th>
                  <th>MP</th>
                  <th>Метод</th>
                  <th>Код</th>
                  <th>Endpoint</th>
                  <th>Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {logRows.map((row) => (
                  <tr key={row.id}>
                    <td>{String(row.created_at || "").slice(0, 19).replace("T", " ")}</td>
                    <td>{row.marketplace || "—"}</td>
                    <td>{row.method}</td>
                    <td>{row.status_code ?? "—"}</td>
                    <td className="mp-review-text" title={row.endpoint}>
                      {row.endpoint}
                    </td>
                    <td className="mp-review-text" title={row.error_message}>
                      {row.error_message || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!logRows.length ? <p className="muted">Логов пока нет — выполните запрос к площадке.</p> : null}
          </div>
        </div>
      )}

      {tab === "reviews" && (
        <div className="mp-stack">
          <div className="mp-actions">
            <label className="mp-check">
              <input
                type="checkbox"
                checked={reviewsUnansweredOnly}
                onChange={(e) => setReviewsUnansweredOnly(e.target.checked)}
              />
              Без ответа
            </label>
            <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "reviews"} onClick={loadReviews}>
              Отзывы
            </button>
            {mp === "wildberries" ? (
              <button type="button" className="mp-btn" disabled={busy === "questions"} onClick={loadQuestions}>
                Вопросы WB
              </button>
            ) : null}
            <button type="button" className="ghost-btn" disabled={!reviewRows.length} onClick={exportReviewsCsv}>
              Экспорт отзывов
            </button>
          </div>

          {replyDraft.open ? (
            <div className="cafe-form-panel mp-panel">
              <h3>Ответ</h3>
              <p className="muted small">{replyDraft.label}</p>
              <div className="mp-actions" style={{ marginBottom: 8 }}>
                <select value={selectedReplyTemplateId} onChange={(e) => setSelectedReplyTemplateId(e.target.value)}>
                  <option value="">Шаблон ответа…</option>
                  {filteredReplyTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button type="button" className="ghost-btn" disabled={!selectedReplyTemplateId} onClick={applySelectedReplyTemplate}>
                  Подставить
                </button>
              </div>
              <textarea
                rows={4}
                value={replyDraft.text}
                onChange={(e) => setReplyDraft((d) => ({ ...d, text: e.target.value }))}
                placeholder="Текст ответа покупателю"
              />
              <div className="mp-actions">
                <button type="button" className="mp-btn mp-btn-primary" disabled={busy === "review-answer"} onClick={submitReplyDraft}>
                  Отправить
                </button>
                <button type="button" className="ghost-btn" onClick={() => setReplyDraft({ open: false, kind: "review", id: null, text: "", label: "" })}>
                  Отмена
                </button>
              </div>
            </div>
          ) : null}

          <div className="cafe-form-panel mp-panel">
            <h3>Отзывы</h3>
            <div className="mp-table-wrap">
              <table className="mp-table">
                <thead>
                  <tr>
                    <th>Оценка</th>
                    <th>Товар</th>
                    <th>Дата</th>
                    <th>Текст</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {reviewRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.rating}</td>
                      <td>{row.product}</td>
                      <td>{row.date ? String(row.date).slice(0, 19).replace("T", " ") : "—"}</td>
                      <td className="mp-review-text" title={row.text}>
                        {row.text ? (row.text.length > 120 ? `${row.text.slice(0, 120)}…` : row.text) : "—"}
                      </td>
                      <td>{row.answered ? "есть ответ" : "без ответа"}</td>
                      <td className="mp-row-actions">
                        <button type="button" className="ghost-btn" disabled={busy === "review-answer"} onClick={() => answerReview(row)}>
                          Ответить
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!reviewRows.length ? <p className="muted">Отзывов пока нет — нажмите «Отзывы».</p> : null}
            </div>
          </div>

          {mp === "wildberries" ? (
            <div className="cafe-form-panel mp-panel">
              <h3>Вопросы покупателей (WB)</h3>
              <div className="mp-table-wrap">
                <table className="mp-table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Дата</th>
                      <th>Вопрос</th>
                      <th>Статус</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {questionRows.map((row) => (
                      <tr key={row.key}>
                        <td>{row.product}</td>
                        <td>{row.date ? String(row.date).slice(0, 19).replace("T", " ") : "—"}</td>
                        <td className="mp-review-text" title={row.text}>
                          {row.text ? (row.text.length > 140 ? `${row.text.slice(0, 140)}…` : row.text) : "—"}
                        </td>
                        <td>{row.answered ? "есть ответ" : "без ответа"}</td>
                        <td className="mp-row-actions">
                          <button type="button" className="ghost-btn" disabled={busy === "review-answer"} onClick={() => answerQuestion(row)}>
                            Ответить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!questionRows.length ? <p className="muted">Вопросов нет — нажмите «Вопросы WB».</p> : null}
              </div>
            </div>
          ) : (
            <p className="muted small">Вопросы покупателей через API доступны для Wildberries. На Ozon — ответы на отзывы выше.</p>
          )}

          <div className="cafe-form-panel mp-panel">
            <h3>Шаблоны ответов</h3>
            <p className="muted small">Готовые тексты для отзывов и вопросов — подставляются в форму ответа.</p>
            <form onSubmit={saveReplyTemplate}>
              <div className="cafe-form-grid">
                <label>
                  Название
                  <input value={replyTemplateForm.name} onChange={(e) => setReplyTemplateForm((p) => ({ ...p, name: e.target.value }))} required />
                </label>
                <label>
                  Тип
                  <select value={replyTemplateForm.kind} onChange={(e) => setReplyTemplateForm((p) => ({ ...p, kind: e.target.value }))}>
                    <option value="review">Отзыв</option>
                    <option value="question">Вопрос</option>
                  </select>
                </label>
                <label className="cafe-form-span2">
                  Текст
                  <textarea rows={3} value={replyTemplateForm.body} onChange={(e) => setReplyTemplateForm((p) => ({ ...p, body: e.target.value }))} required />
                </label>
              </div>
              <button type="submit" className="mp-btn mp-btn-primary" disabled={busy === "reply-tpl"}>
                Сохранить шаблон
              </button>
            </form>
            {replyTemplates.map((t) => (
              <div key={t.id} className="mp-tpl-row">
                <span>
                  {t.name} · {t.kind === "question" ? "вопрос" : "отзыв"} · {t.marketplace}
                </span>
                <div className="mp-actions">
                  <button
                    type="button"
                    className="mp-btn"
                    onClick={() => {
                      setReplyDraft((d) => ({ ...d, open: d.open || false, text: t.body, kind: t.kind }));
                      setSelectedReplyTemplateId(String(t.id));
                      setStatus(`Шаблон «${t.name}» готов — откройте отзыв/вопрос и нажмите «Ответить».`);
                    }}
                  >
                    Использовать
                  </button>
                  <button type="button" className="ghost-btn" onClick={() => deleteReplyTemplate(t.id)}>
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {liveRows.length && tab === "analytics" && !analyticsCharts.sales.length && !analyticsCharts.stocks.length ? (
        <div className="cafe-form-panel mp-panel">
          <h3>Ответ площадки</h3>
          <ul className="mp-live-list">
            {liveRows.slice(0, 80).map((row, i) => (
              <li key={row.id || row.offer_id || row.posting_number || i}>
                <strong>{recordTitle(row)}</strong>
                {recordHint(row) ? <span className="muted small">{recordHint(row)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {viewer ? (
        <div className="mp-lightbox-overlay" role="presentation" onClick={() => setViewer(null)}>
          <div className="mp-lightbox" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="mp-lightbox-close" aria-label="Закрыть" onClick={() => setViewer(null)}>
              ×
            </button>
            {viewer.isVideo ? (
              <video src={viewer.url} controls autoPlay className="mp-lightbox-media" />
            ) : (
              <img src={viewer.url} alt="" className="mp-lightbox-media" />
            )}
            {viewer.name ? <p className="muted small mp-lightbox-caption">{viewer.name}</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

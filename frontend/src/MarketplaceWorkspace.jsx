import { useCallback, useEffect, useMemo, useState } from "react";
import "./marketplaceWorkspace.css";
import { renderProductCardVideo } from "./productCardVideo.js";
import {
  flattenOzonCategoryOptions,
  flattenWbSubjects,
  normalizeOzonAttributes,
  normalizeWbCharacteristics,
} from "./marketplaceCategoryHelpers.js";

const TABS = [
  ["create", "Создать товар"],
  ["products", "Товары"],
  ["manage", "Управление"],
  ["orders", "Заказы"],
  ["analytics", "Аналитика"],
  ["reviews", "Отзывы"],
];

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
        d="M9 3h6l1 2h4v2H4V5h4l1-2zm1 6h2v9h-2V9zm4 0h2v9h-2V9zM7 9h2v9H7V9z"
        fill="currentColor"
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

function cleanAiDescription(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[*_`#]+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function MarketplaceWorkspace({ authFetch, API_URL }) {
  const [tab, setTab] = useState("create");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mp, setMp] = useState("ozon");
  const [settings, setSettings] = useState(null);
  const [keysForm, setKeysForm] = useState({
    ozon_client_id: "",
    ozon_api_key: "",
    wb_api_key: "",
    yandex_disk_token: "",
    environment: "sandbox",
  });
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
  const [viewer, setViewer] = useState(null);
  const [dotsTick, setDotsTick] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState([]);
  const [attributeFields, setAttributeFields] = useState([]);
  const [categoryQuery, setCategoryQuery] = useState("");
  const [attributesHint, setAttributesHint] = useState("");

  useEffect(() => {
    setCategoryOptions([]);
    setAttributeFields([]);
    setCategoryQuery("");
    setAttributesHint("");
  }, [mp]);

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
      yandex_disk_token: data.has_yandex_disk ? "••••••••" : "",
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

  useEffect(() => {
    const disk = new URLSearchParams(window.location.search).get("disk");
    if (!disk) return;
    if (disk === "ok") setStatus("Яндекс Диск подключён.");
    if (disk === "error") setStatus("Не удалось подключить Яндекс Диск. В кабинете Яндекса OAuth добавьте Redirect URI и право Disk.");
    const next = new URL(window.location.href);
    next.searchParams.delete("disk");
    window.history.replaceState({}, document.title, `${next.pathname}${next.search}${next.hash}`);
    loadSettings().catch(() => {});
  }, [loadSettings]);

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

  function showLive(data) {
    if (!data || data.sandbox) {
      setLive(null);
      if (data?.sandbox) setStatus(data.message || "Песочница: запрос к площадке не отправлялся.");
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
      if (keysForm.yandex_disk_token && !keysForm.yandex_disk_token.startsWith("•")) {
        body.yandex_disk_token = keysForm.yandex_disk_token;
      }
      const res = await authFetch(`${base}/settings/`, { method: "PATCH", body: JSON.stringify(body) });
      if (!res.ok) throw new Error(await readError(res));
      await loadSettings();
      setStatus("Ключи сохранены.");
    });
  }

  function productPayload(row) {
    const images = (Array.isArray(row.images) ? row.images : [])
      .filter((x) => (typeof x === "string" ? true : x?.kind !== "video"))
      .map((x) => (typeof x === "string" ? x : x?.url))
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
      characteristics: row.characteristics || {},
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
    const failed = (data.results || []).filter((r) => !r.ok);
    if (failed.length) {
      const msg = failed[0]?.error || failed[0]?.detail || "Ошибка выгрузки.";
      setStatus(`Не удалось выгрузить: ${msg}`);
    } else {
      setStatus(`Выгружено: ${data.ok} из ${data.total}.`);
    }
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

  async function loadCategoryOptions() {
    await withBusy("cats", async () => {
      if (settings?.environment !== "prod") {
        throw new Error("Категории с площадки доступны в боевом режиме (Меню → Управление).");
      }
      if (mp === "wildberries") {
        const data = await mpCall("categories.subjects", {}, { limit: 1000, offset: 0 });
        if (data?.sandbox) throw new Error(data.message || "Песочница.");
        const options = flattenWbSubjects(data);
        if (!options.length) throw new Error("Wildberries не вернул список предметов.");
        setCategoryOptions(options);
        setStatus(`Загружено предметов WB: ${options.length}.`);
        return;
      }
      const data = await mpCall("categories.tree", { language: "DEFAULT" });
      if (data?.sandbox) throw new Error(data.message || "Песочница.");
      const options = flattenOzonCategoryOptions(data);
      if (!options.length) throw new Error("Ozon не вернул дерево категорий.");
      setCategoryOptions(options);
      setStatus(`Загружено категорий Ozon: ${options.length}.`);
    });
  }

  async function loadAttributesForCategory(categoryId, typeId = "") {
    if (!categoryId) {
      setAttributeFields([]);
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
        if (data?.sandbox) throw new Error(data.message || "Песочница.");
        const fields = normalizeWbCharacteristics(data);
        setAttributeFields(fields);
        setAttributesHint(fields.length ? `Характеристик WB: ${fields.length}` : "Для предмета нет характеристик.");
        return;
      }
      if (!typeId) {
        setAttributeFields([]);
        setAttributesHint("Для Ozon выберите категорию с типом товара.");
        return;
      }
      const data = await mpCall("categories.attributes", {
        description_category_id: Number(categoryId),
        type_id: Number(typeId),
        language: "DEFAULT",
      });
      if (data?.sandbox) throw new Error(data.message || "Песочница.");
      const fields = normalizeOzonAttributes(data);
      setAttributeFields(fields);
      setAttributesHint(fields.length ? `Характеристик Ozon: ${fields.length}` : "Для категории нет характеристик.");
    });
  }

  function onOzonCategoryPick(value) {
    const [categoryId, typeId] = String(value || "").split(":");
    setProduct((p) => ({ ...p, category: categoryId || "", type: typeId || "", characteristics: {} }));
    loadAttributesForCategory(categoryId, typeId).catch(() => {});
  }

  function onWbCategoryPick(value) {
    setProduct((p) => ({ ...p, category: value || "", type: "", characteristics: {} }));
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
    return item.previewUrl || item.url || "";
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
      const videoItem = { url: data.url, previewUrl: localPreview, name: "Видео карточки", kind: "video" };
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
      await loadSettings();
      setStatus("Яндекс Диск отключён.");
    });
  }

  async function applyPricesStocks() {
    await withBusy("prices", async () => {
      if (!priceStock.offer_id) throw new Error("Укажите артикул.");
      if (priceStock.price) {
        const payload =
          mp === "wildberries"
            ? { data: [{ nmID: Number(priceStock.offer_id) || priceStock.offer_id, price: Number(priceStock.price), discount: 0 }] }
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
        showLive(await mpCall("products.prices", payload));
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
        showLive(await mpCall("products.stocks", payload, params));
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
          : { product_id: [Number(offerId) || offerId] };
      showLive(await mpCall("products.delete", payload));
      setStatus("Запрос на удаление отправлен.");
    });
  }

  async function loadLiveProducts() {
    await withBusy("live-products", async () => {
      const payload =
        mp === "wildberries"
          ? { settings: { cursor: { limit: 100 }, filter: { withPhoto: -1 } } }
          : { filter: { visibility: "ALL" }, last_id: "", limit: 100 };
      showLive(await mpCall("products.list", payload));
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
      showLive(await mpCall("orders.list", payload));
    });
  }

  async function loadWarehouses() {
    await withBusy("wh", async () => {
      showLive(await mpCall("warehouses.list", {}));
    });
  }

  async function loadSupplies() {
    await withBusy("supplies", async () => {
      if (mp !== "wildberries") throw new Error("Поставки доступны для Wildberries.");
      showLive(await mpCall("supplies.list"));
    });
  }

  async function loadAnalytics() {
    await withBusy("analytics", async () => {
      if (mp === "wildberries") {
        const payload = { dateFrom: daysAgoIso(30).slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) };
        showLive(await mpCall("analytics.sales", payload, payload));
      } else {
        showLive(
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
        showLive(await mpCall("feedbacks.list", { isAnswered: false, take: 50, skip: 0 }, { isAnswered: false, take: 50, skip: 0 }));
      } else {
        showLive(await mpCall("reviews.list", { filter: {}, limit: 50, sort_dir: "DESC", last_id: 0 }));
      }
    });
  }

  async function loadQuestions() {
    await withBusy("questions", async () => {
      if (mp !== "wildberries") throw new Error("Вопросы покупателей — для Wildberries.");
      showLive(await mpCall("questions.list", { isAnswered: false, take: 50, skip: 0 }, { isAnswered: false, take: 50, skip: 0 }));
    });
  }

  async function loadCategories() {
    await withBusy("cats", async () => {
      if (mp === "wildberries") showLive(await mpCall("categories.parents"));
      else showLive(await mpCall("categories.tree", { language: "DEFAULT" }));
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
    setMenuOpen(false);
    setStatus(`Подставлен шаблон «${t.name}».`);
  }

  const envLabel = settings?.environment === "prod" ? "Боевой режим" : "Песочница";
  const filteredHistory = useMemo(
    () =>
      history.filter(
        (h) =>
          !search ||
          String(h.offer_id || "").toLowerCase().includes(search.toLowerCase()) ||
          String(h.product?.name || "").toLowerCase().includes(search.toLowerCase()),
      ),
    [history, search],
  );
  const tabLabel = TABS.find(([id]) => id === tab)?.[1] || "";
  const ozonCategoryValue = product.category && product.type ? `${product.category}:${product.type}` : "";
  const filteredCategoryOptions = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return categoryOptions;
    return categoryOptions.filter((item) => {
      const label = (item.label || item.name || "").toLowerCase();
      return label.includes(q) || String(item.id || item.categoryId || "").includes(q);
    });
  }, [categoryOptions, categoryQuery]);
  const requiredAttributeCount = attributeFields.filter((f) => f.required).length;
  const mediaLimits = mediaLimitsFor(mp);
  const mediaCounts = countMediaItems(product.images);

  return (
    <section className={`card full-width cafe-provider mp-workspace ${mp === "wildberries" ? "mp-wb" : "mp-ozon"}`}>
      <div className="mp-head">
        <div className="mp-head-title">
          <h2>Маркетплейсы</h2>
          <p className="muted">{envLabel}</p>
        </div>
        <div className="mp-toggle" role="group" aria-label="Площадка">
          <button type="button" className={mp === "ozon" ? "is-active" : ""} onClick={() => setMp("ozon")}>
            Ozon
          </button>
          <button type="button" className={mp === "wildberries" ? "is-active" : ""} onClick={() => setMp("wildberries")}>
            WB
          </button>
        </div>
        <div className="mp-menu">
          <button type="button" className="mp-menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
            Меню
          </button>
          {menuOpen ? (
            <div className="mp-menu-drop">
              {TABS.map(([id, label]) => (
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

      {status ? <p className="status">{status}</p> : null}
      <p className="mp-section-title">{tabLabel}</p>

      {tab === "create" && (
        <div className="mp-stack">
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
              <div className="cafe-form-span2 mp-category-block">
                <div className="mp-media-head">
                  <h3>Категория и характеристики</h3>
                  <button type="button" className="ghost-btn" disabled={busy === "cats"} onClick={loadCategoryOptions}>
                    {busy === "cats" ? "Загрузка…" : "Загрузить с площадки"}
                  </button>
                </div>
                <label className="field-label">
                  Поиск категории
                  <input
                    value={categoryQuery}
                    onChange={(e) => setCategoryQuery(e.target.value)}
                    placeholder={mp === "wildberries" ? "Предмет WB" : "Категория Ozon"}
                  />
                </label>
                {mp === "wildberries" ? (
                  <label>
                    Предмет (subjectID)
                    <select value={product.category} onChange={(e) => onWbCategoryPick(e.target.value)}>
                      <option value="">Выберите предмет</option>
                      {filteredCategoryOptions.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                          {item.parent ? ` · ${item.parent}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <label>
                    Категория и тип
                    <select value={ozonCategoryValue} onChange={(e) => onOzonCategoryPick(e.target.value)}>
                      <option value="">Выберите категорию</option>
                      {filteredCategoryOptions.map((item) => (
                        <option key={`${item.categoryId}:${item.typeId}`} value={`${item.categoryId}:${item.typeId}`}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {!categoryOptions.length ? (
                  <p className="muted small">
                    Нажмите «Загрузить с площадки» в боевом режиме — подтянутся категории и обязательные характеристики, как в кабинете Ozon/WB.
                  </p>
                ) : null}
                {attributesHint ? <p className="muted small">{attributesHint}</p> : null}
                {attributeFields.length ? (
                  <div className="mp-attrs-grid">
                    {attributeFields.map((field) => (
                      <label key={field.id}>
                        {field.name}
                        {field.required ? " *" : ""}
                        {field.unit ? ` (${field.unit})` : ""}
                        <input
                          value={product.characteristics?.[field.id] || ""}
                          onChange={(e) => setCharacteristic(field.id, e.target.value)}
                          placeholder={field.required ? "Обязательно" : "Необязательно"}
                        />
                      </label>
                    ))}
                  </div>
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
              <button type="button" className="ghost-btn" disabled={busy === "video"} onClick={generateVideo}>
                {busy === "video" ? `Сгенерировать видео карточки${dots}` : "Сгенерировать видео карточки"}
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
            <div className="mp-media-head">
              <h3>Пакет и CSV</h3>
              <button type="button" className="mp-plus-btn" title="Добавить строку" onClick={() => setBatch((rows) => [...rows, emptyProduct()])}>
                <PlusIcon />
              </button>
            </div>
            {batch.map((row, i) => (
              <div key={i} className="mp-batch-row">
                <input placeholder="Артикул" value={row.offer_id} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, offer_id: e.target.value } : r)))} />
                <input placeholder="Название" value={row.name} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, name: e.target.value } : r)))} />
                <input placeholder="Цена" value={row.price} onChange={(e) => setBatch((rows) => rows.map((r, idx) => (idx === i ? { ...r, price: e.target.value } : r)))} />
              </div>
            ))}
            <div className="mp-actions">
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
            {!filteredHistory.length ? <p className="muted">Пока нет выгрузок. Создайте карточку в меню «Создать товар».</p> : null}
          </div>
        </div>
      )}

      {tab === "manage" && (
        <div className="mp-stack">
          <div className="cafe-form-panel">
            <h3>Что нужно для функций</h3>
            <ul className="mp-need-list">
              <li>
                <strong>Ozon / WB:</strong> ключи ниже. Боевые запросы идут только в режиме «Боевой».
              </li>
              <li>
                <strong>ИИ-описание:</strong> {settings?.ai_enabled ? `включено (${settings.ai_model || "OpenRouter"}).` : "выключено. На сервере задайте OPENROUTER_API_KEY."}
              </li>
              <li>
                <strong>Яндекс Диск:</strong> {settings?.has_yandex_disk ? "подключён, фото уходят на Диск." : settings?.yandex_disk_oauth ? "нажмите «Подключить Яндекс Диск»." : "на сервере не заданы YANDEX_OAUTH_CLIENT_ID/SECRET."}
              </li>
              <li>
                <strong>Видео карточки:</strong> собирается в браузере из названия, цены и загруженных фото.
              </li>
            </ul>
          </div>
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
          <p className="muted small">В песочнице запросы на площадку не уходят. Для реальных заказов включите боевой режим и ключи.</p>
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

      {liveRows.length ? (
        <ul className="mp-live-list">
          {liveRows.slice(0, 80).map((row, i) => (
            <li key={row.id || row.offer_id || row.posting_number || i}>
              <strong>{recordTitle(row)}</strong>
              {recordHint(row) ? <span className="muted small">{recordHint(row)}</span> : null}
            </li>
          ))}
        </ul>
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

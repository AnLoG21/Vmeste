/** Разбор категорий и характеристик Ozon / Wildberries для формы карточки. */

/** Поля, которые уже есть в карточке — не показываем второй раз в характеристиках. */
const CARD_DUPLICATE_NAME_RE =
  /^(название(\s+товара)?|наименование(\s+товара)?|name|title|описание(\s+товара)?|description|аннотация|штрих[- ]?код|barcode|ean(\s*\/?\s*upc)?|артикул(\s+продавца)?|vendor\s*code|offer[_ -]?id|sku|цена|price|остаток|stock|фото|изображени[ея]|картинк[аи]|обложк[аи]|медиа|видео(\s+обложк[аи])?|video|ссылка\s+на\s+видео|название\s+видео|файл\s+видео|youtube|rich[- ]?content)$/i;

const CARD_DUPLICATE_NAME_INCLUDES_RE =
  /(название\s+видео|ссылка\s+на\s+видео|обложка\s+видео|видеофайл|видео\s+карт|^видео[:\s]|ozon\.?\s*видео)/i;

/** Известные id атрибутов Ozon, дублирующие поля карточки. */
const OZON_CARD_DUPLICATE_IDS_ALWAYS = new Set([
  "4180", // Название
  "4191", // Аннотация
]);

export function normalizeAttrName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[«»"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function isCardDuplicateAttribute(field) {
  if (!field) return false;
  const id = String(field.id || "");
  if (OZON_CARD_DUPLICATE_IDS_ALWAYS.has(id)) return true;
  const name = normalizeAttrName(field.name);
  if (!name) return false;
  if (CARD_DUPLICATE_NAME_RE.test(name)) return true;
  if (CARD_DUPLICATE_NAME_INCLUDES_RE.test(name)) return true;
  // Группы медиа у Ozon
  const group = normalizeAttrName(field.groupName);
  if (group && /(видео|медиа|изображен|фото)/.test(group) && /(видео|фото|изображен|обложк|ссылка)/.test(name)) {
    return true;
  }
  return false;
}

/** source: form field to auto-fill when hidden; null = skip (media etc.) */
export function cardDuplicateSource(field) {
  const name = normalizeAttrName(field?.name);
  const id = String(field?.id || "");
  if (id === "4180" || /^(название|наименование|name|title)/.test(name)) return "name";
  if (id === "4191" || /^(описание|description|аннотация)/.test(name)) return "description";
  if (/^(штрих|barcode|ean)/.test(name)) return "barcode";
  if (/^(бренд|brand)$/.test(name)) return "brand";
  if (/^(артикул|vendor|offer|sku)$/.test(name)) return "offer_id";
  return null;
}

/**
 * Split marketplace attributes into visible form fields and mirrors of card fields.
 * Mirrors are auto-filled from name/brand/description/barcode on import.
 */
export function splitCardAttributes(fields) {
  const visible = [];
  const mirrors = [];
  for (const field of fields || []) {
    if (isCardDuplicateAttribute(field)) {
      mirrors.push({ ...field, source: cardDuplicateSource(field) });
    } else {
      visible.push(field);
    }
  }
  return { visible, mirrors };
}

export function applyAttributeMirrors(characteristics, mirrors, product) {
  const next = { ...(characteristics || {}) };
  for (const field of mirrors || []) {
    if (!field?.id || !field.source) continue;
    if (next[field.id] != null && String(next[field.id]).trim() !== "") continue;
    const raw = product?.[field.source];
    if (raw == null || String(raw).trim() === "") continue;
    next[field.id] = String(raw).trim();
  }
  return next;
}

export function flattenOzonCategoryOptions(tree) {
  const out = [];

  function walk(nodes, parentCategoryId, path) {
    for (const node of nodes || []) {
      if (!node || typeof node !== "object") continue;
      const catId = node.description_category_id ?? parentCategoryId;
      const nextPath = node.category_name ? [...path, node.category_name] : path;
      if (node.type_id && catId) {
        out.push({
          categoryId: String(catId),
          typeId: String(node.type_id),
          label: [...nextPath, node.type_name].filter(Boolean).join(" → "),
        });
      }
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, catId, nextPath);
      }
    }
  }

  const roots = Array.isArray(tree) ? tree : tree?.result || tree?.data || [];
  walk(roots, null, []);
  return out.sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

export function normalizeOzonAttributes(payload) {
  const rows = payload?.result || payload?.attributes || payload?.data || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.id ?? row.attribute_id ?? ""),
      name: row.name || row.title || `Характеристика ${row.id ?? ""}`,
      required: Boolean(row.is_required ?? row.required),
      description: row.description || "",
      type: row.type || "string",
      dictionaryId: Number(row.dictionary_id || 0),
      dictionary: Boolean(row.dictionary_id),
      groupName: row.group_name || "",
    }))
    .filter((row) => row.id);
}

export function normalizeOzonDictionaryValues(payload) {
  const rows = payload?.result || payload?.values || payload?.data || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.id ?? row.value_id ?? row.dictionary_value_id ?? ""),
      label: row.value ?? row.name ?? row.title ?? String(row.id ?? ""),
    }))
    .filter((row) => row.id);
}

export function wbCharcInputType(charcType) {
  if (charcType === 4) return "number";
  return "text";
}

export function flattenWbSubjects(payload) {
  const rows = payload?.data || payload?.result || payload?.subjects || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.subjectID ?? row.id ?? row.objectID ?? ""),
      name: row.subjectName ?? row.name ?? row.objectName ?? "",
      parent: row.parentName || row.parent || "",
    }))
    .filter((row) => row.id && row.name)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function normalizeWbCharacteristics(payload) {
  const rows = payload?.data || payload?.result || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.charcID ?? row.id ?? ""),
      name: row.name || `Характеристика ${row.charcID ?? ""}`,
      required: Boolean(row.required ?? row.isRequiredForCreate),
      unit: row.unitName || "",
      charcType: row.charcType,
    }))
    .filter((row) => row.id);
}

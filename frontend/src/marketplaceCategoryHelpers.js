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

/** Keep Ozon tree as-is for drill-down UI (no full flatten). */
export function extractOzonCategoryTree(payload) {
  const roots = Array.isArray(payload) ? payload : payload?.result || payload?.data || [];
  return Array.isArray(roots) ? roots : [];
}

export function ozonBrowseChildren(nodes) {
  return (Array.isArray(nodes) ? nodes : []).filter((n) => n && typeof n === "object");
}

export function ozonNodeKey(node, idx = 0) {
  if (node?.type_id) return `t:${node.type_id}`;
  if (node?.description_category_id) return `c:${node.description_category_id}`;
  return `i:${idx}:${node?.category_name || node?.type_name || ""}`;
}

export function ozonNodeTitle(node) {
  return String(node?.type_name || node?.category_name || "Без названия");
}

export function ozonNodeIsSelectableType(node) {
  return Boolean(node?.type_id && (node?.description_category_id || node?.category_name != null));
}

export function ozonNodeHasChildren(node) {
  return Array.isArray(node?.children) && node.children.length > 0;
}

/**
 * Search leaf types in Ozon tree without building the full flat list.
 * Stops after `limit` matches to keep UI responsive.
 */
export function searchOzonCategoryLeaves(tree, query, limit = 60) {
  const q = String(query || "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
  if (q.length < 2) return [];
  const out = [];

  function walk(nodes, parentCategoryId, path) {
    if (out.length >= limit) return;
    for (const node of nodes || []) {
      if (out.length >= limit) return;
      if (!node || typeof node !== "object") continue;
      const catId = node.description_category_id ?? parentCategoryId;
      const nextPath = node.category_name ? [...path, node.category_name] : path;
      if (node.type_id && catId) {
        const label = [...nextPath, node.type_name].filter(Boolean).join(" → ");
        if (label.toLowerCase().replace(/ё/g, "е").includes(q)) {
          out.push({
            categoryId: String(catId),
            typeId: String(node.type_id),
            label,
            value: `${catId}:${node.type_id}`,
          });
        }
      }
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, catId, nextPath);
      }
    }
  }

  walk(Array.isArray(tree) ? tree : [], null, []);
  return out;
}

/** Resolve selected Ozon value label from tree without full flatten. */
export function findOzonCategoryLabel(tree, categoryId, typeId) {
  if (!categoryId || !typeId) return "";
  let found = "";
  function walk(nodes, parentCategoryId, path) {
    if (found) return;
    for (const node of nodes || []) {
      if (found) return;
      if (!node || typeof node !== "object") continue;
      const catId = node.description_category_id ?? parentCategoryId;
      const nextPath = node.category_name ? [...path, node.category_name] : path;
      if (String(node.type_id) === String(typeId) && String(catId) === String(categoryId)) {
        found = [...nextPath, node.type_name].filter(Boolean).join(" → ");
        return;
      }
      if (Array.isArray(node.children) && node.children.length) {
        walk(node.children, catId, nextPath);
      }
    }
  }
  walk(Array.isArray(tree) ? tree : [], null, []);
  return found;
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
      parentId: row.parentID != null ? String(row.parentID) : "",
    }))
    .filter((row) => row.id && row.name)
    .sort((a, b) => a.name.localeCompare(b.name, "ru"));
}

export function flattenWbParents(payload) {
  const rows = payload?.data || payload?.result || payload?.parents || [];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      id: String(row.id ?? row.parentID ?? row.objectID ?? ""),
      name: row.name ?? row.parentName ?? row.objectName ?? "",
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

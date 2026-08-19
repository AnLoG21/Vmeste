/** Разбор категорий и характеристик Ozon / Wildberries для формы карточки. */

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
      dictionaryId: row.dictionary_id || 0,
    }))
    .filter((row) => row.id);
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

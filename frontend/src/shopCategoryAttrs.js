/** Адаптивные характеристики товара по pool_key категории (в духе Ozon). */

export const CLOTHING_SIZES = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"];
export const SHOE_SIZES = ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"];
export const KIDS_CLOTHING_SIZES = ["74", "80", "86", "92", "98", "104", "110", "116", "122", "128", "134", "140", "146", "152"];

const COMMON = [
  { key: "Бренд", type: "text", placeholder: "Например, L'Oréal" },
  { key: "Страна производства", type: "text" },
  { key: "Артикул производителя", type: "text" },
];

const SCHEMAS = [
  {
    match: (k) => k.startsWith("beauty-hair"),
    fields: [
      ...COMMON,
      { key: "Тип волос", type: "select", options: ["Все типы", "Сухие", "Жирные", "Окрашенные", "Повреждённые", "Тонкие"] },
      { key: "Объём", type: "text", placeholder: "250 мл" },
      { key: "Эффект", type: "text", placeholder: "Увлажнение, объём…" },
      { key: "Состав", type: "textarea" },
    ],
  },
  {
    match: (k) => k.startsWith("beauty-nails"),
    fields: [
      ...COMMON,
      { key: "Тип", type: "select", options: ["Гель-лак", "Лак", "База", "Топ", "Уход", "Инструмент"] },
      { key: "Объём", type: "text", placeholder: "10 мл" },
      { key: "Цвет", type: "text" },
      { key: "Финиш", type: "select", options: ["Глянец", "Матовый", "Шиммер", "Глиттер"] },
    ],
  },
  {
    match: (k) => k.startsWith("beauty-face") || k.startsWith("beauty-body") || k.startsWith("beauty-prof"),
    fields: [
      ...COMMON,
      { key: "Тип кожи", type: "select", options: ["Все типы", "Сухая", "Жирная", "Комбинированная", "Чувствительная"] },
      { key: "Объём / вес", type: "text" },
      { key: "SPF", type: "text" },
      { key: "Назначение", type: "text" },
      { key: "Состав", type: "textarea" },
    ],
  },
  {
    match: (k) => k.startsWith("auto-oils") || k.startsWith("auto-chem"),
    fields: [
      ...COMMON,
      { key: "Вязкость / спецификация", type: "text", placeholder: "5W-40, API SN" },
      { key: "Объём", type: "text", placeholder: "4 л" },
      { key: "Применение", type: "text" },
      { key: "Допуски", type: "textarea" },
    ],
  },
  {
    match: (k) => k.startsWith("auto-parts") || k.startsWith("auto-access") || k.startsWith("auto-tires"),
    fields: [
      ...COMMON,
      { key: "Совместимость", type: "textarea", placeholder: "Марка / модель / год" },
      { key: "OEM / артикул", type: "text" },
      { key: "Материал", type: "text" },
      { key: "Размер", type: "text" },
    ],
    sizeOptions: null,
  },
  {
    match: (k) => /fashion-.*-(clothes|sport|underwear)|sport-fit-wear/.test(k),
    fields: [
      ...COMMON,
      { key: "Состав", type: "text", placeholder: "Хлопок 100%" },
      { key: "Сезон", type: "select", options: ["Всесезон", "Лето", "Зима", "Демисезон"] },
      { key: "Цвет", type: "text" },
      { key: "Пол", type: "select", options: ["Женский", "Мужской", "Унисекс", "Детский"] },
      { key: "Покрой", type: "text" },
    ],
    sizeOptions: CLOTHING_SIZES,
  },
  {
    match: (k) => /fashion-.*-shoes/.test(k),
    fields: [
      ...COMMON,
      { key: "Материал верха", type: "text" },
      { key: "Материал подошвы", type: "text" },
      { key: "Цвет", type: "text" },
      { key: "Сезон", type: "select", options: ["Лето", "Зима", "Демисезон", "Всесезон"] },
    ],
    sizeOptions: SHOE_SIZES,
  },
  {
    match: (k) => k.startsWith("fashion-kids") || k.startsWith("kids-"),
    fields: [
      ...COMMON,
      { key: "Возраст", type: "text", placeholder: "3–5 лет" },
      { key: "Материал", type: "text" },
      { key: "Цвет", type: "text" },
    ],
    sizeOptions: KIDS_CLOTHING_SIZES,
  },
  {
    match: (k) => k.startsWith("electronics") || k.startsWith("appliances"),
    fields: [
      ...COMMON,
      { key: "Модель", type: "text" },
      { key: "Гарантия", type: "text", placeholder: "12 мес." },
      { key: "Питание", type: "text" },
      { key: "Цвет", type: "text" },
      { key: "Комплектация", type: "textarea" },
    ],
  },
  {
    match: (k) => k.startsWith("grocery") || k.startsWith("pets-"),
    fields: [
      ...COMMON,
      { key: "Вес / объём", type: "text" },
      { key: "Срок годности", type: "text" },
      { key: "Условия хранения", type: "text" },
      { key: "Состав", type: "textarea" },
    ],
  },
  {
    match: (k) => k.startsWith("home-") || k.startsWith("office-") || k.startsWith("hobby-"),
    fields: [
      ...COMMON,
      { key: "Материал", type: "text" },
      { key: "Размеры", type: "text", placeholder: "Д × Ш × В" },
      { key: "Цвет", type: "text" },
      { key: "Назначение", type: "text" },
    ],
  },
  {
    match: (k) => k.startsWith("health-") || k.startsWith("books-"),
    fields: [
      ...COMMON,
      { key: "Формат / дозировка", type: "text" },
      { key: "Количество", type: "text" },
      { key: "Назначение", type: "textarea" },
    ],
  },
];

const DEFAULT_FIELDS = [
  ...COMMON,
  { key: "Цвет", type: "text" },
  { key: "Материал", type: "text" },
  { key: "Размеры", type: "text" },
  { key: "Назначение", type: "textarea" },
];

export function attrSchemaForPoolKey(poolKey) {
  const k = String(poolKey || "");
  for (const schema of SCHEMAS) {
    if (schema.match(k)) {
      return {
        fields: schema.fields,
        sizeOptions: schema.sizeOptions || null,
      };
    }
  }
  return { fields: DEFAULT_FIELDS, sizeOptions: null };
}

export function sizesTextToList(text) {
  return String(text || "")
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

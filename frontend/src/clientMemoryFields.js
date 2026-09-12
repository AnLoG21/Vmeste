/** Sphere-aware CRM field catalogs (mirrors backend client_memory_fields.py). */

export const CLIENT_BASE_DISABLED_SPHERES = new Set(["marketplaces", "cafe_restaurant"]);

export function clientBaseEnabledForSphere(sphere) {
  return !CLIENT_BASE_DISABLED_SPHERES.has(String(sphere || "").trim());
}

const NOTES = {
  technical_notes: true,
  preferences_notes: true,
  allergies: true,
};

export const SALON_MEMORY_FIELDS = {
  hair_color: true,
  lash_length: true,
  lash_curl: true,
  nail_shape: true,
  wax_brand: true,
  materials: true,
  music: true,
  drink: true,
  talk_topics: true,
  ...NOTES,
};

export const AUTO_MEMORY_FIELDS = {
  vehicle_title: true,
  vehicle_plate: true,
  vehicle_vin: true,
  vehicle_year: true,
  mileage_km: true,
  oil_spec: true,
  tire_size: true,
  last_works: true,
  parts_notes: true,
  materials: true,
  ...NOTES,
};

export const SHOP_MEMORY_FIELDS = {
  preferred_size: true,
  delivery_pref: true,
  purchase_notes: true,
  materials: false,
  ...NOTES,
};

export function memoryFieldsForSphere(sphere) {
  const s = String(sphere || "").trim();
  if (s === "service_center") return { ...AUTO_MEMORY_FIELDS };
  if (s === "shops") return { ...SHOP_MEMORY_FIELDS };
  return { ...SALON_MEMORY_FIELDS };
}

export const TECH_FIELD_META = {
  hair_color: { label: "Краска / формула", group: "salon" },
  lash_length: { label: "Ресницы: длина", group: "salon" },
  lash_curl: { label: "Ресницы: изгиб", group: "salon" },
  nail_shape: { label: "Форма ногтей", group: "salon" },
  wax_brand: { label: "Воск / материал", group: "salon" },
  materials: { label: "Другие материалы", group: "common" },
  vehicle_title: { label: "Авто (марка / модель)", group: "auto" },
  vehicle_plate: { label: "Госномер", group: "auto" },
  vehicle_vin: { label: "VIN", group: "auto" },
  vehicle_year: { label: "Год выпуска", group: "auto" },
  mileage_km: { label: "Пробег, км", group: "auto" },
  oil_spec: { label: "Масло / спецификация", group: "auto" },
  tire_size: { label: "Размер шин", group: "auto" },
  last_works: { label: "Последние работы", group: "auto" },
  parts_notes: { label: "Детали / запчасти", group: "auto" },
  preferred_size: { label: "Размер / посадка", group: "shop" },
  delivery_pref: { label: "Доставка / самовывоз", group: "shop" },
  purchase_notes: { label: "Заметки по покупкам", group: "shop" },
  technical_notes: { label: "Технические заметки", group: "notes" },
};

export const PERSONAL_FIELD_META = {
  music: { label: "Музыка / атмосфера", group: "salon" },
  drink: { label: "Напиток", group: "salon" },
  allergies: { label: "Аллергии / противопоказания", group: "common" },
  talk_topics: { label: "О чём говорить", group: "salon" },
  preferences_notes: { label: "Ещё заметки", group: "notes" },
};

export function emptyTechForSphere(sphere) {
  const prefs = memoryFieldsForSphere(sphere);
  const out = {};
  for (const key of Object.keys(TECH_FIELD_META)) {
    if (key in prefs || key === "materials") out[key] = "";
  }
  return out;
}

export function emptyPersonalForSphere(sphere) {
  const prefs = memoryFieldsForSphere(sphere);
  const out = {};
  for (const key of Object.keys(PERSONAL_FIELD_META)) {
    if (key in prefs) out[key] = "";
  }
  return out;
}

export function techOptionsForSphere(sphere) {
  const prefs = memoryFieldsForSphere(sphere);
  return Object.entries(TECH_FIELD_META)
    .filter(([key]) => key in prefs && key !== "technical_notes")
    .map(([key, meta]) => ({ key, label: meta.label, defaultOn: Boolean(prefs[key]) }));
}

export function personalOptionsForSphere(sphere) {
  const prefs = memoryFieldsForSphere(sphere);
  return Object.entries(PERSONAL_FIELD_META)
    .filter(([key]) => key in prefs)
    .map(([key, meta]) => ({ key, label: meta.label, defaultOn: Boolean(prefs[key]) }));
}

export function techTabLabel(sphere) {
  if (sphere === "service_center") return "Авто";
  if (sphere === "shops") return "Покупки";
  return "Техкарта";
}

export function personalTabLabel(sphere) {
  if (sphere === "service_center") return "Заметки";
  return "Личное";
}

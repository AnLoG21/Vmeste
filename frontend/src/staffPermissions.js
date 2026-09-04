/** Единая матрица прав сотрудников: набор ключей зависит от сферы организации. */

export const STAFF_PERM_DEFS = [
  ["manage_bookings", "Записи клиентов"],
  ["manage_intervals", "Календарь интервалов"],
  ["manage_services", "Услуги и категории"],
  ["manage_chats", "Чаты организации"],
  ["manage_client_chats", "Чаты с клиентами"],
  ["manage_staff", "Добавление сотрудников"],
  ["can_delegate_permissions", "Может настраивать права других"],
  ["manage_inspections", "Приёмка / заказ-наряды"],
  ["marketplace_view_keys", "Маркетплейсы: ключи API"],
  ["marketplace_manage_orders", "Маркетплейсы: заказы и отзывы"],
  ["marketplace_manage_catalog", "Маркетплейсы: каталог и выгрузка"],
  ["cafe_orders", "Кафе: заказы и статусы зала"],
  ["cafe_kitchen", "Кафе: кухня (готовка)"],
  ["cafe_seating", "Кафе: посадка / карта столов"],
  ["cafe_delivery", "Кафе: доставка / курьер"],
  ["cafe_menu", "Кафе: меню"],
  ["cafe_settings", "Кафе: настройки зала и QR"],
];

const BOOKING_KEYS = new Set([
  "manage_bookings",
  "manage_intervals",
  "manage_services",
  "manage_inspections",
]);

export function orgSphereOf(me) {
  return me?.provider_sphere || me?.employer_sphere || "";
}

/** @returns {[string, string][]} */
export function staffPermLabelsForSphere(sphere) {
  const s = sphere || "";
  return STAFF_PERM_DEFS.filter(([key]) => {
    if (s === "marketplaces") {
      return !BOOKING_KEYS.has(key) && !String(key).startsWith("cafe_");
    }
    if (s === "cafe_restaurant") {
      return !BOOKING_KEYS.has(key) && !String(key).startsWith("marketplace_");
    }
    if (s === "service_center") {
      return !String(key).startsWith("marketplace_") && !String(key).startsWith("cafe_");
    }
    if (s === "hair_salon") {
      return (
        !String(key).startsWith("marketplace_") &&
        !String(key).startsWith("cafe_") &&
        key !== "manage_inspections"
      );
    }
    return !String(key).startsWith("marketplace_") && !String(key).startsWith("cafe_");
  });
}

export function sphereUsesServiceAssignment(sphere) {
  return sphere === "hair_salon" || sphere === "service_center" || !sphere;
}

export const STAFF_PERM_DEFAULTS = {
  manage_bookings: true,
  manage_intervals: false,
  manage_services: false,
  manage_chats: true,
  manage_client_chats: true,
  manage_staff: false,
  can_delegate_permissions: false,
  manage_inspections: false,
  marketplace_view_keys: false,
  marketplace_manage_orders: true,
  marketplace_manage_catalog: false,
  cafe_orders: true,
  cafe_kitchen: false,
  cafe_seating: true,
  cafe_delivery: false,
  cafe_menu: false,
  cafe_settings: false,
};

/** Все ключи прав → false (база перед наложением пресета). */
export function blankStaffPermissions() {
  const out = {};
  for (const key of Object.keys(STAFF_PERM_DEFAULTS)) out[key] = false;
  return out;
}

/**
 * Пресеты «роль → права» по сферам.
 * `perms` — только отличия от blank (true); остальные ключи сферы остаются false,
 * ключи чужих сфер не трогаем при merge на существующего сотрудника.
 */
const SALON_PRESETS = [
  {
    id: "master",
    label: "Мастер",
    jobTitle: "Мастер",
    hint: "Записи и чаты с клиентами. Без интервалов и каталога.",
    perms: {
      manage_bookings: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "receptionist",
    label: "Администратор ресепшн",
    jobTitle: "Администратор",
    hint: "Записи, календарь, чаты. Без управления сотрудниками.",
    perms: {
      manage_bookings: true,
      manage_intervals: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "admin",
    label: "Управляющий",
    jobTitle: "Управляющий",
    hint: "Записи, услуги, интервалы, чаты, приглашение сотрудников.",
    perms: {
      manage_bookings: true,
      manage_intervals: true,
      manage_services: true,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: true,
    },
  },
];

const SERVICE_PRESETS = [
  {
    id: "mechanic",
    label: "Механик",
    jobTitle: "Механик",
    hint: "Записи, приёмка, чаты с клиентами.",
    perms: {
      manage_bookings: true,
      manage_inspections: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "receptionist",
    label: "Администратор",
    jobTitle: "Администратор",
    hint: "Записи, интервалы, приёмка, чаты.",
    perms: {
      manage_bookings: true,
      manage_intervals: true,
      manage_inspections: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "admin",
    label: "Управляющий",
    jobTitle: "Управляющий",
    hint: "Полный контур сервиса + приглашение сотрудников.",
    perms: {
      manage_bookings: true,
      manage_intervals: true,
      manage_services: true,
      manage_inspections: true,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: true,
    },
  },
];

export const CAFE_STAFF_ROLE_PRESETS = [
  {
    id: "hall",
    label: "Зал (официант)",
    jobTitle: "Официант",
    hint: "Заказы, статусы зала, посадка. Без кухни и меню.",
    perms: {
      cafe_orders: true,
      cafe_seating: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "kitchen",
    label: "Кухня",
    jobTitle: "Повар",
    hint: "Только кухня: готовится / готов.",
    perms: {
      cafe_kitchen: true,
      manage_chats: true,
    },
  },
  {
    id: "hostess",
    label: "Хостес",
    jobTitle: "Хостес",
    hint: "Посадка и карта столов.",
    perms: {
      cafe_seating: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "courier",
    label: "Курьер",
    jobTitle: "Курьер",
    hint: "Доставка: статусы курьера.",
    perms: {
      cafe_delivery: true,
      manage_chats: true,
    },
  },
  {
    id: "admin",
    label: "Управляющий",
    jobTitle: "Управляющий",
    hint: "Зал, меню, настройки QR + приглашение сотрудников.",
    perms: {
      cafe_orders: true,
      cafe_kitchen: true,
      cafe_seating: true,
      cafe_delivery: true,
      cafe_menu: true,
      cafe_settings: true,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: true,
    },
  },
];

const MARKETPLACE_PRESETS = [
  {
    id: "orders",
    label: "Менеджер заказов",
    jobTitle: "Менеджер заказов",
    hint: "Заказы и отзывы маркетплейсов, чаты.",
    perms: {
      marketplace_manage_orders: true,
      manage_chats: true,
      manage_client_chats: true,
    },
  },
  {
    id: "catalog",
    label: "Менеджер каталога",
    jobTitle: "Менеджер каталога",
    hint: "Каталог и выгрузка, чаты.",
    perms: {
      marketplace_manage_catalog: true,
      manage_chats: true,
    },
  },
  {
    id: "admin",
    label: "Управляющий",
    jobTitle: "Управляющий",
    hint: "Заказы, каталог, ключи API, приглашение сотрудников.",
    perms: {
      marketplace_view_keys: true,
      marketplace_manage_orders: true,
      marketplace_manage_catalog: true,
      manage_chats: true,
      manage_client_chats: true,
      manage_staff: true,
    },
  },
];

/** @returns {{ id: string, label: string, jobTitle?: string, hint: string, perms: Record<string, boolean> }[]} */
export function staffRolePresetsForSphere(sphere) {
  if (sphere === "cafe_restaurant") return CAFE_STAFF_ROLE_PRESETS;
  if (sphere === "marketplaces") return MARKETPLACE_PRESETS;
  if (sphere === "service_center") return SERVICE_PRESETS;
  if (sphere === "hair_salon") return SALON_PRESETS;
  return SALON_PRESETS;
}

/**
 * Собирает полный объект permissions для приглашения:
 * blank → defaults только для «нейтральных»? No — blank + preset perms for sphere keys.
 * Чужие сферы оставляем как в STAFF_PERM_DEFAULTS (безопасно на бэке).
 */
export function buildPermissionsFromPreset(sphere, presetId) {
  const allowed = new Set(staffPermLabelsForSphere(sphere).map(([k]) => k));
  const next = { ...STAFF_PERM_DEFAULTS };
  for (const key of Object.keys(next)) {
    if (allowed.has(key)) next[key] = false;
  }
  const preset = staffRolePresetsForSphere(sphere).find((p) => p.id === presetId);
  if (!preset) return next;
  for (const [key, val] of Object.entries(preset.perms || {})) {
    if (allowed.has(key) || key in STAFF_PERM_DEFAULTS) next[key] = Boolean(val);
  }
  return next;
}

/**
 * На существующего сотрудника: для ключей текущей сферы берём preset,
 * остальные ключи (чужие сферы) сохраняем из base.
 */
export function applyStaffRolePreset(basePerms, sphere, presetId) {
  const preset = staffRolePresetsForSphere(sphere).find((p) => p.id === presetId);
  if (!preset) return basePerms;
  const allowed = new Set(staffPermLabelsForSphere(sphere).map(([k]) => k));
  const next = { ...STAFF_PERM_DEFAULTS, ...(basePerms || {}) };
  for (const key of allowed) next[key] = false;
  for (const [key, val] of Object.entries(preset.perms || {})) {
    if (allowed.has(key)) next[key] = Boolean(val);
  }
  return next;
}

/** @deprecated используйте applyStaffRolePreset(base, "cafe_restaurant", id) */
export function applyCafeRolePreset(basePerms, presetId) {
  return applyStaffRolePreset(basePerms, "cafe_restaurant", presetId);
}

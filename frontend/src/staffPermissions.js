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

/** Пресеты прав для кафе — меньше путаницы кухня / зал / хостес. */
export const CAFE_STAFF_ROLE_PRESETS = [
  {
    id: "hall",
    label: "Зал (официант)",
    hint: "Заказы, статусы зала, посадка. Без кухни и меню.",
    perms: { cafe_orders: true, cafe_kitchen: false, cafe_seating: true, cafe_delivery: false, cafe_menu: false, cafe_settings: false },
  },
  {
    id: "kitchen",
    label: "Кухня",
    hint: "Только кухня: готовится / готов. Без записи заказов за столом.",
    perms: { cafe_orders: false, cafe_kitchen: true, cafe_seating: false, cafe_delivery: false, cafe_menu: false, cafe_settings: false },
  },
  {
    id: "hostess",
    label: "Хостес",
    hint: "Посадка и карта столов. Заказы — у официанта.",
    perms: { cafe_orders: false, cafe_kitchen: false, cafe_seating: true, cafe_delivery: false, cafe_menu: false, cafe_settings: false },
  },
  {
    id: "courier",
    label: "Курьер",
    hint: "Доставка: статусы курьера.",
    perms: { cafe_orders: false, cafe_kitchen: false, cafe_seating: false, cafe_delivery: true, cafe_menu: false, cafe_settings: false },
  },
];

export function applyCafeRolePreset(basePerms, presetId) {
  const preset = CAFE_STAFF_ROLE_PRESETS.find((p) => p.id === presetId);
  if (!preset) return basePerms;
  return { ...basePerms, ...preset.perms };
}

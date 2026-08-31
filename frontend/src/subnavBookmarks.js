/** Закладки верхней панели / пункты меню (вынесено из App.jsx). */

export const SUBNAV_BOOKMARKS_KEY = "vmeste_subnav_bookmarks_v1";

/** Закладки верхней панели / пункты меню (id → метаданные). */
export const BOOKMARK_CATALOG = [
  { id: "client_map", label: "Карта", roles: ["client", "provider"] },
  { id: "bookings", label: "Записи", labelClient: "Мои записи", roles: ["client", "provider", "staff"] },
  { id: "my_bookings", label: "Мои записи", roles: ["provider"] },
  { id: "reviews", label: "Отзывы", roles: ["provider", "staff"] },
  { id: "intervals", label: "Календарь интервалов", roles: ["provider", "staff"], menuIcon: "calendar" },
  { id: "services", label: "Услуги и категории", roles: ["provider", "staff"], menuIcon: "services" },
  { id: "chats", label: "Чаты", roles: ["client", "provider", "staff"] },
  { id: "service_apps", label: "Сервисы", roles: ["client", "provider", "staff"] },
  { id: "settings", label: "Настройки", roles: ["client", "provider", "staff"] },
  { id: "profile", label: "Личный кабинет", roles: ["client", "provider", "staff"] },
  { id: "booking_history", label: "История записей", roles: ["client", "provider", "staff"] },
  { id: "subscriptions", label: "Подписки", roles: ["provider", "staff"] },
  { id: "staff", label: "Сотрудники", roles: ["provider"] },
  { id: "organization", label: "Организация", roles: ["provider"] },
  { id: "cafe", label: "Зал и меню", roles: ["provider", "staff"] },
  { id: "cafe_orders", label: "Заказы", roles: ["provider", "staff"] },
  { id: "cafe_my_orders", label: "Заказы из ресторанов", roles: ["client"] },
  { id: "activity", label: "Моё", roles: ["client"] },
  { id: "loyalty", label: "Лояльность", roles: ["client"] },
  { id: "inspections", label: "Приёмка", roles: ["client", "provider", "staff"] },
  { id: "marketplaces", label: "Маркетплейсы", roles: ["provider"], menuIcon: "market" },
  { id: "analytics", label: "Аналитика", roles: ["provider", "staff"], menuIcon: "analytics" },
];

export const DEFAULT_SUBNAV_BOOKMARKS = {
  client: ["client_map", "activity", "service_apps", "chats"],
  provider: ["bookings", "client_map", "analytics", "my_bookings", "service_apps", "chats"],
  staff: ["bookings", "reviews", "analytics", "service_apps", "chats"],
  provider_cafe: ["cafe_orders", "cafe", "reviews", "analytics", "client_map", "chats"],
  staff_cafe: ["cafe_orders", "cafe", "analytics", "chats"],
  provider_service: ["bookings", "client_map", "my_bookings", "analytics", "chats", "inspections"],
  provider_salon: ["bookings", "client_map", "my_bookings", "analytics", "chats"],
  provider_marketplaces: ["marketplaces", "analytics", "reviews", "chats"],
};

export function defaultSubnavBookmarks(role, sphere) {
  if (role === "provider" && sphere === "cafe_restaurant") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.provider_cafe];
  }
  if (role === "staff" && sphere === "cafe_restaurant") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.staff_cafe];
  }
  if (role === "provider" && sphere === "service_center") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.provider_service];
  }
  if (role === "provider" && sphere === "hair_salon") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.provider_salon];
  }
  if (role === "provider" && sphere === "marketplaces") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.provider_marketplaces];
  }
  if (role === "client") {
    return [...DEFAULT_SUBNAV_BOOKMARKS.client];
  }
  return [...(DEFAULT_SUBNAV_BOOKMARKS[role] || DEFAULT_SUBNAV_BOOKMARKS.client)];
}

export function loadSubnavBookmarks(role, sphere) {
  const fallback = defaultSubnavBookmarks(role, sphere);
  try {
    const raw = localStorage.getItem(SUBNAV_BOOKMARKS_KEY);
    if (!raw) return [...fallback];
    const all = JSON.parse(raw);
    const list = all?.[role];
    if (!Array.isArray(list) || !list.length) return [...fallback];
    const allowed = new Set(
      BOOKMARK_CATALOG.filter((b) => b.roles.includes(role)).map((b) => b.id)
    );
    let next = list.filter((id) => allowed.has(id));
    if (role === "client") {
      if (!next.includes("activity")) {
        next = ["activity", ...next.filter((id) => !["bookings", "activity"].includes(id))];
      }
    }
    if (role === "provider" && sphere === "cafe_restaurant") {
      next = next.filter((id) => id !== "bookings");
      if (!next.includes("cafe_orders")) next = ["cafe_orders", ...next];
      else {
        next = ["cafe_orders", ...next.filter((id) => id !== "cafe_orders")];
      }
      if (!next.includes("cafe")) {
        const i = Math.max(0, next.indexOf("cafe_orders"));
        next = [...next.slice(0, i + 1), "cafe", ...next.slice(i + 1)];
      }
      if (!next.includes("client_map")) next = [...next, "client_map"];
      if (!next.includes("my_bookings")) next = [...next, "my_bookings"];
    }
    if (role === "staff" && sphere === "cafe_restaurant") {
      next = next.filter((id) => id !== "bookings" && id !== "intervals" && id !== "services");
      if (!next.includes("cafe_orders")) next = ["cafe_orders", ...next];
      else next = ["cafe_orders", ...next.filter((id) => id !== "cafe_orders")];
    }
    if (role === "provider" && sphere === "marketplaces") {
      next = next.filter(
        (id) =>
          id !== "bookings" &&
          id !== "intervals" &&
          id !== "services" &&
          id !== "my_bookings",
      );
      if (!next.includes("marketplaces")) next = ["marketplaces", ...next];
      else next = ["marketplaces", ...next.filter((id) => id !== "marketplaces")];
    }
    return next.length ? next : [...fallback];
  } catch {
    return [...fallback];
  }
}

export function bookmarkLabel(id, role, sphere) {
  const b = BOOKMARK_CATALOG.find((x) => x.id === id);
  if (!b) return id;
  if (role === "client" && b.labelClient) return b.labelClient;
  return b.label;
}

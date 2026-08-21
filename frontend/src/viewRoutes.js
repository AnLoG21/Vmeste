/** Sync app views with URL paths for shareable links. */

export const VIEW_PATHS = {
  profile: "/cabinet",
  settings: "/settings",
  subscriptions: "/subscriptions",
  organization: "/organization",
  cafe: "/cafe",
  cafe_orders: "/cafe-orders",
  my_bookings: "/my-bookings",
  staff: "/staff",
  reviews: "/reviews",
  bookings: "/bookings",
  intervals: "/intervals",
  chats: "/chats",
  analytics: "/analytics",
  inspections: "/inspections",
  marketplaces: "/marketplaces",
  client_map: "/map",
  activity: "/activity",
  client_book: "/book",
  cafe_my_orders: "/cafe-orders-mine",
  loyalty: "/loyalty",
  client_bookings: "/my-bookings",
  client_reviews: "/my-reviews",
};

const PATH_TO_VIEW = Object.fromEntries(Object.entries(VIEW_PATHS).map(([k, v]) => [v, k]));

export function pathForView(view) {
  return VIEW_PATHS[view] || "/";
}

export function viewFromPath(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/" || path === "") return null;
  return PATH_TO_VIEW[path] || null;
}

/** Paths that load the App shell but are not cabinet views (email links, etc.). */
export const APP_SHELL_PATHS = new Set(["/verify-email", "/confirm-password-change", "/reset-password"]);

export function shouldLoadApp(pathname) {
  const path = (pathname || "/").replace(/\/+$/, "") || "/";
  if (path === "/") return true;
  if (APP_SHELL_PATHS.has(path)) return true;
  return Boolean(viewFromPath(path));
}

export function navigateView(view, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const path = pathForView(view);
  const url = `${path}${window.location.search || ""}`;
  if (replace) window.history.replaceState({ view }, "", url);
  else if (window.location.pathname !== path) window.history.pushState({ view }, "", url);
}

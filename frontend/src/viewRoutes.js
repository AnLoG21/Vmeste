/** Sync app views with URL paths for shareable links. */

export const VIEW_PATHS = {
  profile: "/cabinet",
  settings: "/settings",
  subscriptions: "/subscriptions",
  organization: "/organization",
  staff: "/staff",
  reviews: "/reviews",
  bookings: "/bookings",
  intervals: "/intervals",
  chats: "/chats",
  client_map: "/map",
  client_book: "/book",
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

export function navigateView(view, { replace = false } = {}) {
  if (typeof window === "undefined") return;
  const path = pathForView(view);
  const url = `${path}${window.location.search || ""}`;
  if (replace) window.history.replaceState({ view }, "", url);
  else if (window.location.pathname !== path) window.history.pushState({ view }, "", url);
}

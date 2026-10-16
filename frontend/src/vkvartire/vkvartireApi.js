/** API helpers for Вквартире */

export async function vkvartireFetch(authFetch, API_URL, path, options = {}) {
  const res = await authFetch(`${API_URL}/vkvartire${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail || err.message || `Ошибка ${res.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) return null;
  return res.json();
}

export function filtersToQuery(filters = {}) {
  const q = new URLSearchParams();
  if (filters.deal_type) q.set("deal_type", filters.deal_type);
  if (filters.rooms != null && filters.rooms !== "") {
    const rooms = Array.isArray(filters.rooms) ? filters.rooms.join(",") : String(filters.rooms);
    if (rooms) q.set("rooms", rooms);
  }
  if (filters.price_min != null && filters.price_min !== "") q.set("price_min", String(filters.price_min));
  if (filters.price_max != null && filters.price_max !== "") q.set("price_max", String(filters.price_max));
  if (filters.area_min != null && filters.area_min !== "") q.set("area_min", String(filters.area_min));
  if (filters.area_max != null && filters.area_max !== "") q.set("area_max", String(filters.area_max));
  if (filters.floor_min != null && filters.floor_min !== "") q.set("floor_min", String(filters.floor_min));
  if (filters.floor_max != null && filters.floor_max !== "") q.set("floor_max", String(filters.floor_max));
  if (filters.no_agents) q.set("no_agents", "1");
  if (filters.q) q.set("q", filters.q);
  if (filters.anchor_lat != null && filters.anchor_lon != null) {
    q.set("anchor_lat", String(filters.anchor_lat));
    q.set("anchor_lon", String(filters.anchor_lon));
  }
  if (filters.max_commute_min) q.set("max_commute_min", String(filters.max_commute_min));
  if (filters.commute_mode) q.set("commute_mode", filters.commute_mode);
  if (filters.page) q.set("page", String(filters.page));
  if (filters.page_size) q.set("page_size", String(filters.page_size));
  return q.toString();
}

export function loadFeed(authFetch, API_URL, filters = {}) {
  const qs = filtersToQuery(filters);
  return vkvartireFetch(authFetch, API_URL, `/feed/${qs ? `?${qs}` : ""}`);
}

export function loadMapPins(authFetch, API_URL, filters = {}) {
  const qs = filtersToQuery(filters);
  return vkvartireFetch(authFetch, API_URL, `/map/${qs ? `?${qs}` : ""}`);
}

export function loadListing(authFetch, API_URL, id) {
  return vkvartireFetch(authFetch, API_URL, `/listings/${id}/`);
}

export function loadFavorites(authFetch, API_URL) {
  return vkvartireFetch(authFetch, API_URL, "/favorites/");
}

export function addFavorite(authFetch, API_URL, listingId) {
  return vkvartireFetch(authFetch, API_URL, "/favorites/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ listing_id: listingId }),
  });
}

export function removeFavorite(authFetch, API_URL, listingId) {
  return vkvartireFetch(authFetch, API_URL, `/favorites/?listing_id=${listingId}`, {
    method: "DELETE",
  });
}

export function loadSavedSearches(authFetch, API_URL) {
  return vkvartireFetch(authFetch, API_URL, "/saved-searches/");
}

export function createSavedSearch(authFetch, API_URL, { name, filters, notify }) {
  return vkvartireFetch(authFetch, API_URL, "/saved-searches/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, filters, notify: Boolean(notify) }),
  });
}

export function deleteSavedSearch(authFetch, API_URL, id) {
  return vkvartireFetch(authFetch, API_URL, `/saved-searches/${id}/`, {
    method: "DELETE",
  });
}

/** Merge saved filters into DEFAULT_FILTERS shape. */
export function filtersFromSaved(savedFilters, defaults) {
  const base = { ...defaults };
  const src = savedFilters && typeof savedFilters === "object" ? savedFilters : {};
  for (const key of Object.keys(base)) {
    if (src[key] !== undefined) base[key] = src[key];
  }
  if (!Array.isArray(base.rooms)) {
    base.rooms = base.rooms === "" || base.rooms == null ? [] : [Number(base.rooms)].filter((n) => !Number.isNaN(n));
  }
  return base;
}

export const DEFAULT_FILTERS = {
  deal_type: "rent",
  rooms: [],
  price_min: "",
  price_max: "",
  area_min: "",
  area_max: "",
  floor_min: "",
  floor_max: "",
  no_agents: false,
  q: "",
  anchor_lat: null,
  anchor_lon: null,
  anchor_label: "",
  max_commute_min: "",
  commute_mode: "walk",
};

export const ROOM_OPTIONS = [
  { value: 0, label: "Студия" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
  { value: 5, label: "5+" },
];

export const SOURCE_LABELS = {
  manual: "Вместе",
  avito: "Avito",
  cian: "Циан",
  other: "Другое",
};

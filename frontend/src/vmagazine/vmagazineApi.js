/** API helpers for Вмагазине microservice. */

export async function vmagazineFetch(authFetch, API_URL, path, options = {}) {
  const res = await authFetch(`${API_URL}/vmagazine${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Ошибка ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export function searchShops(authFetch, API_URL, params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.lat != null && params.lat !== "") q.set("lat", String(params.lat));
  if (params.lon != null && params.lon !== "") q.set("lon", String(params.lon));
  const qs = q.toString();
  return vmagazineFetch(authFetch, API_URL, `/shops/${qs ? `?${qs}` : ""}`);
}

export function loadFavorites(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/favorites/");
}

export function addFavorite(authFetch, API_URL, providerId) {
  return vmagazineFetch(authFetch, API_URL, "/favorites/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider_id: providerId }),
  });
}

export function removeFavorite(authFetch, API_URL, providerId) {
  return vmagazineFetch(authFetch, API_URL, `/favorites/?provider_id=${providerId}`, {
    method: "DELETE",
  });
}

export function loadMyOrders(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/my-orders/");
}

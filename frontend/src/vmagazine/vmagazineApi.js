/** API helpers for Вмагазине */

export async function vmagazineFetch(authFetch, API_URL, path, options = {}) {
  const res = await authFetch(`${API_URL}/vmagazine${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Ошибка ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

function emitCartChanged() {
  try {
    window.dispatchEvent(new CustomEvent("vmag:cart-changed"));
  } catch {
    /* ignore */
  }
}

export function loadHome(authFetch, API_URL, { originals } = {}) {
  const q = originals ? "?originals=1" : "";
  return vmagazineFetch(authFetch, API_URL, `/home/${q}`);
}

export function searchSuggest(authFetch, API_URL, params = {}) {
  const q = new URLSearchParams();
  if (params.q) q.set("q", params.q);
  if (params.originals) q.set("originals", "1");
  if (params.sort) q.set("sort", params.sort);
  return vmagazineFetch(authFetch, API_URL, `/search/suggest/?${q}`);
}

export function loadProductDetail(authFetch, API_URL, productId) {
  return vmagazineFetch(authFetch, API_URL, `/products/${productId}/`);
}

export function loadProductLikes(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/product-likes/");
}

export function likeProduct(authFetch, API_URL, productId) {
  return vmagazineFetch(authFetch, API_URL, "/product-likes/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ product_id: productId }),
  });
}

export function unlikeProduct(authFetch, API_URL, productId) {
  return vmagazineFetch(authFetch, API_URL, `/product-likes/?product_id=${productId}`, {
    method: "DELETE",
  });
}

export function loadCart(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/cart/");
}

export async function setCartItem(authFetch, API_URL, productId, quantity, useBonuses, selectedSize) {
  const body = { product_id: productId, quantity };
  if (useBonuses != null) body.use_bonuses = useBonuses;
  if (selectedSize != null) body.selected_size = selectedSize;
  const data = await vmagazineFetch(authFetch, API_URL, "/cart/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  emitCartChanged();
  return data;
}

export async function removeCartItem(authFetch, API_URL, productId) {
  const data = await vmagazineFetch(authFetch, API_URL, `/cart/?product_id=${productId}`, {
    method: "DELETE",
  });
  emitCartChanged();
  return data;
}

export function trackProductView(authFetch, API_URL, productId) {
  return vmagazineFetch(authFetch, API_URL, `/products/${productId}/view/`, { method: "POST", body: "{}" });
}

export function loadRecentlyViewed(authFetch, API_URL, { all } = {}) {
  return vmagazineFetch(authFetch, API_URL, `/recently-viewed/${all ? "?all=1" : ""}`);
}

export function loadAddresses(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/addresses/");
}

export function saveAddress(authFetch, API_URL, payload) {
  return vmagazineFetch(authFetch, API_URL, "/addresses/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function updateAddress(authFetch, API_URL, payload) {
  return vmagazineFetch(authFetch, API_URL, "/addresses/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function loadBonuses(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/bonuses/");
}

export function loadPaymentCards(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/payment-cards/");
}

export function savePaymentCard(authFetch, API_URL, payload) {
  return vmagazineFetch(authFetch, API_URL, "/payment-cards/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function deletePaymentCard(authFetch, API_URL, id) {
  return vmagazineFetch(authFetch, API_URL, `/payment-cards/?id=${id}`, { method: "DELETE" });
}

export function deleteAddress(authFetch, API_URL, id) {
  return vmagazineFetch(authFetch, API_URL, `/addresses/?id=${id}`, { method: "DELETE" });
}

export function loadProfileHub(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/profile/");
}

export function loadMyOrders(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/my-orders/");
}

export function loadReturns(authFetch, API_URL) {
  return vmagazineFetch(authFetch, API_URL, "/returns/");
}

export function createReturn(authFetch, API_URL, { order_id, order_item_id, reason, photos }) {
  const fd = new FormData();
  fd.append("order_id", String(order_id));
  fd.append("order_item_id", String(order_item_id));
  fd.append("reason", reason || "");
  for (const file of photos || []) {
    if (file) fd.append("photos", file);
  }
  return vmagazineFetch(authFetch, API_URL, "/returns/", {
    method: "POST",
    body: fd,
  });
}

export function requestAuthenticity(authFetch, API_URL, productId, note) {
  return vmagazineFetch(authFetch, API_URL, `/products/${productId}/authenticity/request/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ note: note || "" }),
  });
}

export function verifyAuthenticity(authFetch, API_URL, productId, action = "verify") {
  return vmagazineFetch(authFetch, API_URL, `/products/${productId}/authenticity/verify/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
}

/** Auth + Вмагазине API mocks for E2E. */

const ME = {
  id: 521,
  username: "e2e-vmag",
  role: "client",
  first_name: "Маг",
  last_name: "Тест",
  email: "e2e-vmag@example.com",
  profile_complete: true,
  needs_credentials_setup: false,
  email_verified: true,
  has_usable_password: true,
};

export const VMAG_PRODUCT = {
  id: 9201,
  name: "Кружка E2E",
  price: "350.00",
  unit: "шт",
  provider_id: 922,
  provider_name: "Лавка E2E",
  organization_slug: "lavka-e2e",
  cover_url: "",
  photos: [],
  liked: false,
  is_original: false,
  authenticity_status: "",
  authenticity_note: "",
  sizes: [],
  attrs: {},
  description: "Тестовая кружка",
  related: [],
  bonus_earn_hint: "",
  provider_reviews_count: 0,
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ products?: object[], cart?: object[] }} [options]
 */
export async function installVmagazineMocks(page, { products = null, cart = null } = {}) {
  const catalog = Array.isArray(products) ? products.map((p) => ({ ...p })) : [{ ...VMAG_PRODUCT }];
  let cartItems = Array.isArray(cart)
    ? cart.map((c) => ({ ...c }))
    : [];

  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  await page.route("**/api/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const method = req.method();

    const json = (data, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(data),
      });

    if (path.endsWith("/auth/token/refresh") && method === "POST") {
      return json({ access: "e2e-access-token" });
    }
    if (path.endsWith("/users/me") && method === "GET") {
      return json(ME);
    }
    if (path.includes("/subscriptions/") && method === "GET") {
      return json([]);
    }
    if (path.includes("/notifications/") && method === "GET") {
      return json([]);
    }
    if (path.endsWith("/vmagazine/home") && method === "GET") {
      return json({ addresses: [], recommended: catalog });
    }
    if (path.endsWith("/vmagazine/cart") && method === "GET") {
      return json(cartItems);
    }
    if (path.endsWith("/vmagazine/cart") && method === "POST") {
      let body = {};
      try {
        body = JSON.parse(req.postData() || "{}");
      } catch {
        body = {};
      }
      const pid = Number(body.product_id);
      const qty = Number(body.quantity) || 1;
      const product = catalog.find((p) => Number(p.id) === pid) || { ...VMAG_PRODUCT, id: pid };
      const existing = cartItems.find((c) => Number(c.product?.id) === pid);
      if (existing) {
        existing.quantity = qty;
        return json({ id: existing.id, quantity: qty, use_bonuses: false, selected_size: "" });
      }
      const row = {
        id: 7000 + cartItems.length,
        quantity: qty,
        use_bonuses: false,
        selected_size: "",
        product,
        bonus_balance: "0",
      };
      cartItems.push(row);
      return json({ id: row.id, quantity: qty, use_bonuses: false, selected_size: "" }, 201);
    }
    const productMatch = path.match(/\/vmagazine\/products\/(\d+)$/);
    if (productMatch && method === "GET") {
      const id = Number(productMatch[1]);
      const product = catalog.find((p) => Number(p.id) === id) || { ...VMAG_PRODUCT, id };
      return json(product);
    }
    if (path.match(/\/vmagazine\/products\/\d+\/view$/) && method === "POST") {
      return json(VMAG_PRODUCT);
    }
    if (path.endsWith("/vmagazine/favorites") && method === "GET") {
      return json({ items: [] });
    }
    if (path.endsWith("/vmagazine/product-likes") && method === "GET") {
      return json({ items: [] });
    }
    if (path.endsWith("/vmagazine/profile") && method === "GET") {
      return json({ orders: [], addresses: [], bonuses: [] });
    }
    if (path.includes("/vmagazine/") && method === "GET") {
      return json([]);
    }
    if (method === "GET") {
      return json([]);
    }
    if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
      return json({ ok: true });
    }
    return json({ detail: `unmocked ${method} ${path}` }, 404);
  });
}

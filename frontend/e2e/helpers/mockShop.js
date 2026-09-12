/** Shared mocks for public shop checkout E2E. */

const SLUG = "e2e-shop";
const PRODUCT = {
  id: 501,
  name: "Футболка",
  price: "1000.00",
  stock_qty: "10",
  is_active: true,
  photos: [],
  sizes: [],
  attrs: {},
};

export async function installShopMocks(page, { online = true } = {}) {
  await page.addInitScript(() => {
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

    if (path.match(new RegExp(`/shop/public/${SLUG}$`)) && method === "GET") {
      return json({
        provider: {
          id: 301,
          organization_name: "Магазин E2E",
          slug: SLUG,
          sphere: "shops",
          logo_url: "",
        },
        settings: {
          enable_pickup: true,
          enable_delivery: false,
          accept_online_payment: true,
          delivery_options: [],
          delivery_zones: [],
        },
        categories: [],
        products: [PRODUCT],
      });
    }
    if (path.match(new RegExp(`/shop/public/${SLUG}/order/\\d+$`)) && method === "GET") {
      return json({
        id: 9003,
        status: "paid",
        total: "1000.00",
      });
    }
    if (path.includes(`/shop/public/${SLUG}/order`) && method === "POST") {
      return json(
        {
          order_id: 9003,
          total: "1000.00",
          status: online ? "awaiting_payment" : "paid",
          confirmation_url: online ? "https://pay.example/shop" : "",
          payment_method: online ? "online" : "cash",
        },
        201,
      );
    }
    if (path.includes("/reviews")) return json([]);
    return json({});
  });
}

export { SLUG, PRODUCT };

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

const ZONE_SQUARE = [
  [55.0, 37.0],
  [55.0, 38.0],
  [56.0, 38.0],
  [56.0, 37.0],
];

const ZONE_CENTER = {
  id: "z1",
  name: "Центр",
  fee: "150",
  min_order: "0",
  polygon: ZONE_SQUARE,
};

export async function installShopMocks(
  page,
  { online = true, delivery = false, deliveryZones = null } = {},
) {
  const zones = Array.isArray(deliveryZones) ? deliveryZones : [];
  const hasZones = zones.length > 0;
  const optionFee = hasZones ? 150 : 200;

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
          latitude: 55.5,
          longitude: 37.5,
        },
        settings: {
          enable_pickup: true,
          enable_delivery: Boolean(delivery),
          accept_online_payment: true,
          delivery_fee: String(optionFee),
          delivery_min_order: "0",
          delivery_options: delivery
            ? [{ id: "own", label: "Свой курьер", fee: optionFee, eta: "1–3 часа" }]
            : [],
          delivery_zones: delivery ? zones : [],
        },
        categories: [],
        products: [PRODUCT],
      });
    }
    if (path.includes("/delivery-quote") && method === "GET") {
      return json({
        delivery_options: [{ id: "own", label: "Свой курьер", fee: optionFee, eta: "1–3 часа" }],
        distance_m: 1200,
      });
    }
    if (path.match(new RegExp(`/shop/public/${SLUG}/order/\\d+$`)) && method === "GET") {
      return json({
        id: 9003,
        status: "paid",
        total: delivery ? (hasZones ? "1150.00" : "1200.00") : "1000.00",
      });
    }
    if (path.includes(`/shop/public/${SLUG}/order`) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON?.() || JSON.parse(req.postData() || "{}");
      } catch {
        body = {};
      }
      const paymentMethod = String(body.payment_method || "online").toLowerCase();
      const isOnline = online && paymentMethod === "online";
      if (body.mode === "delivery" && !String(body.delivery_address || "").trim()) {
        return json({ detail: "Укажите адрес доставки" }, 400);
      }
      if (body.mode === "delivery" && hasZones) {
        const lat = Number(body.delivery_lat);
        const lon = Number(body.delivery_lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return json({ detail: "Укажите точку доставки на карте" }, 400);
        }
        const inside = lat >= 55 && lat <= 56 && lon >= 37 && lon <= 38;
        if (!inside) {
          return json({ detail: "Адрес вне зоны доставки" }, 400);
        }
      }
      const total =
        body.mode === "delivery" ? (hasZones ? "1150.00" : "1200.00") : "1000.00";
      return json(
        {
          order_id: 9003,
          total,
          status: isOnline ? "awaiting_payment" : "paid",
          confirmation_url: isOnline ? "https://pay.example/shop" : "",
          payment_method: isOnline ? "online" : paymentMethod,
        },
        201,
      );
    }
    if (path.includes("/reviews")) return json([]);
    return json([]);
  });
}

export { SLUG, PRODUCT, ZONE_CENTER, ZONE_SQUARE };

/** Shared mocks for cafe guest menu / checkout E2E. */

const SLUG = "e2e-cafe";
const SESSION = "e2e-cafe-session-token";
const MENU_ITEM = {
  id: 401,
  name: "Борщ",
  price: 500,
  is_active: true,
  is_available: true,
  photos: [],
  removable_ingredients: [],
};

const HOURS = Object.fromEntries(
  ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [
    d,
    { open: "00:00", close: "23:59", closed: false },
  ]),
);

function buildUnlock({ delivery = false } = {}) {
  return {
    session_token: SESSION,
    organization_name: "Кафе E2E",
    provider_slug: SLUG,
    table_label: "",
    is_open: true,
    modes: {
      dine_in: false,
      takeaway: !delivery,
      delivery: Boolean(delivery),
    },
    pay_methods: { online: true, cash: true, card_on_spot: false },
    delivery_fee: delivery ? "120" : "0",
    delivery_min_order: "0",
    delivery_zones: [],
    delivery_info: "",
    working_hours: HOURS,
  };
}

export async function installCafeMocks(page, { prepay = true, delivery = false } = {}) {
  const unlock = buildUnlock({ delivery });

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

    if (path.includes(`/cafe/m/${SLUG}`) && method === "GET") {
      return json({
        organization_name: "Кафе E2E",
        provider_slug: SLUG,
        organization_address: "Москва",
        logo_url: "",
        need_pin: false,
        is_open: true,
        modes: unlock.modes,
        working_hours: HOURS,
      });
    }
    if (path.includes(`/cafe/m/${SLUG}`) && method === "POST") {
      return json(unlock);
    }
    if (path.includes("/cafe/guest/menu") && method === "GET") {
      return json({
        categories: [{ id: 1, name: "Супы", items: [MENU_ITEM] }],
        table_label: "",
        organization_name: "Кафе E2E",
      });
    }
    if (path.match(/\/cafe\/guest\/order\/\d+$/) && method === "GET") {
      return json({
        id: 9002,
        status: "paid",
        total: "515.00",
        confirmation_url: "",
        can_rate: false,
        items: [{ id: 1, menu_item: MENU_ITEM.id, name: MENU_ITEM.name }],
        item_ratings: [],
      });
    }
    if (path.includes("/cafe/guest/order") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON?.() || JSON.parse(req.postData() || "{}");
      } catch {
        body = {};
      }
      const payMethod = String(body.pay_method || "online");
      const wantsPay = prepay && payMethod === "online";
      if (delivery && body.mode === "delivery" && !String(body.delivery_address || "").trim()) {
        return json({ delivery_address: ["Укажите адрес доставки."] }, 400);
      }
      return json(
        {
          id: 9002,
          status: wantsPay ? "awaiting_payment" : "accepted",
          total: wantsPay ? "635.00" : "635.00",
          confirmation_url: wantsPay ? "https://pay.example/cafe" : "",
          can_rate: false,
          items: [],
          delivery_fee: delivery ? "120.00" : "0",
        },
        201,
      );
    }
    return json({});
  });
}

export { SLUG, SESSION, MENU_ITEM };

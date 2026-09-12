/** Provider auth + subscription API mocks for E2E. */

const ME = {
  id: 601,
  username: "e2e-provider",
  role: "provider",
  first_name: "Орг",
  last_name: "Тест",
  email: "e2e-provider@example.com",
  profile_complete: true,
  needs_credentials_setup: false,
  provider_sphere: "hair_salon",
  organization_name: "Салон E2E Sub",
  organization_slug: "e2e-sub-salon",
  platform_tour_completed: true,
};

const PLAN = {
  id: 11,
  slug: "business",
  name: "Бизнес",
  price_monthly: "1990.00",
  plan_type: "paid",
  product_kind: "platform",
  is_active: true,
  features: [],
};

const ACTIVE_SUB = {
  id: 77,
  plan: PLAN,
  status: "active",
  source: "paid",
  is_active_now: true,
  period_start: new Date().toISOString(),
  period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
  auto_renew: true,
  cancel_at_period_end: false,
};

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ forPay?: boolean, waitlist?: object[] }} [options]
 */
export async function installProviderMocks(page, { forPay = false, waitlist = null } = {}) {
  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  let mineSubs = forPay ? [] : [{ ...ACTIVE_SUB }];
  let waitlistRows = Array.isArray(waitlist) ? waitlist.map((r) => ({ ...r })) : [];

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
    if (path.endsWith("/users/me") && method === "GET") return json(ME);
    if (path.includes("/users/roles")) return json([{ key: "provider", value: "Организация" }]);
    if (path.includes("/users/spheres")) {
      return json([{ key: "hair_salon", value: "Салон красоты" }]);
    }
    if (path.includes("/subscriptions/confirm") && method === "POST") {
      return json({
        detail: "Оплата подтверждена.",
        subscription: ACTIVE_SUB,
      });
    }
    // Must be before /subscriptions/payments — path includes("/subscriptions/pay") would match both.
    if (path.endsWith("/subscriptions/pay") && method === "POST") {
      return json({
        detail: "Перейдите к оплате.",
        confirmation_url: "https://pay.example/subscription",
        payment_id: 99,
      });
    }
    if (path.endsWith("/subscriptions/promo") && method === "POST") {
      const promoSub = {
        ...ACTIVE_SUB,
        id: 88,
        source: "promo",
        promo_code: "VSEVMESTE",
        auto_renew: false,
        is_active_now: true,
      };
      mineSubs = [promoSub];
      return json({
        detail: "Промокод применён: 1 месяц «Бизнес» бесплатно.",
        subscription: promoSub,
      });
    }
    if (path.endsWith("/subscriptions/cancel") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const immediate = Boolean(body.immediate);
      const cancelled = {
        ...ACTIVE_SUB,
        auto_renew: false,
        cancel_at_period_end: !immediate,
        status: immediate ? "cancelled" : "active",
        is_active_now: !immediate,
      };
      mineSubs = [cancelled];
      return json({
        detail: immediate
          ? "Подписка отключена."
          : "Автопродление отключено. Подписка действует до конца периода.",
        subscription: cancelled,
        refunded: false,
      });
    }
    if (path.includes("/subscriptions/plans")) return json([PLAN]);
    if (path.includes("/subscriptions/mine")) {
      return json({ subscriptions: mineSubs, trial_used: true, promo_used_codes: [] });
    }
    if (path.includes("/subscriptions/payments")) {
      return json(
        forPay
          ? []
          : [
              {
                id: 42,
                plan: PLAN,
                amount: "1990.00",
                status: "succeeded",
                created_at: new Date().toISOString(),
              },
            ],
      );
    }
    if (path.includes("/locations")) return json([]);
    if (path.includes("/booking/staff")) return json([]);
    if (path.includes("/booking/slots")) return json([]);
    if (path.match(/\/booking\/waitlist\/\d+$/) && method === "PATCH") {
      const id = Number(path.split("/").pop());
      waitlistRows = waitlistRows.map((r) =>
        Number(r.id) === id ? { ...r, status: "cancelled" } : r,
      );
      return json(waitlistRows.find((r) => Number(r.id) === id) || { id, status: "cancelled" });
    }
    if (path.includes("/booking/waitlist") && method === "GET") {
      return json(waitlistRows);
    }
    if (path.includes("/booking")) return json([]);
    if (path.includes("/catalog/")) return json([]);
    if (path.includes("/chat/")) return json([]);
    if (path.includes("/notifications")) return json([]);
    if (path.includes("/organization-profile")) {
      return json({
        organization_name: ME.organization_name,
        organization_slug: ME.organization_slug,
        provider_sphere: ME.provider_sphere,
        phones: [],
      });
    }
    if (path.includes("/health")) return json({ status: "ok", checks: { db: true } });
    // Prefer empty lists over {} — many App loaders call .filter on arrays.
    return json([]);
  });
}

export { ME, PLAN, ACTIVE_SUB };

const WAITLIST_ENTRY = {
  id: 12,
  client_name: "Тест Клиент",
  service_name: "Стрижка",
  preferred_date: new Date().toISOString().slice(0, 10),
  status: "waiting",
};

export { WAITLIST_ENTRY };

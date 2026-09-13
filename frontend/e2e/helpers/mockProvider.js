/** Provider auth + subscription / booking API mocks for E2E. */

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

const ORG_BOOKING = (() => {
  const start = new Date();
  start.setHours(15, 0, 0, 0);
  if (start.getTime() <= Date.now()) {
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    id: 8001,
    status: "new",
    payment_status: "none",
    provider: ME.id,
    client: 501,
    client_display_name: "Тест Клиент",
    service: 301,
    service_name: "Стрижка",
    organization_name: ME.organization_name,
    slot_starts_at: start.toISOString(),
    slot_ends_at: end.toISOString(),
    created_at: new Date().toISOString(),
  };
})();

/**
 * @param {import('@playwright/test').Page} page
 * @param {{ forPay?: boolean, waitlist?: object[], bookings?: object[], conversations?: object[], packages?: object[], moyNalogConnected?: boolean, confirmError?: string|null, doneError?: string|null, cancelError?: string|null }} [options]
 */
export async function installProviderMocks(
  page,
  {
    forPay = false,
    waitlist = null,
    bookings = null,
    conversations = null,
    packages = null,
    moyNalogConnected = false,
    confirmError = null,
    doneError = null,
    cancelError = null,
  } = {},
) {
  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  let mineSubs = forPay ? [] : [{ ...ACTIVE_SUB }];
  let waitlistRows = Array.isArray(waitlist) ? waitlist.map((r) => ({ ...r })) : [];
  let bookingsList = Array.isArray(bookings) ? bookings.map((b) => ({ ...b })) : [];
  const conversationsPayload = Array.isArray(conversations)
    ? conversations.map((c) => ({ ...c }))
    : [];
  let packagesPayload = Array.isArray(packages) ? packages.map((p) => ({ ...p })) : [];
  let purchasesPayload = [];
  let mePayload = {
    ...ME,
    booking_confirm_message_default: "",
    booking_cancel_message_default: "",
    booking_done_message_default: "",
  };
  let calendarToken = "token-old";
  let moyStatus = moyNalogConnected
    ? {
        connected: true,
        enabled: true,
        inn: "971500759750",
        display_name: "ИП Тест",
        phone: "79991234567",
        connected_at: new Date().toISOString(),
        last_error: "",
      }
    : {
        connected: false,
        enabled: false,
        inn: "",
        display_name: "",
        phone: "",
        connected_at: null,
        last_error: "",
      };
  let messagingPayload = {
    remind_clients: true,
    remind_org: false,
    notify_org_on_new: false,
    notify_client_on_new: true,
    send_client_confirm_link: false,
    winback_enabled: false,
    winback_weeks: 4,
    winback_template: "",
    enable_telegram: false,
    enable_max: false,
    enable_whatsapp: false,
    enable_sms: false,
    enable_email: false,
    telegram_notify_chat_id: "",
    has_telegram: false,
    has_platform_telegram: true,
    has_org_telegram_token: false,
    max_notify_chat_id: "",
    has_max: false,
    wa_api_url: "https://api.green-api.com",
    wa_id_instance: "",
    has_whatsapp: false,
    has_sms_org: false,
    reminder_template: "",
    new_booking_template: "",
    client_new_booking_template: "",
  };
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
    if (path.endsWith("/users/me") && method === "GET") return json(mePayload);
    if (path.endsWith("/users/me") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      mePayload = { ...mePayload, ...body };
      return json(mePayload);
    }
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
    if (path.match(/\/booking\/\d+\/confirm$/) && method === "POST") {
      if (confirmError) {
        return json(
          {
            code: confirmError,
            detail:
              confirmError === "confirm_message_not_set"
                ? "Сообщение для подтверждения записи не задано."
                : confirmError === "prepay_required"
                  ? "Клиент ещё не внёс предоплату — подтвердить запись нельзя."
                  : "Ошибка подтверждения.",
          },
          400,
        );
      }
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "confirmed" } : b,
      );
      return json(bookingsList.find((b) => Number(b.id) === id) || { id, status: "confirmed" });
    }
    if (path.match(/\/booking\/\d+\/mark-no-show$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "no_show" } : b,
      );
      return json(bookingsList.find((b) => Number(b.id) === id) || { id, status: "no_show" });
    }
    if (path.match(/\/booking\/\d+\/mark-arrived$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "arrived" } : b,
      );
      return json(bookingsList.find((b) => Number(b.id) === id) || { id, status: "arrived" });
    }
    if (path.match(/\/booking\/\d+\/mark-done$/) && method === "POST") {
      if (doneError) {
        return json(
          {
            code: doneError,
            detail:
              doneError === "done_message_not_set"
                ? "Сообщение при отметке «услуга оказана» не задано."
                : doneError === "booking_not_started_yet"
                  ? "Отметить «услуга оказана» можно только после начала записи по времени."
                  : "Ошибка отметки.",
          },
          400,
        );
      }
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "done" } : b,
      );
      return json(bookingsList.find((b) => Number(b.id) === id) || { id, status: "done" });
    }
    if (path.match(/\/booking\/\d+\/cancel-by-org$/) && method === "POST") {
      if (cancelError) {
        return json(
          {
            code: cancelError,
            detail:
              cancelError === "cancel_message_not_set"
                ? "Сообщение об отмене записи не задано."
                : "Ошибка отмены.",
          },
          400,
        );
      }
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "cancelled" } : b,
      );
      return json(bookingsList.find((b) => Number(b.id) === id) || { id, status: "cancelled" });
    }
    if (path.match(/\/booking$/) && method === "GET") return json(bookingsList);
    if (path.includes("/booking/loyalty/settings") && method === "GET") {
      return json({
        enabled: false,
        points_per_visit: 1,
        points_per_100_rub: 0,
        rub_per_point: "1.00",
        welcome_bonus: 0,
      });
    }
    if (path.includes("/booking/loyalty/settings") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      return json({
        enabled: Boolean(body.enabled),
        points_per_visit: Number(body.points_per_visit) || 0,
        points_per_100_rub: Number(body.points_per_100_rub) || 0,
        rub_per_point: String(body.rub_per_point || "1"),
        welcome_bonus: Number(body.welcome_bonus) || 0,
      });
    }
    if (path.includes("/booking/client-packages") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const pkgId = Number(body.package) || 0;
      const offer = packagesPayload.find((p) => Number(p.id) === pkgId) || {
        id: pkgId,
        name: "Абонемент",
        visits_count: 5,
      };
      const sold = {
        id: 900 + purchasesPayload.length,
        provider: ME.id,
        client: 501,
        client_name: String(body.client || "клиент"),
        package: pkgId,
        package_name: offer.name,
        visits_total: Number(offer.visits_count) || 5,
        visits_remaining: Number(offer.visits_count) || 5,
        status: "active",
        note: String(body.note || ""),
      };
      purchasesPayload = [sold, ...purchasesPayload];
      return json(sold, 201);
    }
    if (path.includes("/booking/client-packages") && method === "GET") return json(purchasesPayload);
    if (/\/booking\/packages\/?$/.test(path) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 800 + packagesPayload.length,
        provider: ME.id,
        name: String(body.name || "Абонемент"),
        visits_count: Number(body.visits_count) || 1,
        price: String(body.price || "0"),
        validity_days: body.validity_days == null ? null : Number(body.validity_days),
        service_ids: Array.isArray(body.service_ids) ? body.service_ids : [],
        is_active: true,
      };
      packagesPayload = [...packagesPayload, created];
      return json(created, 201);
    }
    if (/\/booking\/packages\/?$/.test(path) && method === "GET") return json(packagesPayload);
    if (path.includes("/booking/messaging/telegram-link") && method === "GET") {
      return json({
        link_token: "e2e-org-tg",
        start_param: "org_e2e-org-tg",
        telegram_notify_chat_id: messagingPayload.telegram_notify_chat_id || "",
        linked: Boolean(messagingPayload.telegram_notify_chat_id),
        deep_link: "https://t.me/vmeste_e2e_bot?start=org_e2e-org-tg",
        bot_username: "vmeste_e2e_bot",
        hint: "",
      });
    }
    if (path.includes("/booking/messaging/telegram-link") && method === "DELETE") {
      messagingPayload = { ...messagingPayload, telegram_notify_chat_id: "" };
      return json({ ok: true, linked: false, telegram_notify_chat_id: "" });
    }
    if (path.includes("/booking/messaging") && method === "GET") {
      return json(messagingPayload);
    }
    if (path.includes("/booking/messaging") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      messagingPayload = { ...messagingPayload, ...body, telegram_bot_token: undefined };
      delete messagingPayload.telegram_bot_token;
      return json(messagingPayload);
    }
    if (path.includes("/booking/calendar/settings") && method === "POST") {
      calendarToken = "token-new";
      const ics = `https://vsevmeste.space/api/booking/calendar/${calendarToken}.ics`;
      return json({
        ics_url: ics,
        webcal_url: ics.replace("https://", "webcal://"),
        google_url: `https://calendar.google.com/calendar/r?cid=${ics}`,
        yandex_hint: "Яндекс Календарь → Добавить календарь",
      });
    }
    if (path.includes("/booking/calendar/settings") && method === "GET") {
      const ics = `https://vsevmeste.space/api/booking/calendar/${calendarToken}.ics`;
      return json({
        ics_url: ics,
        webcal_url: ics.replace("https://", "webcal://"),
        google_url: `https://calendar.google.com/calendar/r?cid=${ics}`,
        yandex_hint: "Яндекс Календарь → Добавить календарь",
      });
    }
    if (path.includes("/booking")) return json([]);
    if (path.includes("/moy-nalog/status") && method === "GET") return json(moyStatus);
    if (path.includes("/moy-nalog/status") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      if (!moyStatus.connected) return json({ detail: "Сначала подключите «Мой налог»" }, 400);
      moyStatus = { ...moyStatus, enabled: Boolean(body.enabled) };
      return json(moyStatus);
    }
    if (path.includes("/moy-nalog/receipts")) return json([]);
    if (path.includes("/moy-nalog/disconnect") && method === "POST") {
      moyStatus = {
        connected: false,
        enabled: false,
        inn: "",
        display_name: "",
        phone: "",
        connected_at: null,
        last_error: "",
      };
      return json(moyStatus);
    }
    if (path.includes("/moy-nalog/")) return json({});
    if (path.includes("/catalog/")) return json([]);
    if (path.includes("/chat/conversations") && method === "GET") {
      return json(conversationsPayload);
    }
    if (path.includes("/chat/messages") && method === "GET") return json([]);
    if (path.includes("/chat/activity")) {
      return json({
        pending_staff_invites: [],
        notifications: [],
        unread_notification_count: 0,
        pending_invite_count: 0,
        unread_chat_messages_count: 0,
        badge_count: 0,
      });
    }
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

const WAITLIST_ENTRY = {
  id: 12,
  client_name: "Тест Клиент",
  service_name: "Стрижка",
  preferred_date: new Date().toISOString().slice(0, 10),
  status: "waiting",
};

export { ME, PLAN, ACTIVE_SUB, WAITLIST_ENTRY, ORG_BOOKING };

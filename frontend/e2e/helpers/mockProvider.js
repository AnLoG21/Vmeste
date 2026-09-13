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
 * @param {{ forPay?: boolean, waitlist?: object[], bookings?: object[], conversations?: object[], packages?: object[], moyNalogConnected?: boolean, confirmError?: string|null, doneError?: string|null, cancelError?: string|null, staff?: object[], locations?: object[], catalogServices?: object[], catalogCategories?: object[], catalogSeeded?: boolean|null, slots?: object[], clients?: object[], reviews?: object[], providerSphere?: string|null, shopCategories?: object[], shopProducts?: object[], cafeOrders?: object[], shopOrders?: object[] }} [options]
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
    staff = null,
    locations = null,
    catalogServices = null,
    catalogCategories = null,
    catalogSeeded = null,
    slots = null,
    clients = null,
    reviews = null,
    providerSphere = null,
    shopCategories = null,
    shopProducts = null,
    cafeOrders = null,
    shopOrders = null,
  } = {},
) {
  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  await page.addInitScript(() => {
    window.ymaps = {
      ready(cb) {
        queueMicrotask(() => cb());
      },
      Map: class {
        constructor() {
          this.geoObjects = { add() {}, remove() {} };
          this.events = { add() {}, remove() {} };
          this.margin = { setDefaultMargin() {} };
        }
        destroy() {}
        setBounds() {}
        setCenter() {}
        getCenter() {
          return [55.75, 37.62];
        }
        getZoom() {
          return 12;
        }
      },
      Placemark: class {
        constructor() {
          this.events = { add() {} };
          this.geometry = { setCoordinates() {} };
        }
      },
      Clusterer: class {
        constructor() {
          this.events = { add() {} };
        }
        add() {}
        removeAll() {}
      },
    };
  });

  let mineSubs = forPay ? [] : [{ ...ACTIVE_SUB }];
  let waitlistRows = Array.isArray(waitlist) ? waitlist.map((r) => ({ ...r })) : [];
  let bookingsList = Array.isArray(bookings) ? bookings.map((b) => ({ ...b })) : [];
  let staffLinks = Array.isArray(staff) ? staff.map((s) => ({ ...s })) : [];
  let locationRows = Array.isArray(locations) ? locations.map((l) => ({ ...l })) : [];
  let galleryPhotos = [];
  let servicesPayload = Array.isArray(catalogServices) ? catalogServices.map((s) => ({ ...s })) : [];
  let categoriesPayload = Array.isArray(catalogCategories)
    ? catalogCategories.map((c) => ({ ...c }))
    : [];
  let catalogSeededFlag =
    catalogSeeded == null ? servicesPayload.length > 0 : Boolean(catalogSeeded);
  const conversationsPayload = Array.isArray(conversations)
    ? conversations.map((c) => ({ ...c }))
    : [];
  let packagesPayload = Array.isArray(packages) ? packages.map((p) => ({ ...p })) : [];
  let purchasesPayload = [];
  let slotsPayload = Array.isArray(slots) ? slots.map((s) => ({ ...s })) : [];
  let clientsPayload = Array.isArray(clients) ? clients.map((c) => ({ ...c })) : [];
  let migrateRequests = [];
  let reviewsPayload = Array.isArray(reviews) ? reviews.map((r) => ({ ...r })) : [];
  let cafeCategories = [];
  let cafeItemSeq = 9000;
  let cafeCatSeq = 8000;
  let cafeFloors = [];
  let cafeFloorSeq = 7000;
  let cafeTableSeq = 7100;
  let cafeOrdersPayload = Array.isArray(cafeOrders) ? cafeOrders.map((o) => ({ ...o })) : [];
  let cafeSettingsPayload = {
    enable_dine_in: true,
    enable_takeaway: true,
    enable_delivery: false,
    delivery_info: "",
    delivery_fee: "0",
    delivery_min_order: "0",
    delivery_zones: [],
    accept_online_payment: false,
    accept_cash: true,
    accept_card_on_spot: true,
    payment_provider: "yookassa",
    yookassa_shop_id: "",
    has_yookassa: false,
    has_payment_keys: false,
    logo_url: "",
    logo_thumb_url: "",
    updated_at: new Date().toISOString(),
  };
  let shopCategoriesPayload = Array.isArray(shopCategories) ? shopCategories.map((c) => ({ ...c })) : [];
  let shopProductsPayload = Array.isArray(shopProducts) ? shopProducts.map((p) => ({ ...p })) : [];
  let shopOrdersPayload = Array.isArray(shopOrders) ? shopOrders.map((o) => ({ ...o })) : [];
  let shopCatSeq = 8100;
  let shopProductSeq = 9200;
  let mePayload = {
    ...ME,
    anonymous_seat_count: 1,
    booking_confirm_message_default: "",
    booking_cancel_message_default: "",
    booking_done_message_default: "",
    organization_address: "Москва, ул. Старая, 1",
    organization_entrance: "",
    organization_floor: "",
    organization_apartment: "",
    organization_intercom: "",
    organization_address_extra: "",
    organization_latitude: "55.751244",
    organization_longitude: "37.618423",
  };
  if (providerSphere) {
    mePayload.provider_sphere = providerSphere;
    if (providerSphere === "cafe_restaurant") {
      mePayload.organization_name = "Кафе E2E";
      mePayload.organization_slug = "e2e-cafe";
    }
    if (providerSphere === "shops") {
      mePayload.organization_name = "Магазин E2E";
      mePayload.organization_slug = "e2e-shop";
    }
  }
  let calendarToken = "token-old";
  let acquiringPayload = {
    payment_provider: "yookassa",
    prepay_mode: "off",
    prepay_percent: 50,
    yookassa_shop_id: "",
    has_yookassa: false,
    tbank_terminal_key: "",
    has_tbank: false,
    cloudpayments_public_id: "",
    has_cloudpayments: false,
    robokassa_merchant_login: "",
    has_robokassa: false,
    has_payment_keys: false,
    providers: [
      { key: "yookassa", label: "ЮKassa" },
      { key: "tbank", label: "Т‑Банк" },
    ],
  };
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
    if (path.includes("/catalog/seed-catalog") && method === "GET") {
      return json({
        sphere: mePayload.provider_sphere || "hair_salon",
        sphere_label: "Салон красоты",
        has_template: true,
        catalog_seeded: catalogSeededFlag,
        total_services: servicesPayload.length,
        active_services: servicesPayload.filter((s) => s.is_active).length,
      });
    }
    if (path.includes("/catalog/seed-catalog") && method === "POST") {
      if (!categoriesPayload.length) {
        categoriesPayload = [{ id: 11, name: "Стрижки", provider: ME.id, subcategories: [] }];
      }
      if (!servicesPayload.length) {
        servicesPayload = [
          {
            id: 301,
            name: "Стрижка",
            price: "0.00",
            duration_minutes: 30,
            is_active: false,
            category: categoriesPayload[0].id,
            options: [],
            gallery: [],
          },
        ];
      }
      catalogSeededFlag = true;
      return json({
        stats: { services: servicesPayload.length, services_created: servicesPayload.length },
        sphere: mePayload.provider_sphere || "hair_salon",
        sphere_label: "Салон красоты",
        has_template: true,
        catalog_seeded: true,
        total_services: servicesPayload.length,
        active_services: servicesPayload.filter((s) => s.is_active).length,
      });
    }
    if (path.includes("/catalog/categories")) return json(categoriesPayload);
    {
      const optPhotoMatch = path.match(/\/catalog\/services\/(\d+)\/options\/(\d+)\/photos(?:\/(\d+))?$/);
      if (optPhotoMatch) {
        const svcId = Number(optPhotoMatch[1]);
        const optId = Number(optPhotoMatch[2]);
        const photoId = optPhotoMatch[3] ? Number(optPhotoMatch[3]) : null;
        const svc = servicesPayload.find((s) => Number(s.id) === svcId);
        const opts = Array.isArray(svc?.options) ? svc.options : [];
        const opt = opts.find((o) => Number(o.id) === optId);
        if (method === "DELETE" && photoId && opt) {
          opt.photos = (opt.photos || []).filter((p) => Number(p.id) !== photoId);
          return json({ ok: true });
        }
        if (method === "POST" && opt) {
          const ph = {
            id: 7000 + (opt.photos || []).length,
            image: "https://example.com/e2e-opt.png",
            thumb_url: "https://example.com/e2e-opt-thumb.png",
            sort_order: (opt.photos || []).length + 1,
          };
          opt.photos = [...(opt.photos || []), ph];
          return json(opt, 201);
        }
      }
      const optMatch = path.match(/\/catalog\/services\/(\d+)\/options(?:\/(\d+))?$/);
      if (optMatch) {
        const svcId = Number(optMatch[1]);
        const optId = optMatch[2] ? Number(optMatch[2]) : null;
        const svcIdx = servicesPayload.findIndex((s) => Number(s.id) === svcId);
        if (svcIdx < 0) return json({ detail: "Not found" }, 404);
        const svc = servicesPayload[svcIdx];
        let options = Array.isArray(svc.options) ? [...svc.options] : [];
        if (method === "GET" && optId == null) return json(options);
        if (method === "POST" && optId == null) {
          let body = {};
          try {
            body = req.postDataJSON() || {};
          } catch {
            body = {};
          }
          const created = {
            id: 401 + options.length,
            service: svcId,
            name: body.name || "Опция",
            price: String(body.price ?? 0),
            extra_minutes: Number(body.extra_minutes) || 0,
            is_active: body.is_active !== false,
            photos: [],
          };
          options = [...options, created];
          servicesPayload[svcIdx] = { ...svc, options };
          return json(created, 201);
        }
        if (optId != null && method === "PATCH") {
          let body = {};
          try {
            body = req.postDataJSON() || {};
          } catch {
            body = {};
          }
          options = options.map((o) =>
            Number(o.id) === optId
              ? {
                  ...o,
                  ...(body.name != null ? { name: body.name } : {}),
                  ...(body.price != null ? { price: String(body.price) } : {}),
                  ...(body.extra_minutes != null ? { extra_minutes: body.extra_minutes } : {}),
                  ...(body.is_active != null ? { is_active: Boolean(body.is_active) } : {}),
                }
              : o,
          );
          servicesPayload[svcIdx] = { ...svc, options };
          return json(options.find((o) => Number(o.id) === optId) || { id: optId, ...body });
        }
        if (optId != null && method === "DELETE") {
          options = options.filter((o) => Number(o.id) !== optId);
          servicesPayload[svcIdx] = { ...svc, options };
          return route.fulfill({ status: 204, body: "" });
        }
      }
      const photoMatch = path.match(/\/catalog\/services\/(\d+)\/photos(?:\/(\d+))?$/);
      if (photoMatch) {
        const svcId = Number(photoMatch[1]);
        const photoId = photoMatch[2] ? Number(photoMatch[2]) : null;
        const svcIdx = servicesPayload.findIndex((s) => Number(s.id) === svcId);
        if (svcIdx < 0) return json({ detail: "Not found" }, 404);
        const svc = servicesPayload[svcIdx];
        let photos = Array.isArray(svc.photos) ? [...svc.photos] : [];
        if (method === "POST" && photoId == null) {
          const ph = {
            id: 6000 + photos.length,
            image: "https://example.com/e2e-svc.png",
            thumb_url: "https://example.com/e2e-svc-thumb.png",
            sort_order: photos.length + 1,
          };
          photos = [...photos, ph];
          servicesPayload[svcIdx] = { ...svc, photos, gallery: photos };
          return json({ photos, gallery: photos }, 201);
        }
        if (method === "DELETE" && photoId != null) {
          photos = photos.filter((p) => Number(p.id) !== photoId);
          servicesPayload[svcIdx] = { ...svc, photos, gallery: photos };
          return json({ ok: true });
        }
      }
      const svcMatch = path.match(/\/catalog\/services\/(\d+)$/);
      if (svcMatch && method === "PATCH") {
        const id = Number(svcMatch[1]);
        let body = {};
        try {
          body = req.postDataJSON() || {};
        } catch {
          body = {};
        }
        servicesPayload = servicesPayload.map((s) =>
          Number(s.id) === id
            ? {
                ...s,
                ...(body.price != null ? { price: String(body.price) } : {}),
                ...(body.duration_minutes != null ? { duration_minutes: body.duration_minutes } : {}),
                ...(body.is_active != null ? { is_active: Boolean(body.is_active) } : {}),
              }
            : s,
        );
        return json(servicesPayload.find((s) => Number(s.id) === id) || { id, ...body });
      }
    }
    if (path.includes("/catalog/services")) return json(servicesPayload);
    if (path.includes("/users/organization-info") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      mePayload = {
        ...mePayload,
        ...(body.organization_working_hours
          ? { organization_working_hours: body.organization_working_hours }
          : {}),
        ...(body.organization_phones ? { organization_phones: body.organization_phones } : {}),
        ...(body.organization_websites ? { organization_websites: body.organization_websites } : {}),
        ...(body.organization_card_note != null
          ? { organization_card_note: body.organization_card_note }
          : {}),
      };
      return json(mePayload);
    }
    if (path.includes("/users/gallery") && method === "GET") {
      return json({ photos: galleryPhotos, max_photos: 5, count: galleryPhotos.length });
    }
    if (path.includes("/users/gallery") && method === "POST") {
      const created = {
        id: 8000 + galleryPhotos.length,
        url: "https://example.com/e2e-org-gallery.png",
        thumb_url: "https://example.com/e2e-org-gallery-thumb.png",
        sort_order: galleryPhotos.length + 1,
      };
      galleryPhotos = [...galleryPhotos, created];
      return json(created, 201);
    }
    if (path.includes("/users/gallery") && method === "DELETE") {
      const id = Number(url.searchParams.get("id") || 0);
      galleryPhotos = galleryPhotos.filter((p) => Number(p.id) !== id);
      return route.fulfill({ status: 204, body: "" });
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
    if (path.includes("/locations") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 7000 + locationRows.length,
        provider: ME.id,
        title: body.title || "Филиал",
        address: body.address || "",
        latitude: body.latitude || "55.751244",
        longitude: body.longitude || "37.618423",
        entrance: body.entrance || "",
        floor: body.floor || "",
        apartment: body.apartment || "",
        intercom: body.intercom || "",
        address_details: body.address_details || "",
      };
      locationRows = [...locationRows, created];
      return json(created, 201);
    }
    if (path.match(/\/locations\/\d+$/) && method === "PATCH") {
      const id = Number(path.split("/").pop());
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      locationRows = locationRows.map((l) => (Number(l.id) === id ? { ...l, ...body } : l));
      return json(locationRows.find((l) => Number(l.id) === id) || { id, ...body });
    }
    if (path.match(/\/locations\/\d+$/) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      locationRows = locationRows.filter((l) => Number(l.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.includes("/locations")) return json(locationRows);
    if (path.match(/\/booking\/staff\/\d+$/) && method === "PATCH") {
      const id = Number(path.split("/").pop());
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      staffLinks = staffLinks.map((l) =>
        Number(l.id) === id
          ? {
              ...l,
              ...body,
              permissions: body.permissions ? { ...(l.permissions || {}), ...body.permissions } : l.permissions,
              assigned_service_ids:
                body.assigned_service_ids != null ? body.assigned_service_ids : l.assigned_service_ids,
              assigned_category_ids:
                body.assigned_category_ids != null ? body.assigned_category_ids : l.assigned_category_ids,
            }
          : l,
      );
      return json(staffLinks.find((l) => Number(l.id) === id) || { id, ...body });
    }
    if (path.match(/\/booking\/staff\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 9000 + staffLinks.length,
        invitation_status: "pending",
        is_active: false,
        job_title: body.job_title || "",
        permissions: body.permissions || {},
        staff: 502,
        staff_user: {
          id: 502,
          username: body.invite_identifier || "invited",
          first_name: "Приглашённый",
          last_name: "Клиент",
        },
        provider: ME.id,
      };
      staffLinks = [...staffLinks, created];
      return json(created, 201);
    }
    if (path.includes("/booking/staff")) return json(staffLinks);
    if (path.includes("/booking/book-for-client") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      return json(
        {
          id: 8801,
          status: "new",
          service: body.service,
          starts_at: body.starts_at,
          ends_at: body.ends_at,
          client_display_name: body.name || "Клиент",
        },
        201,
      );
    }
    if (path.includes("/booking/clients/lookup") && method === "GET") {
      const q = (url.searchParams.get("q") || "").trim().toLowerCase();
      const results = clientsPayload.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const phone = String(c.phone || "");
        return !q || name.includes(q) || phone.includes(q);
      });
      return json({
        found: results.length > 0,
        client: results[0] || null,
        results,
        normalized_phone: "",
      });
    }
    if (path.includes("/booking/clients/migrate-request")) {
      if (method === "GET") {
        return json({
          results: migrateRequests,
          latest: migrateRequests[0] || null,
        });
      }
      if (method === "POST") {
        const created = {
          id: 9100 + migrateRequests.length,
          status: "new",
          status_label: "Новая",
          source_note: "migrate",
          result_detail: "",
          has_file: false,
          file_name: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        migrateRequests = [created, ...migrateRequests];
        return json(created, 201);
      }
    }
    if (path.match(/\/booking\/clients\/?$/) && method === "POST") {
      const ct = (req.headers()["content-type"] || "").toLowerCase();
      if (ct.includes("multipart/form-data")) {
        return json({
          ok: true,
          created: 1,
          updated: 0,
          errors: [],
          detail: "Импортировано: новых 1, обновлено 0.",
        });
      }
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 7000 + clientsPayload.length,
        name: body.name || "Клиент",
        phone: body.phone || "",
        avatar_url: "",
        avatar_initial: (body.name || "К")[0],
      };
      clientsPayload = [...clientsPayload, created];
      return json(created, 201);
    }
    if (path.includes("/booking/clients") && method === "GET") {
      return json({
        results: clientsPayload,
        count: clientsPayload.length,
        page: 1,
        total_pages: 1,
        page_size: 20,
      });
    }
    if (path.includes("/booking/clients") && method === "DELETE") {
      const id = Number(url.searchParams.get("client") || 0);
      clientsPayload = clientsPayload.filter((c) => Number(c.id) !== id);
      return json({ ok: true, hidden: true });
    }
    if (path.includes("/booking/client-cards") && method === "GET") {
      const id = Number(url.searchParams.get("client") || 0);
      const c = clientsPayload.find((x) => Number(x.id) === id) || { id, name: `Клиент #${id}` };
      return json({
        client: id,
        client_name: c.name || `Клиент #${id}`,
        provider_sphere: "hair_salon",
        tech: { hair_color: "" },
        personal: {},
        technical_notes: "",
        preferences_notes: "",
        acquisition_source: "",
        is_blocked: false,
        no_show_count: 0,
        field_prefs: {},
        field_catalog: {},
        recent_visits: [],
      });
    }
    if (path.includes("/booking/client-cards") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(url.searchParams.get("client") || body.client || 0);
      const c = clientsPayload.find((x) => Number(x.id) === id) || { id, name: `Клиент #${id}` };
      return json({
        client: id,
        client_name: c.name || `Клиент #${id}`,
        provider_sphere: "hair_salon",
        tech: body.tech || {},
        personal: body.personal || {},
        technical_notes: body.technical_notes || "",
        preferences_notes: body.preferences_notes || "",
        acquisition_source: body.acquisition_source || "",
        is_blocked: Boolean(body.is_blocked),
        no_show_count: Number(body.no_show_count) || 0,
        field_prefs: body.field_prefs || {},
        field_catalog: {},
        recent_visits: [],
      });
    }
    if (path.includes("/booking/slots/manual-hold") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 5100 + slotsPayload.length,
        provider: ME.id,
        staff: null,
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        is_booked: true,
        hold_label: body.guest_name || body.hold_label || "",
        anonymous_index: 1,
        service_ids: [],
        location: null,
        recurrence_group: "",
        is_manual_hold: true,
      };
      slotsPayload = [...slotsPayload, created];
      return json(created, 201);
    }
    if (path.match(/\/booking\/slots\/\d+\/release-hold$/) && method === "POST") {
      const id = Number(path.split("/").slice(-2, -1)[0]);
      slotsPayload = slotsPayload.filter((s) => Number(s.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.match(/\/booking\/slots\/\d+$/) && method === "DELETE") {
      const id = Number(path.split("/").pop());
      slotsPayload = slotsPayload.filter((s) => Number(s.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.match(/\/booking\/slots\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 5000 + slotsPayload.length,
        provider: ME.id,
        staff: body.staff ?? null,
        starts_at: body.starts_at,
        ends_at: body.ends_at,
        is_booked: false,
        hold_label: "",
        anonymous_index: body.anonymous_index ?? null,
        service_ids: body.service_ids || [],
        location: body.location ?? null,
        recurrence_group: "",
      };
      slotsPayload = [...slotsPayload, created];
      return json(created, 201);
    }
    if (path.includes("/booking/slots")) return json(slotsPayload);
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
    if (path.includes("/booking/acquiring") && method === "GET") {
      return json(acquiringPayload);
    }
    if (path.includes("/booking/analytics") && method === "GET") {
      const today = new Date().toISOString().slice(0, 10);
      return json({
        from: today,
        to: today,
        totals: {
          bookings: 3,
          by_status: { new: 1, confirmed: 1, done: 1 },
          revenue_estimate: 4500,
          reviews_count: 1,
          average_rating: 5,
        },
        by_day: [{ date: today, bookings: 3, done: 1, revenue: 1500 }],
        by_service: [{ id: 301, name: "Стрижка", count: 3, revenue: 4500 }],
        by_staff: [{ id: null, name: "Без мастера", count: 3, done: 1 }],
        rating_histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 },
        bookings: [
          {
            id: 8001,
            created_at: new Date().toISOString(),
            status: "done",
            service: "Стрижка",
            service_id: 301,
            price: 1500,
            staff: "Без мастера",
            staff_id: null,
            client: "Тест Клиент",
            slot_starts_at: new Date().toISOString(),
          },
        ],
      });
    }
    if (path.includes("/booking/acquiring") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      acquiringPayload = {
        ...acquiringPayload,
        ...body,
        has_yookassa: Boolean(
          (body.yookassa_shop_id || acquiringPayload.yookassa_shop_id) &&
            (body.yookassa_secret_key || acquiringPayload.has_yookassa),
        ),
        has_payment_keys: Boolean(
          (body.yookassa_shop_id || acquiringPayload.yookassa_shop_id) &&
            (body.yookassa_secret_key || acquiringPayload.has_yookassa),
        ),
      };
      delete acquiringPayload.yookassa_secret_key;
      return json(acquiringPayload);
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
    if (path.includes("/cafe/settings") && method === "GET") {
      return json(cafeSettingsPayload);
    }
    if (path.includes("/cafe/settings") && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      cafeSettingsPayload = {
        ...cafeSettingsPayload,
        ...body,
        updated_at: new Date().toISOString(),
      };
      delete cafeSettingsPayload.yookassa_secret_key;
      delete cafeSettingsPayload.tbank_password;
      delete cafeSettingsPayload.cloudpayments_api_secret;
      delete cafeSettingsPayload.robokassa_password1;
      delete cafeSettingsPayload.robokassa_password2;
      return json(cafeSettingsPayload);
    }
    if (path.includes("/cafe/floors") && method === "GET" && !path.match(/\/floors\/\d+/)) {
      return json(cafeFloors);
    }
    if (path.match(/\/cafe\/floors\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: ++cafeFloorSeq,
        name: body.name || `Зал ${cafeFloors.length + 1}`,
        width: Number(body.width) || 800,
        height: Number(body.height) || 600,
        drawings: Array.isArray(body.drawings) ? body.drawings : [],
        tables: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      cafeFloors = [...cafeFloors, created];
      return json(created, 201);
    }
    const cafeFloorTablesMatch = path.match(/\/cafe\/floors\/(\d+)\/tables$/);
    if (cafeFloorTablesMatch && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const floorId = Number(cafeFloorTablesMatch[1]);
      const created = {
        id: ++cafeTableSeq,
        label: body.label || "Стол",
        x: Number(body.x) || 40,
        y: Number(body.y) || 40,
        width: Number(body.width) || 88,
        height: Number(body.height) || 88,
        rotation: Number(body.rotation) || 0,
        seats: Number(body.seats) || 4,
        shape: body.shape || "round",
        pin_code: body.pin_code || "123456",
        public_token: `tbl${cafeTableSeq}`,
        is_active: true,
        is_occupied: false,
        guest_count: 0,
        waiter_called_at: null,
        sort_order: 0,
        qr_path: `/t/tbl${cafeTableSeq}`,
      };
      cafeFloors = cafeFloors.map((f) =>
        Number(f.id) === floorId ? { ...f, tables: [...(f.tables || []), created] } : f,
      );
      return json(created, 201);
    }
    const cafeFloorMatch = path.match(/\/cafe\/floors\/(\d+)$/);
    if (cafeFloorMatch && method === "DELETE") {
      const id = Number(cafeFloorMatch[1]);
      cafeFloors = cafeFloors.filter((f) => Number(f.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (cafeFloorMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(cafeFloorMatch[1]);
      cafeFloors = cafeFloors.map((f) =>
        Number(f.id) === id ? { ...f, ...body, tables: f.tables || [] } : f,
      );
      const updated = cafeFloors.find((f) => Number(f.id) === id);
      return json(updated || body);
    }
    const cafeTableMatch = path.match(/\/cafe\/tables\/(\d+)$/);
    if (cafeTableMatch && method === "DELETE") {
      const id = Number(cafeTableMatch[1]);
      cafeFloors = cafeFloors.map((f) => ({
        ...f,
        tables: (f.tables || []).filter((t) => Number(t.id) !== id),
      }));
      return route.fulfill({ status: 204, body: "" });
    }
    if (cafeTableMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(cafeTableMatch[1]);
      let updated = null;
      cafeFloors = cafeFloors.map((f) => ({
        ...f,
        tables: (f.tables || []).map((t) => {
          if (Number(t.id) !== id) return t;
          updated = { ...t, ...body };
          return updated;
        }),
      }));
      return json(updated || { id, ...body });
    }
    if (path.match(/\/cafe\/menu\/categories\/?$/) && method === "GET") {
      return json(cafeCategories);
    }
    if (path.match(/\/cafe\/menu\/categories\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: ++cafeCatSeq,
        name: body.name || "Категория",
        sort_order: Number(body.sort_order) || 0,
        is_novelties: Boolean(body.is_novelties),
        is_active: body.is_active !== false,
        items: [],
      };
      cafeCategories = [...cafeCategories, created];
      return json(created, 201);
    }
    const cafeCatMatch = path.match(/\/cafe\/menu\/categories\/(\d+)$/);
    if (cafeCatMatch && method === "DELETE") {
      const id = Number(cafeCatMatch[1]);
      cafeCategories = cafeCategories.filter((c) => Number(c.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (cafeCatMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(cafeCatMatch[1]);
      cafeCategories = cafeCategories.map((c) =>
        Number(c.id) === id ? { ...c, ...body, items: c.items || [] } : c,
      );
      const updated = cafeCategories.find((c) => Number(c.id) === id);
      return json(updated || body);
    }
    if (path.match(/\/cafe\/menu\/items\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: ++cafeItemSeq,
        category: Number(body.category),
        name: body.name || "Блюдо",
        description: body.description || "",
        composition: body.composition || "",
        weight_grams: body.weight_grams ?? null,
        calories: body.calories ?? null,
        price: body.price || "0",
        is_new: Boolean(body.is_new),
        is_available: body.is_available !== false,
        is_active: true,
        rating_avg: null,
        rating_count: 0,
        sort_order: 0,
        photos: [],
        removable_ingredients: [],
      };
      cafeCategories = cafeCategories.map((c) =>
        Number(c.id) === Number(body.category)
          ? { ...c, items: [...(c.items || []), created] }
          : c,
      );
      return json(created, 201);
    }
    const cafeItemMatch = path.match(/\/cafe\/menu\/items\/(\d+)$/);
    if (cafeItemMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(cafeItemMatch[1]);
      let updated = null;
      cafeCategories = cafeCategories.map((c) => ({
        ...c,
        items: (c.items || []).map((it) => {
          if (Number(it.id) !== id) return it;
          updated = { ...it, ...body };
          return updated;
        }),
      }));
      return json(updated || { id, ...body });
    }
    if (cafeItemMatch && method === "DELETE") {
      const id = Number(cafeItemMatch[1]);
      cafeCategories = cafeCategories.map((c) => ({
        ...c,
        items: (c.items || []).filter((it) => Number(it.id) !== id),
      }));
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.match(/\/cafe\/orders\/?$/) && method === "GET") {
      return json(cafeOrdersPayload);
    }
    const cafeOrderMatch = path.match(/\/cafe\/orders\/(\d+)$/);
    if (cafeOrderMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(cafeOrderMatch[1]);
      cafeOrdersPayload = cafeOrdersPayload.map((o) =>
        Number(o.id) === id ? { ...o, ...body, id } : o,
      );
      const updated = cafeOrdersPayload.find((o) => Number(o.id) === id);
      return json(updated || { id, ...body });
    }
    if (path.includes("/cafe/")) return json([]);
    if (path.includes("/shop/categories/from-pool") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const pathNodes = Array.isArray(body.path) ? body.path : [];
      const created = [];
      let parent = null;
      for (const node of pathNodes) {
        let existing = shopCategoriesPayload.find((c) => c.pool_key && c.pool_key === node.key);
        if (!existing) {
          existing = {
            id: ++shopCatSeq,
            name: node.name || "Категория",
            parent: parent,
            pool_key: node.key || "",
            sort_order: created.length,
          };
          shopCategoriesPayload = [...shopCategoriesPayload, existing];
        }
        parent = existing.id;
        created.push(existing);
      }
      const leaf = created[created.length - 1];
      return json(
        {
          leaf,
          path: created.map((c) => ({ id: c.id, name: c.name, pool_key: c.pool_key })),
        },
        201,
      );
    }
    if (path.match(/\/shop\/categories\/?$/) && method === "GET") {
      return json(shopCategoriesPayload);
    }
    if (path.match(/\/shop\/products\/?$/) && method === "GET") {
      return json(shopProductsPayload);
    }
    if (path.match(/\/shop\/products\/?$/) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: ++shopProductSeq,
        name: body.name || "Товар",
        description: body.description || "",
        sku: body.sku || "",
        unit: body.unit || "шт",
        price: body.price || "0",
        category: body.category || null,
        stock_qty: 0,
        is_active: body.is_active !== false,
        is_featured: Boolean(body.is_featured),
        featured_order: Number(body.featured_order) || 0,
        bonus_points: Number(body.bonus_points) || 0,
        photos: [],
        attrs: body.attrs || {},
        sizes: body.sizes || [],
        related_product_ids: body.related_product_ids || [],
        authenticity_status: "",
      };
      shopProductsPayload = [...shopProductsPayload, created];
      return json(created, 201);
    }
    const shopProductMatch = path.match(/\/shop\/products\/(\d+)$/);
    if (shopProductMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(shopProductMatch[1]);
      shopProductsPayload = shopProductsPayload.map((p) =>
        Number(p.id) === id ? { ...p, ...body, id } : p,
      );
      const updated = shopProductsPayload.find((p) => Number(p.id) === id);
      return json(updated || { id, ...body });
    }
    if (shopProductMatch && method === "DELETE") {
      const id = Number(shopProductMatch[1]);
      shopProductsPayload = shopProductsPayload.filter((p) => Number(p.id) !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path.includes("/shop/settings") && method === "GET") {
      return json({
        enable_pickup: true,
        enable_delivery: false,
        delivery_fee: "0",
        delivery_min_order: "0",
        delivery_zones: [],
        accept_online_payment: false,
        accept_cash: true,
      });
    }
    if (path.match(/\/shop\/orders\/?$/) && method === "GET") {
      return json(shopOrdersPayload);
    }
    const shopOrderMatch = path.match(/\/shop\/orders\/(\d+)$/);
    if (shopOrderMatch && method === "PATCH") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(shopOrderMatch[1]);
      shopOrdersPayload = shopOrdersPayload.map((o) =>
        Number(o.id) === id ? { ...o, ...body, id } : o,
      );
      const updated = shopOrdersPayload.find((o) => Number(o.id) === id);
      return json(updated || { id, ...body });
    }
    if (path.includes("/shop/")) return json([]);
    if (path.includes("/reviews/unread-count") && method === "GET") {
      const count = reviewsPayload.filter((r) => r.is_new || !r.provider_seen_at).length;
      return json({ count });
    }
    if (path.includes("/reviews/mark-seen") && method === "POST") {
      const marked = reviewsPayload.filter((r) => r.is_new || !r.provider_seen_at).length;
      reviewsPayload = reviewsPayload.map((r) => ({
        ...r,
        is_new: false,
        provider_seen_at: new Date().toISOString(),
      }));
      return json({ marked });
    }
    const replyMatch = path.match(/\/reviews\/(\d+)\/reply\/?$/);
    if (replyMatch && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const id = Number(replyMatch[1]);
      reviewsPayload = reviewsPayload.map((r) =>
        Number(r.id) === id
          ? {
              ...r,
              reply: {
                id: 1,
                text: body.text || "",
                sent_via_chat: Boolean(body.via_chat),
                created_at: new Date().toISOString(),
              },
            }
          : r,
      );
      const updated = reviewsPayload.find((r) => Number(r.id) === id) || { id, reply: { text: body.text } };
      return json(updated);
    }
    if (path.match(/\/reviews\/?$/) && method === "GET") {
      return json(reviewsPayload);
    }
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

/** Shared API mocks for client booking E2E. */

const ORG = {
  id: 101,
  provider: 201,
  organization_name: "Салон E2E",
  provider_sphere: "hair_salon",
  latitude: 55.75,
  longitude: 37.62,
  distance_km: 1.2,
};

const ME = {
  id: 501,
  username: "e2e-client",
  role: "client",
  first_name: "Тест",
  last_name: "Клиент",
  email: "e2e@example.com",
  profile_complete: true,
  needs_credentials_setup: false,
};

const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "1000.00",
  duration_minutes: 30,
  is_active: true,
  options: [],
  gallery: [],
};

const start = new Date(Date.now() + 3 * 3600_000);
start.setSeconds(0, 0);
const end = new Date(start.getTime() + 30 * 60_000);
const WINDOW = {
  starts_at: start.toISOString(),
  ends_at: end.toISOString(),
  staff_id: null,
  staff_label: "Любой",
};

function windowKey(w) {
  return `${w.starts_at}|${w.ends_at}|${w.staff_id ?? ""}`;
}

export async function installClientMocks(
  page,
  {
    prepay = false,
    emptyWindows = false,
    loyalty = null,
    loyaltyAccounts = null,
    clientPackages = null,
    offerPackages = null,
    bookings = null,
    conversations = null,
    activityNotifications = null,
    seedMessages = null,
    telegramLinked = false,
    pendingStaffInvites = null,
    meOverrides = null,
  } = {},
) {
  const loyaltyPayload = loyalty || { enabled: false, balance: 0, rub_per_point: 1 };
  let packagesPayload = Array.isArray(clientPackages) ? clientPackages.map((p) => ({ ...p })) : [];
  const offerPackagesPayload = Array.isArray(offerPackages) ? offerPackages.map((p) => ({ ...p })) : [];
  const accountsPayload = Array.isArray(loyaltyAccounts)
    ? loyaltyAccounts.map((a) => ({ ...a }))
    : loyalty && loyalty.provider != null
      ? [
          {
            id: 1,
            provider: loyalty.provider,
            provider_name: loyalty.provider_name || ORG.organization_name,
            balance: Number(loyalty.balance) || 0,
            level: loyalty.level || "start",
            level_label: loyalty.level_label || "Старт",
          },
        ]
      : [];
  let bookingsList = Array.isArray(bookings) ? bookings.map((b) => ({ ...b })) : [];
  let reviewsStore = [];
  const conversationsPayload = Array.isArray(conversations)
    ? conversations.map((c) => ({ ...c }))
    : [];
  let messagesStore = Array.isArray(seedMessages) ? seedMessages.map((m) => ({ ...m })) : [];
  let activityNotes = Array.isArray(activityNotifications)
    ? activityNotifications.map((n) => ({ ...n }))
    : [];
  let pendingInvites = Array.isArray(pendingStaffInvites)
    ? pendingStaffInvites.map((i) => ({ ...i }))
    : [];
  let telegramLink = telegramLinked
    ? {
        link_token: "e2e-tg-token",
        telegram_chat_id: "123456",
        linked: true,
        deep_link: "https://t.me/vmeste_e2e_bot?start=e2e-tg-token",
        bot_username: "vmeste_e2e_bot",
        hint: "",
      }
    : null;
  let mePayload = {
    ...ME,
    notify_booking_reminders: true,
    notify_booking_status: true,
    email_verified: true,
    has_usable_password: true,
    ...(meOverrides && typeof meOverrides === "object" ? meOverrides : {}),
  };

  await page.addInitScript(() => {
    window.__VMESTE_E2E__ = true;
    localStorage.setItem("vmeste_access", "e2e-access-token");
    localStorage.setItem("vmeste_refresh", "e2e-refresh-token");
    localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
  });

  await page.addInitScript(() => {
    const fakePos = {
      coords: {
        latitude: 55.75,
        longitude: 37.62,
        accuracy: 20,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null,
      },
      timestamp: Date.now(),
    };
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition = (success) => {
        queueMicrotask(() => success(fakePos));
      };
      navigator.geolocation.watchPosition = (success) => {
        queueMicrotask(() => success(fakePos));
        return 1;
      };
    }
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
      return json(mePayload);
    }
    if (path.endsWith("/users/me/delete") && method === "POST") {
      return json({ detail: "Аккаунт удалён. Данные обезличены." });
    }
    if (path.endsWith("/users/me") && method === "POST") {
      const raw = req.postData() || "";
      if (raw.includes("clear_avatar")) {
        mePayload = { ...mePayload, avatar_url: "", avatar_thumb_url: "" };
        return json(mePayload);
      }
      if (raw.includes("avatar") || raw.includes("filename=")) {
        mePayload = {
          ...mePayload,
          avatar_url: "https://example.com/e2e-avatar-uploaded.png",
          avatar_thumb_url: "https://example.com/e2e-avatar-uploaded-thumb.png",
        };
        return json(mePayload);
      }
      return json({ detail: "Выберите файл аватара." }, 400);
    }
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
    if (path.includes("/users/change-email") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const email = String(body.new_email || "").trim().toLowerCase();
      if (email) {
        mePayload = { ...mePayload, email, email_verified: false };
      }
      return json({
        detail: "Email изменён. Подтвердите новый адрес по ссылке из письма (это письмо о смене почты).",
      });
    }
    if (path.includes("/users/resend-verification") && method === "POST") {
      return json({ detail: "Письмо отправлено. Проверьте почту." });
    }
    if (path.includes("/users/verify-email") && method === "POST") {
      return json({ detail: "ok" });
    }
    if (path.includes("/users/roles")) return json([{ key: "client", value: "Клиент" }]);
    if (path.includes("/users/spheres")) {
      return json([{ key: "hair_salon", value: "Салон красоты" }]);
    }
    if (path.includes("/locations")) return json([ORG]);
    if (path.includes("/catalog/services")) return json([SERVICE]);
    if (path.includes("/organization-profile")) {
      return json({
        organization_name: ORG.organization_name,
        organization_slug: "e2e-salon",
        provider_sphere: "hair_salon",
        phones: [],
        prepay: prepay
          ? { ready: true, mode: "full", percent: 100 }
          : { ready: false, mode: "off", percent: 50 },
      });
    }
    if (path.match(/\/reviews\/\d+$/) && method === "PATCH") {
      const id = Number(path.split("/").pop());
      let append = "";
      try {
        const raw = req.postData() || "";
        if (raw.includes("append_text") || raw.includes("form-data")) {
          const m = raw.match(/name="append_text"[\r\n]+([\s\S]*?)[\r\n]+-{2,}/);
          append = m ? m[1].trim() : "";
        } else {
          const body = req.postDataJSON?.() || JSON.parse(raw || "{}");
          append = String(body.append_text || body.text || "").trim();
        }
      } catch {
        append = "";
      }
      const existing = reviewsStore.find((r) => Number(r.id) === id);
      if (!existing) return json({ detail: "Not found" }, 404);
      if (existing.supplemented_at) return json({ detail: "Отзыв уже дополнен." }, 400);
      const updated = {
        ...existing,
        text: append ? `${existing.text || ""}\n\n${append}`.trim() : existing.text,
        supplemented_at: new Date().toISOString(),
      };
      reviewsStore = reviewsStore.map((r) => (Number(r.id) === id ? updated : r));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === Number(updated.booking)
          ? { ...b, review: { id: updated.id, rating: updated.rating, text: updated.text } }
          : b,
      );
      return json(updated);
    }
    if (path.includes("/reviews") && method === "POST") {
      let rating = 5;
      let text = "";
      let bookingId = 0;
      let providerId = ORG.provider;
      try {
        const raw = req.postData() || "";
        if (raw.includes("form-data") || raw.includes("Content-Disposition")) {
          const ratingM = raw.match(/name="rating"[\r\n]+([\s\S]*?)[\r\n]+-{2,}/);
          const textM = raw.match(/name="text"[\r\n]+([\s\S]*?)[\r\n]+-{2,}/);
          const bookingM = raw.match(/name="booking"[\r\n]+([\s\S]*?)[\r\n]+-{2,}/);
          const providerM = raw.match(/name="provider"[\r\n]+([\s\S]*?)[\r\n]+-{2,}/);
          if (ratingM) rating = Number(ratingM[1].trim()) || 5;
          if (textM) text = textM[1].trim();
          if (bookingM) bookingId = Number(bookingM[1].trim()) || 0;
          if (providerM) providerId = Number(providerM[1].trim()) || ORG.provider;
        } else {
          const body = req.postDataJSON?.() || JSON.parse(raw || "{}");
          rating = Number(body.rating) || 5;
          text = String(body.text || "");
          bookingId = Number(body.booking) || 0;
          providerId = Number(body.provider) || ORG.provider;
        }
      } catch {
        /* defaults */
      }
      const created = {
        id: 7001 + reviewsStore.length,
        booking: bookingId,
        provider: providerId,
        rating,
        text,
        created_at: new Date().toISOString(),
        photos: [],
        reply: null,
      };
      reviewsStore = [created, ...reviewsStore];
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === bookingId
          ? {
              ...b,
              review: {
                id: created.id,
                rating: created.rating,
                text: created.text,
                created_at: created.created_at,
              },
            }
          : b,
      );
      return json(created, 201);
    }
    if (path.includes("/reviews")) return json(reviewsStore);
    if (path.match(/\/booking\/staff\/\d+\/accept-invite$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      pendingInvites = pendingInvites.filter((i) => Number(i.id) !== id);
      mePayload = { ...mePayload, role: "staff" };
      return json({ id, invitation_status: "accepted", is_active: true });
    }
    if (path.match(/\/booking\/staff\/\d+\/reject-invite$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      pendingInvites = pendingInvites.filter((i) => Number(i.id) !== id);
      return json({}, 204);
    }
    if (path.includes("/booking/staff")) return json([]);
    if (path.includes("/available-windows")) {
      return json(emptyWindows ? [] : [WINDOW]);
    }
    if (path.includes("/available-dates")) {
      const iso = start.toISOString().slice(0, 10);
      return json({ dates: [iso] });
    }
    if (path.includes("/booking/waitlist") && method === "POST") {
      return json(
        {
          id: 1,
          provider: ORG.provider,
          service: SERVICE.id,
          status: "waiting",
        },
        201,
      );
    }
    if (path.includes("/booking/waitlist") && method === "GET") {
      return json([]);
    }
    if (path.includes("/loyalty/accounts")) {
      return json(accountsPayload);
    }
    if (path.includes("/loyalty/me")) {
      return json(loyaltyPayload);
    }
    if (path.includes("/client-packages")) {
      return json(packagesPayload);
    }
    if (path.match(/\/packages\/\d+\/purchase$/) && method === "POST") {
      const pkgId = Number(path.split("/").filter(Boolean).at(-2));
      const offer = offerPackagesPayload.find((p) => Number(p.id) === pkgId) || {
        id: pkgId,
        name: "Абонемент",
        visits_count: 5,
        provider: ORG.provider,
      };
      const purchased = {
        id: 55,
        provider: offer.provider || ORG.provider,
        provider_name: ORG.organization_name,
        package: pkgId,
        package_name: offer.name || "Абонемент",
        visits_total: Number(offer.visits_count) || 5,
        visits_remaining: Number(offer.visits_count) || 5,
        status: "active",
        status_label: "Активен",
      };
      packagesPayload = [...packagesPayload.filter((p) => Number(p.package) !== pkgId), purchased];
      return json(purchased, 201);
    }
    if (path.includes("/packages")) return json(offerPackagesPayload);
    if (path.match(/\/booking\/\d+\/pay$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      return json({
        id,
        payment_status: "pending",
        confirmation_url: "https://pay.example/resume",
      });
    }
    if (path.match(/\/booking\/\d+\/cancel-by-client$/) && method === "POST") {
      const id = Number(path.split("/").filter(Boolean).at(-2));
      bookingsList = bookingsList.map((b) =>
        Number(b.id) === id ? { ...b, status: "cancelled" } : b,
      );
      const updated = bookingsList.find((b) => Number(b.id) === id) || {
        id,
        status: "cancelled",
      };
      return json(updated);
    }
    if (path.match(/\/booking$/) && method === "GET") return json(bookingsList);
    if (path.match(/\/booking$/) && method === "POST") {
      let bodyIn = {};
      try {
        bodyIn = req.postDataJSON() || {};
      } catch {
        bodyIn = {};
      }
      const usePkg = Boolean(bodyIn.use_package);
      const loyaltyPts = Number(bodyIn.loyalty_points) || 0;
      const covered = usePkg || loyaltyPts >= 1000;
      const body = {
        id: 9001,
        payment_status: covered ? "paid" : prepay ? "pending" : "none",
        confirmation_url: !covered && prepay ? "https://pay.example/e2e" : "",
        client_package: usePkg ? Number(bodyIn.client_package) || 55 : null,
        loyalty_points_redeemed: loyaltyPts,
        slot_starts_at: WINDOW.starts_at,
      };
      return json(body, 201);
    }
    if (path.includes("/chat/conversations") && method === "GET") {
      return json(conversationsPayload);
    }
    if (path.match(/\/chat\/conversations\/\d+\/mark-read$/) && method === "POST") {
      return json({ ok: true, last_read_message_id: 501 });
    }
    if (path.includes("/chat/messages") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const created = {
        id: 5000 + messagesStore.length + 1,
        conversation: Number(body.conversation) || 0,
        sender: ME.id,
        kind: body.kind || "text",
        text: String(body.text || ""),
        display_text: String(body.text || ""),
        created_at: new Date().toISOString(),
        sender_username: ME.username,
        viewed_by_peer: false,
      };
      messagesStore = [...messagesStore, created];
      return json(created, 201);
    }
    if (path.includes("/chat/messages") && method === "GET") {
      const cid = Number(url.searchParams.get("conversation") || 0);
      const list = cid
        ? messagesStore.filter((m) => Number(m.conversation) === cid)
        : messagesStore;
      return json(list);
    }
    if (path.includes("/chat/activity")) {
      return json({
        pending_staff_invites: pendingInvites,
        notifications: activityNotes,
        unread_notification_count: activityNotes.length,
        pending_invite_count: pendingInvites.length,
        unread_chat_messages_count: conversationsPayload.reduce(
          (s, c) => s + (Number(c.unread_message_count) || 0),
          0,
        ),
        badge_count:
          activityNotes.length +
          pendingInvites.length +
          conversationsPayload.reduce((s, c) => s + (Number(c.unread_message_count) || 0), 0),
      });
    }
    if (path.includes("/users/change-password") && method === "POST") {
      return json({ detail: "Проверьте почту для подтверждения смены пароля." });
    }
    if (path.includes("/users/request-password-reset") && method === "POST") {
      return json({
        detail: "Мы отправили ссылку для сброса пароля на вашу почту. Перейдите по ней в течение 24 часов.",
      });
    }
    if (path.includes("/users/confirm-password-reset") && method === "POST") {
      return json({ detail: "Пароль обновлён. Войдите с новым паролем." });
    }
    if (path.includes("/notifications/in-app/mark-read") && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON() || {};
      } catch {
        body = {};
      }
      const ids = new Set((body.ids || []).map(Number));
      activityNotes = activityNotes.filter((n) => !ids.has(Number(n.id)));
      return json({ ok: true });
    }
    if (path.includes("/notifications/telegram/link") && method === "GET") {
      if (!telegramLink) {
        telegramLink = {
          link_token: "e2e-tg-token",
          telegram_chat_id: "",
          linked: false,
          deep_link: "https://t.me/vmeste_e2e_bot?start=e2e-tg-token",
          bot_username: "vmeste_e2e_bot",
          hint: "",
        };
      }
      return json(telegramLink);
    }
    if (path.includes("/notifications/telegram/link") && method === "DELETE") {
      telegramLink = {
        link_token: (telegramLink && telegramLink.link_token) || "e2e-tg-token",
        telegram_chat_id: "",
        linked: false,
        deep_link: "https://t.me/vmeste_e2e_bot?start=e2e-tg-token",
        bot_username: "vmeste_e2e_bot",
        hint: "",
      };
      return json({ ok: true, linked: false });
    }
    if (path.includes("/chat/")) return json([]);
    if (path.includes("/cafe/my-orders")) return json([]);
    if (path.includes("/inspections/reports")) return json([]);
    if (path.includes("/notifications")) return json([]);
    if (path.includes("/health")) return json({ status: "ok", checks: { db: true } });

    return json([]);
  });
}

const CLIENT_PACKAGE = {
  id: 55,
  provider: ORG.provider,
  provider_name: ORG.organization_name,
  package: 77,
  package_name: "5 стрижек",
  visits_total: 5,
  visits_remaining: 3,
  status: "active",
  status_label: "Активен",
};

const CLIENT_BOOKING = (() => {
  const start = new Date();
  start.setHours(15, 0, 0, 0);
  if (start.getTime() <= Date.now()) {
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    id: 9001,
    status: "confirmed",
    payment_status: "none",
    provider: ORG.provider,
    client: ME.id,
    service: SERVICE.id,
    service_name: SERVICE.name,
    organization_name: ORG.organization_name,
    slot_starts_at: start.toISOString(),
    slot_ends_at: end.toISOString(),
    created_at: new Date().toISOString(),
  };
})();

const DONE_BOOKING = {
  ...CLIENT_BOOKING,
  id: 9002,
  status: "done",
  payment_status: "paid",
};

export { ORG, ME, SERVICE, WINDOW, windowKey, CLIENT_PACKAGE, CLIENT_BOOKING, DONE_BOOKING };

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

export async function installClientMocks(page, { prepay = false, emptyWindows = false } = {}) {
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
      return json(ME);
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
    if (path.includes("/reviews")) return json([]);
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
    if (path.includes("/loyalty/me")) {
      return json({ enabled: false, balance: 0, rub_per_point: 1 });
    }
    if (path.includes("/client-packages") || path.includes("/packages")) return json([]);
    if (path.match(/\/booking\/\d+\/pay$/) && method === "POST") {
      return json({ id: 9001, payment_status: "paid" });
    }
    if (path.match(/\/booking$/) && method === "GET") return json([]);
    if (path.match(/\/booking$/) && method === "POST") {
      const body = {
        id: 9001,
        payment_status: prepay ? "pending" : "none",
        confirmation_url: prepay ? "https://pay.example/e2e" : "",
        client_package: null,
        loyalty_points_redeemed: 0,
        slot_starts_at: WINDOW.starts_at,
      };
      return json(body, 201);
    }
    if (path.includes("/chat/")) return json([]);
    if (path.includes("/notifications")) return json([]);
    if (path.includes("/health")) return json({ status: "ok", checks: { db: true } });

    return json({});
  });
}

export { ORG, ME, SERVICE, WINDOW, windowKey };

/** Public booking widget mocks for `/w/:slug` E2E. */

export const WIDGET_SLUG = "e2e-widget-salon";

const SERVICE = {
  id: 301,
  name: "Стрижка",
  price: "1000.00",
  duration_minutes: 30,
  is_active: true,
  category: 11,
  options: [],
};

function tomorrowIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function windowRange(dateIso) {
  const start = new Date(`${dateIso}T12:00:00`);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
    staff_id: null,
    staff_label: "Без сотрудника",
    parent_slot_id: 1,
    remaining: 1,
  };
}

/**
 * @param {import('@playwright/test').Page} page
 */
export async function installBookingWidgetMocks(page) {
  const day = tomorrowIso();
  const win = windowRange(day);

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

    if (path.match(new RegExp(`/booking/public/${WIDGET_SLUG}$`)) && method === "GET") {
      return json({
        provider_id: 601,
        organization_name: "Салон Widget E2E",
        slug: WIDGET_SLUG,
        sphere: "hair_salon",
        phones: ["+79001112233"],
        address: "Москва, ул. Тестовая, 1",
        locations: [{ id: "main", title: "Основной офис", address: "Москва, ул. Тестовая, 1" }],
        widget_url: `/w/${WIDGET_SLUG}`,
        services: [SERVICE],
        staff: [],
      });
    }
    if (path.includes(`/booking/public/${WIDGET_SLUG}/dates`) && method === "GET") {
      return json({ dates: [day] });
    }
    if (path.includes(`/booking/public/${WIDGET_SLUG}/windows`) && method === "GET") {
      return json([win]);
    }
    if (path.includes(`/booking/public/${WIDGET_SLUG}/book`) && method === "POST") {
      let body = {};
      try {
        body = req.postDataJSON?.() || JSON.parse(req.postData() || "{}");
      } catch {
        body = {};
      }
      return json(
        {
          id: 9001,
          status: "new",
          starts_at: body.starts_at || win.starts_at,
          ends_at: body.ends_at || win.ends_at,
          service: SERVICE.name,
          organization_name: "Салон Widget E2E",
          guest_phone: body.guest_phone || "",
          message: "Запись создана. Мы свяжемся с вами при необходимости.",
        },
        201,
      );
    }
    return json([]);
  });

  return { day, win, service: SERVICE };
}

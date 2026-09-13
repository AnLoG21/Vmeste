/** Public visit-confirm modal E2E (`?visit_confirm=`). */

export const VISIT_TOKEN = "e2e-visit-token";

/**
 * @param {import('@playwright/test').Page} page
 */
export async function installVisitConfirmMocks(page) {
  let confirmed = false;

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

    if (path.includes(`/booking/public/visit-confirm/${VISIT_TOKEN}`) && method === "GET") {
      return json({
        booking_id: 8001,
        status: confirmed ? "confirmed" : "new",
        already_confirmed: confirmed,
        org: "Салон Confirm E2E",
        service: "Стрижка",
        when: "завтра 12:00",
        client_name: "Анна",
      });
    }
    if (path.includes(`/booking/public/visit-confirm/${VISIT_TOKEN}`) && method === "POST") {
      confirmed = true;
      return json({
        ok: true,
        status: "confirmed",
        already_confirmed: true,
        org: "Салон Confirm E2E",
        service: "Стрижка",
        when: "завтра 12:00",
      });
    }
    if (path.includes("/health")) return json({ status: "ok", checks: { db: true } });
    return json([]);
  });
}

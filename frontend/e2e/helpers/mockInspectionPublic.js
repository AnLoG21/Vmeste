/** Public inspection approve page E2E (`/i/:token`). */

const TOKEN = "e2e-inspection-token";

const REPORT = {
  id: 8801,
  provider: 201,
  client: 501,
  organization_name: "СТО E2E",
  vehicle_title: "Solaris",
  vehicle_plate: "А123ВС77",
  vehicle_vin: "",
  notes: "",
  status: "sent",
  repair_status: "none",
  parts_total: "1000.00",
  labor_total: "2000.00",
  grand_total: "3000.00",
  items: [
    {
      id: 91,
      title: "Колодки",
      description: "",
      severity: "recommended",
      parts_price: "1000.00",
      labor_price: "2000.00",
      line_total: "3000.00",
      client_selected: false,
      selectable: true,
      photos: [],
    },
  ],
};

export async function installInspectionPublicMocks(page) {
  let report = { ...REPORT, items: REPORT.items.map((i) => ({ ...i })) };

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

    if (path.includes(`/inspections/public/${TOKEN}`) && path.endsWith("/approve") && method === "POST") {
      let selected = [];
      try {
        selected = (req.postDataJSON()?.selected_item_ids || []).map(Number);
      } catch {
        selected = [];
      }
      report = {
        ...report,
        status: "approved",
        repair_status: "in_progress",
        items: report.items.map((it) => ({
          ...it,
          client_selected: selected.includes(Number(it.id)),
        })),
      };
      return json(report);
    }
    if (path.includes(`/inspections/public/${TOKEN}`) && method === "GET") {
      return json(report);
    }
    if (path.includes("/health")) return json({ status: "ok", checks: { db: true } });
    return json([]);
  });
}

export { TOKEN, REPORT };

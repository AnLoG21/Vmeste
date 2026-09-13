import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const APPROVED = {
  id: 8851,
  provider: 601,
  client: 501,
  booking: null,
  booking_summary: null,
  created_by: 601,
  vehicle_title: "Hyundai Solaris",
  vehicle_plate: "А123ВС77",
  vehicle_vin: "",
  notes: "",
  status: "approved",
  repair_status: "in_progress",
  share_token: "e2e-share-8851",
  public_url: "/i/e2e-share-8851",
  parts_total: "1500.00",
  labor_total: "2000.00",
  grand_total: "3500.00",
  sent_at: "2026-09-01T10:00:00Z",
  approved_at: "2026-09-01T11:00:00Z",
  repair_status_updated_at: "2026-09-01T11:00:00Z",
  created_at: "2026-09-01T09:00:00Z",
  updated_at: "2026-09-01T11:00:00Z",
  client_display_name: "Тест Клиент",
  organization_name: "СТО E2E",
  items: [
    {
      id: 8901,
      title: "Тормозные колодки",
      description: "",
      severity: "recommended",
      parts_price: "1500.00",
      labor_price: "2000.00",
      client_selected: true,
      sort_order: 0,
      line_total: "3500.00",
      selectable: true,
      photos: [],
    },
  ],
};

test.describe("Provider inspection repair funnel", () => {
  test("/inspections → approved → Запчасти → Готов → Выдан", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "service_center",
      inspectionReports: [APPROVED],
    });

    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/inspections\/reports\/\d+\/repair-status\/?/.test(req.url())) {
        try {
          posts.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/inspections");
    await expect(page.getByRole("heading", { name: "Интерактивная приёмка" })).toBeVisible({
      timeout: 20_000,
    });

    await page.locator(".inspection-list-item").filter({ hasText: "#8851" }).click();
    await expect(page.getByText("Воронка: приёмка → заказ-наряд → запчасти → выдача")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.locator(".inspection-badge--repair-in_progress")).toContainText("В работе");

    const funnel = page.locator(".inspection-funnel-steps");
    await funnel.getByRole("button", { name: "Запчасти", exact: true }).click();
    await expect
      .poll(() => posts.some((p) => p.repair_status === "waiting_parts"), { timeout: 15_000 })
      .toBe(true);
    await expect(page.locator(".status")).toContainText("ждём запчасти");

    await funnel.getByRole("button", { name: "Готов", exact: true }).click();
    await expect.poll(() => posts.some((p) => p.repair_status === "ready"), { timeout: 15_000 }).toBe(true);
    await expect(page.locator(".status")).toContainText("авто готово");

    await funnel.getByRole("button", { name: "Выдан", exact: true }).click();
    await expect
      .poll(() => posts.some((p) => p.repair_status === "handed_over"), { timeout: 15_000 })
      .toBe(true);
    await expect(page.locator(".status")).toContainText("авто выдано");
    await expect(page.locator(".inspection-badge--repair-handed_over")).toContainText("Выдан");
  });
});

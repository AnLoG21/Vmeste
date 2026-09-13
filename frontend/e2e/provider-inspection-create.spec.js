import { test, expect } from "@playwright/test";
import { installProviderMocks, ORG_BOOKING } from "./helpers/mockProvider.js";

test.describe("Provider inspection create", () => {
  test("/inspections → Новый отчёт → Создать черновик", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "service_center",
      bookings: [ORG_BOOKING],
    });

    const posts = [];
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/inspections\/reports\/?$/.test(req.url())) {
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

    await page.getByRole("button", { name: "Новый отчёт" }).click();
    await expect(page.getByRole("heading", { name: "Новый отчёт" })).toBeVisible({ timeout: 10_000 });

    await page.locator(".inspection-create-form select").first().selectOption("501");
    await page.getByPlaceholder("Авто (марка, модель)").fill("Hyundai Solaris");
    await page.getByPlaceholder("Госномер").fill("А123ВС77");
    await page.getByPlaceholder("VIN").fill("XWEHXXXXXXXXXXXXX");
    await page.getByPlaceholder("Заметки мастера").fill("Осмотр приёмки");
    await page.getByRole("button", { name: "Создать черновик" }).click();

    await expect
      .poll(
        () =>
          posts.some(
            (p) =>
              p.client === 501 &&
              p.vehicle_title === "Hyundai Solaris" &&
              p.vehicle_plate === "А123ВС77",
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(page.getByText("Черновик создан.")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".inspection-badge")).toContainText("Черновик");
  });
});

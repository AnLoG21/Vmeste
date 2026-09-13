import { test, expect } from "@playwright/test";
import { installProviderMocks, ORG_BOOKING } from "./helpers/mockProvider.js";

test.describe("Provider inspection add + send", () => {
  test("/inspections → create → add item → send", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "service_center",
      bookings: [ORG_BOOKING],
    });

    const itemPosts = [];
    const sendPosts = [];
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      const url = req.url();
      try {
        const body = JSON.parse(req.postData() || "{}");
        if (/\/inspections\/reports\/\d+\/items\/?/.test(url)) itemPosts.push(body);
        if (/\/inspections\/reports\/\d+\/send\/?/.test(url)) sendPosts.push(body);
      } catch {
        /* ignore */
      }
    });

    await page.goto("/inspections");
    await expect(page.getByRole("heading", { name: "Интерактивная приёмка" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Новый отчёт" }).click();
    await page.locator(".inspection-create-form select").first().selectOption("501");
    await page.getByPlaceholder("Авто (марка, модель)").fill("Hyundai Solaris");
    await page.getByPlaceholder("Госномер").fill("А123ВС77");
    await page.getByRole("button", { name: "Создать черновик" }).click();
    await expect(page.getByText("Черновик создан.")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".inspection-badge")).toContainText("Черновик");

    const addForm = page.locator(".inspection-add-item");
    await expect(addForm.getByRole("heading", { name: "Добавить пункт" })).toBeVisible({
      timeout: 10_000,
    });
    await addForm.getByPlaceholder("Название (например, тормозные колодки)").fill("Тормозные колодки");
    await addForm.getByLabel("Запчасти, ₽").fill("1500");
    await addForm.getByLabel("Работа, ₽").fill("2000");
    await addForm.getByRole("button", { name: "Добавить пункт" }).click();

    await expect
      .poll(() => itemPosts.some((p) => p.title === "Тормозные колодки" && p.severity === "recommended"), {
        timeout: 15_000,
      })
      .toBe(true);
    await expect(page.getByText("Пункт добавлен.")).toBeVisible({ timeout: 10_000 });

    const sendBtn = page.getByRole("button", { name: "Отправить клиенту" });
    await expect(sendBtn).toBeEnabled();
    await sendBtn.click();
    await expect.poll(() => sendPosts.length > 0, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText("Отправлено клиенту.")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".inspection-badge")).toContainText("Ожидает клиента");
  });
});

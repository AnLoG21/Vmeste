import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const ORDER = {
  id: 9101,
  mode: "pickup",
  status: "paid",
  guest_name: "Гость",
  guest_phone: "",
  total: "1200.00",
  items: [{ id: 1, name: "Краска 7.1", quantity: 1, selected_size: "" }],
};

test.describe("Provider shop order status", () => {
  test("/shop → Заказы → assembling → ready → done", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "shops",
      shopOrders: [ORDER],
    });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && /\/shop\/orders\/\d+\/?/.test(req.url())) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/shop");
    await expect(page.getByRole("heading", { name: "Магазин / склад" })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator(".shop-tabs").getByRole("button", { name: "Заказы", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Заказы магазина" })).toBeVisible({
      timeout: 10_000,
    });

    const card = page.locator("article").filter({ hasText: "#9101" });
    await expect(card).toContainText("Оплачен");

    await card.getByRole("button", { name: "→ Собирается" }).click();
    await expect.poll(() => patches.some((p) => p.status === "assembling"), { timeout: 15_000 }).toBe(true);
    await expect(card).toContainText("Собирается");
    await expect(page.getByText(/Статус обновлён/i)).toBeVisible({ timeout: 10_000 });

    await card.getByRole("button", { name: "→ Готов" }).click();
    await expect.poll(() => patches.some((p) => p.status === "ready"), { timeout: 15_000 }).toBe(true);
    await expect(card).toContainText("Готов");

    await card.getByRole("button", { name: "→ Завершён" }).click();
    await expect.poll(() => patches.some((p) => p.status === "done"), { timeout: 15_000 }).toBe(true);
    await expect(card).toContainText("Завершён");
  });
});

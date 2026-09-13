import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const ORDER = {
  id: 9001,
  mode: "dine_in",
  status: "accepted",
  table_label: "Стол 1",
  total: "450.00",
  guest_phone: "",
  guest_name: "Гость",
  comment: "",
  items: [{ id: 1, name: "Латте", quantity: 1, removed_ingredients: [] }],
};

test.describe("Provider cafe order status", () => {
  test("/cafe-orders → cooking → ready → done", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "cafe_restaurant",
      cafeOrders: [ORDER],
    });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && /\/cafe\/orders\/\d+\/?/.test(req.url())) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/cafe-orders");
    await expect(page.getByRole("heading", { name: "Заказы и посадка" })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("#9001")).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".cafe-order-badge--accepted")).toContainText("Принят");

    await page.locator(".cafe-provider-tabs").getByRole("button", { name: /Кухня/ }).click();
    await expect(page.getByText(/Экран кухни/)).toBeVisible({ timeout: 10_000 });
    const kitchenCard = page.locator(".cafe-kitchen-card").filter({ hasText: "#9001" });
    await kitchenCard.getByRole("button", { name: "Готовится", exact: true }).click();
    await expect.poll(() => patches.some((p) => p.status === "cooking"), { timeout: 15_000 }).toBe(true);
    await expect(kitchenCard.locator(".cafe-order-badge--cooking")).toContainText("Готовится");

    await kitchenCard.getByRole("button", { name: "Готов", exact: true }).click();
    await expect.poll(() => patches.some((p) => p.status === "ready"), { timeout: 15_000 }).toBe(true);
    await expect(kitchenCard.locator(".cafe-order-badge--ready")).toContainText("Готов");

    await page.locator(".cafe-provider-tabs").getByRole("button", { name: "Заказы", exact: true }).click();
    const hallCard = page.locator(".cafe-order-card").filter({ hasText: "#9001" });
    await hallCard.getByRole("button", { name: "Развернуть" }).click();
    await hallCard.getByRole("button", { name: "Завершён" }).click();
    await expect.poll(() => patches.some((p) => p.status === "done"), { timeout: 15_000 }).toBe(true);
    await expect(hallCard.locator(".cafe-order-badge--done")).toContainText("Завершён");
  });
});

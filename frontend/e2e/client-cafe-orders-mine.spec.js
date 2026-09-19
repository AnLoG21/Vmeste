import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

const CAFE_ORDER = {
  id: 4401,
  status: "cooking",
  mode: "takeaway",
  total: "890.00",
  organization_name: "Кафе E2E",
  created_at: new Date().toISOString(),
  items: [{ name: "Борщ", qty: 1, price: "890.00" }],
};

test.describe("Client cafe orders mine", () => {
  test("/cafe-orders-mine → список заказов", async ({ page }) => {
    await installClientMocks(page, { cafeOrders: [CAFE_ORDER] });

    await page.goto("/cafe-orders-mine");
    await expect(page.getByRole("heading", { name: "Заказы из ресторанов", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Кафе E2E")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Готовится|cooking/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const RETURN = {
  id: 9401,
  status: "pending",
  reason: "Не подошёл размер",
  seller_note: "",
  refund_id: "",
  order_id: 9101,
  order_item_id: 1,
  product_name: "Краска 7.1",
  quantity: 1,
  unit_price: "1200.00",
  line_total: "1200.00",
  selected_size: "M",
  client_name: "Гость",
  client_phone: "",
  photos: [],
  created_at: "2026-09-01T12:00:00Z",
};

const RETURN2 = {
  ...RETURN,
  id: 9402,
  reason: "Брак",
  order_item_id: 2,
};

test.describe("Provider shop returns", () => {
  test("/shop → Возвраты → approve + reject", async ({ page }) => {
    await installProviderMocks(page, {
      providerSphere: "shops",
      shopReturns: [RETURN, RETURN2],
    });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && /\/shop\/returns\/?/.test(req.url())) {
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
    await page.locator(".shop-tabs").getByRole("button", { name: "Возвраты", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Возвраты" })).toBeVisible({
      timeout: 10_000,
    });

    const card1 = page.locator("article").filter({ hasText: "#9401" });
    await expect(card1).toContainText("На рассмотрении");
    await card1.getByRole("button", { name: "Одобрить" }).click();
    await expect
      .poll(() => patches.some((p) => p.id === 9401 && p.status === "approved"), {
        timeout: 15_000,
      })
      .toBe(true);
    await expect(card1).toContainText("Одобрен");
    await expect(page.getByText(/Заявка одобрена/i)).toBeVisible({ timeout: 10_000 });

    const card2 = page.locator("article").filter({ hasText: "#9402" });
    await expect(card2).toContainText("На рассмотрении");
    await card2.getByPlaceholder("Причина отклонения или условия возврата").fill(
      "Не принимаем без бирки",
    );
    await card2.getByRole("button", { name: "Отклонить" }).click();
    await expect
      .poll(
        () =>
          patches.some(
            (p) =>
              p.id === 9402 &&
              p.status === "rejected" &&
              p.seller_note === "Не принимаем без бирки",
          ),
        { timeout: 15_000 },
      )
      .toBe(true);
    await expect(card2).toContainText("Отклонён");
  });
});

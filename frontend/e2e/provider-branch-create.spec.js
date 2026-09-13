import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider branch create", () => {
  test("/organization → Добавить филиал → POST /locations/", async ({ page }) => {
    await installProviderMocks(page);
    await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "55.800000",
            lon: "37.600000",
            display_name: "Москва, ул. Северная, 5",
            address: { city: "Москва", road: "ул. Северная", house_number: "5" },
          },
        ]),
      });
    });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/locations\/?$/.test(new URL(req.url()).pathname)) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Филиалы" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Добавить филиал" }).click();

    await page.getByPlaceholder("Название филиала").fill("Филиал Север");
    await page.getByPlaceholder("Адрес филиала").fill("Москва, ул. Северная, 5");
    await page.getByRole("button", { name: "Сохранить филиал" }).click();

    await expect.poll(() => postBody?.title, { timeout: 15_000 }).toBe("Филиал Север");
    expect(String(postBody.address || "")).toMatch(/Северная|Москва/);
    await expect(page.getByText("Филиал Север")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Пока нет филиалов/)).toHaveCount(0);
  });
});

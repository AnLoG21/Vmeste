import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

async function mockNominatim(page) {
  await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          lat: "55.751244",
          lon: "37.618423",
          display_name: "Москва, ул. Тестовая, 1",
          address: {
            city: "Москва",
            road: "ул. Тестовая",
            house_number: "1",
            country: "Россия",
          },
        },
      ]),
    });
  });
}

test.describe("Provider org address", () => {
  test("/organization → Изменить адрес → PATCH me", async ({ page }) => {
    await installProviderMocks(page);
    await mockNominatim(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/users/me")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Адрес организации (основной)" })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Изменить" }).click();

    await page.getByPlaceholder("Название организации").fill("Салон E2E Address");
    await page.getByPlaceholder("Адрес (улица, дом)").fill("Москва, ул. Тестовая, 1");
    await page.getByPlaceholder("Подъезд").fill("3");
    await page.locator(".org-main-edit-form").getByRole("button", { name: "Сохранить" }).click();

    await expect.poll(() => patchBody?.organization_name, { timeout: 15_000 }).toBe("Салон E2E Address");
    expect(String(patchBody.organization_address || "")).toMatch(/Тестовая|Москва/);
    expect(patchBody.organization_entrance).toBe("3");
    await expect(page.getByText(/Адрес организации обновлён/i)).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const BRANCH = {
  id: 7101,
  provider: 601,
  title: "Филиал Юг",
  address: "Москва, ул. Южная, 2",
  latitude: "55.700000",
  longitude: "37.600000",
  entrance: "",
  floor: "",
  apartment: "",
  intercom: "",
  address_details: "",
};

test.describe("Provider branch edit/delete", () => {
  test("/organization → rename branch → PATCH locations", async ({ page }) => {
    await installProviderMocks(page, { locations: [BRANCH] });
    await page.route("**/nominatim.openstreetmap.org/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            lat: "55.700000",
            lon: "37.600000",
            display_name: BRANCH.address,
            address: { city: "Москва", road: "ул. Южная", house_number: "2" },
          },
        ]),
      });
    });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes(`/locations/${BRANCH.id}`)) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Филиалы" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Филиал Юг/ }).click();
    await page.locator(".org-branch-detail").getByRole("button", { name: "Изменить" }).click();
    await page.getByPlaceholder("Название филиала").fill("Филиал Юг 2");
    await page.locator(".org-branch-detail form").getByRole("button", { name: /Сохранить/ }).click();

    await expect.poll(() => patchBody?.title, { timeout: 15_000 }).toBe("Филиал Юг 2");
    await expect(page.locator(".org-branch-pick-title", { hasText: "Филиал Юг 2" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("/organization → Удалить филиал → DELETE locations", async ({ page }) => {
    await installProviderMocks(page, { locations: [BRANCH] });

    let deleted = false;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes(`/locations/${BRANCH.id}`)) {
        deleted = true;
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Филиалы" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /Филиал Юг/ }).click();
    await page.locator(".org-branch-detail").getByRole("button", { name: "Удалить" }).click();

    await expect.poll(() => deleted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Пока нет филиалов/)).toBeVisible({ timeout: 10_000 });
  });
});

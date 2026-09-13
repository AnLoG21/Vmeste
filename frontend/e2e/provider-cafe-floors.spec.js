import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider cafe floors/tables", () => {
  test("/cafe → Зал + стол → delete table/floor", async ({ page }) => {
    await installProviderMocks(page, { providerSphere: "cafe_restaurant" });

    let floorPosts = [];
    let tablePost = null;
    let tableDelete = false;
    let floorDelete = false;
    page.on("request", (req) => {
      const url = req.url();
      const path = (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })();
      if (req.method() === "POST" && /\/cafe\/floors\/?$/.test(path)) {
        try {
          floorPosts.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
      if (req.method() === "POST" && /\/cafe\/floors\/\d+\/tables\/?$/.test(path)) {
        try {
          tablePost = JSON.parse(req.postData() || "{}");
        } catch {
          tablePost = null;
        }
      }
      if (req.method() === "DELETE" && /\/cafe\/tables\/\d+\/?$/.test(path)) {
        tableDelete = true;
      }
      if (req.method() === "DELETE" && /\/cafe\/floors\/\d+\/?$/.test(path)) {
        floorDelete = true;
      }
    });

    await page.goto("/cafe");
    await expect(page.getByRole("heading", { name: "Зал и меню" })).toBeVisible({ timeout: 20_000 });
    await page.locator(".cafe-provider-tabs").getByRole("button", { name: "Зал и столы", exact: true }).click();

    await page.getByRole("button", { name: "+ Зал" }).click();
    await expect.poll(() => floorPosts.length, { timeout: 15_000 }).toBe(1);
    expect(floorPosts[0].name).toMatch(/Зал 1/);
    await expect(page.getByRole("button", { name: "Зал 1" })).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "+ Круглый" }).click();
    await expect.poll(() => tablePost?.shape, { timeout: 15_000 }).toBe("round");
    expect(tablePost.label).toMatch(/Стол 1/);

    await expect(page.getByText("QR стола — скан → меню и корзина")).toBeVisible({ timeout: 10_000 });
    await page.locator(".cafe-floor-wrap").getByRole("button", { name: "Удалить", exact: true }).click();
    await expect(page.getByText("Удалить стол?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();
    await expect.poll(() => tableDelete, { timeout: 15_000 }).toBe(true);

    await page.getByRole("button", { name: "+ Зал" }).click();
    await expect.poll(() => floorPosts.length, { timeout: 15_000 }).toBe(2);
    await page.getByRole("button", { name: "Зал 1" }).click();
    await page.getByRole("button", { name: "Удалить Зал 1" }).click();
    await expect(page.getByText("Удалить зал?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();
    await expect.poll(() => floorDelete, { timeout: 15_000 }).toBe(true);
  });
});

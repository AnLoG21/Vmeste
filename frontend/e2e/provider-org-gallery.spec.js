import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Provider org gallery", () => {
  test("/organization → Добавить фото → POST /users/gallery/", async ({ page }) => {
    await installProviderMocks(page);

    let uploaded = false;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/gallery")) {
        uploaded = true;
      }
    });

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Карточка для клиентов" })).toBeVisible({
      timeout: 20_000,
    });

    await page
      .locator(".org-profile-form input[type='file'][accept='image/*']")
      .setInputFiles({ name: "org-e2e.png", mimeType: "image/png", buffer: PNG });

    await expect.poll(() => uploaded, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Фото добавлено/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator(".org-gallery-item")).toHaveCount(1, { timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CSV = "имя,телефон,источник\nАнна Импорт,+79001112233,Instagram\n";

test.describe("Provider clients Excel import", () => {
  test("/clients → Перенести базу из Excel → POST multipart", async ({ page }) => {
    await installProviderMocks(page);

    let importPosted = false;
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      try {
        const u = new URL(req.url());
        if (!/\/booking\/clients\/?$/.test(u.pathname)) return;
        const ct = (req.headers()["content-type"] || "").toLowerCase();
        if (ct.includes("multipart/form-data")) importPosted = true;
      } catch {
        /* ignore */
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Перенести базу из Excel" }).click();
    await expect(page.getByRole("heading", { name: "Перенести базу из Excel" })).toBeVisible({
      timeout: 10_000,
    });

    await page
      .locator(".clients-base-modal input[type=file]")
      .setInputFiles({ name: "clients.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });

    await expect.poll(() => importPosted, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Импортировано/i)).toBeVisible({ timeout: 10_000 });
  });
});

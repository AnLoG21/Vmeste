import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider clients base", () => {
  test("/clients → Добавить клиента → POST /booking/clients/", async ({ page }) => {
    await installProviderMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/clients\/?$/.test(new URL(req.url()).pathname)) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: "Добавить клиента" }).click();

    await page.getByPlaceholder("Анна Иванова").fill("Новый Клиент");
    await page.getByPlaceholder("+7…").fill("+79003334455");
    await page.locator(".clients-base-modal").getByRole("button", { name: "Добавить", exact: true }).click();

    await expect.poll(() => postBody?.name, { timeout: 15_000 }).toBe("Новый Клиент");
    expect(postBody.phone).toBe("+79003334455");
    await expect(page.getByText(/Клиент добавлен/i)).toBeVisible({ timeout: 10_000 });
  });
});

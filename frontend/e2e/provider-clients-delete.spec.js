import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CLIENT = {
  id: 701,
  name: "Ольга База",
  phone: "+79005551122",
  avatar_url: "",
  avatar_initial: "О",
  visits_done: 2,
};

test.describe("Provider clients delete", () => {
  test("/clients → Удалить из базы → DELETE", async ({ page }) => {
    await installProviderMocks(page, { clients: [CLIENT] });

    let deletedId = null;
    page.on("request", (req) => {
      if (req.method() === "DELETE" && req.url().includes("/booking/clients")) {
        try {
          deletedId = new URL(req.url()).searchParams.get("client");
        } catch {
          deletedId = null;
        }
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Ольга База")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Удалить из базы" }).click();
    await expect(page.getByText("Удалить клиента?")).toBeVisible({ timeout: 10_000 });
    await page.locator(".vmeste-confirm-ok").click();

    await expect.poll(() => deletedId, { timeout: 15_000 }).toBe("701");
    await expect(page.getByText(/Удалено из базы/i)).toBeVisible({ timeout: 10_000 });
  });
});

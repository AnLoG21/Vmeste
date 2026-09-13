import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const CLIENT = {
  id: 702,
  name: "Ирина Карта",
  phone: "+79006667788",
  avatar_url: "",
  avatar_initial: "И",
  visits_done: 1,
};

test.describe("Provider client memory card", () => {
  test("/clients → карточка → Сохранить → PATCH client-cards", async ({ page }) => {
    await installProviderMocks(page, { clients: [CLIENT] });

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/client-cards")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await page.locator(".clients-base-card-main").filter({ hasText: "Ирина Карта" }).click();

    await expect(page.getByRole("heading", { name: /Ирина Карта/ })).toBeVisible({ timeout: 10_000 });
    await page.locator(".client-memory-modal").getByRole("tab", { name: "Надёжность" }).click();
    await page.getByPlaceholder("Реклама, рекомендация…").fill("Instagram");
    await page.locator(".client-memory-modal").getByRole("button", { name: "Сохранить" }).click();

    await expect.poll(() => patchBody?.acquisition_source, { timeout: 15_000 }).toBe("Instagram");
    await expect(page.getByText(/Карточка сохранена/i)).toBeVisible({ timeout: 10_000 });
  });

  test("/clients → карточка → блок + field_prefs → PATCH", async ({ page }) => {
    await installProviderMocks(page, { clients: [CLIENT] });

    const patches = [];
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/booking/client-cards")) {
        try {
          patches.push(JSON.parse(req.postData() || "{}"));
        } catch {
          /* ignore */
        }
      }
    });

    await page.goto("/clients");
    await expect(page.getByRole("heading", { name: "База клиентов" })).toBeVisible({ timeout: 20_000 });
    await page.locator(".clients-base-card-main").filter({ hasText: "Ирина Карта" }).click();
    await expect(page.getByRole("heading", { name: /Ирина Карта/ })).toBeVisible({ timeout: 10_000 });

    const modal = page.locator(".client-memory-modal");
    await modal.getByRole("button", { name: "Настройки полей" }).click();
    await modal.locator(".client-memory-check").filter({ hasText: "Краска / формула" }).locator("input").click();
    await expect
      .poll(() => patches.some((p) => p.field_prefs && p.field_prefs.hair_color === false), {
        timeout: 15_000,
      })
      .toBe(true);

    await modal.getByRole("tab", { name: "Надёжность" }).click();
    await modal.getByText("В чёрном списке (онлайн-запись недоступна)").click();
    await modal.getByRole("button", { name: "Сохранить" }).click();

    await expect.poll(() => patches.some((p) => p.is_blocked === true), { timeout: 15_000 }).toBe(true);
    await expect(page.getByText(/Карточка сохранена/i)).toBeVisible({ timeout: 10_000 });
  });
});

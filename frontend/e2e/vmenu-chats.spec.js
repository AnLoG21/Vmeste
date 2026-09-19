import { test, expect } from "@playwright/test";
import { installVmenuMocks } from "./helpers/mockVmenu.js";

const FOLLOWER = {
  id: 520,
  username: "follower-e2e",
  first_name: "Подписчик",
  last_name: "Тест",
  display_name: "Подписчик Тест",
  avatar_url: "",
  can_message: true,
};

test.describe("Вменю chats", () => {
  test("/vmenu → Чаты → Подписчики", async ({ page }) => {
    await installVmenuMocks(page, { chatFollowers: [FOLLOWER] });

    let contactsUrl = null;
    page.on("request", (req) => {
      if (req.method() === "GET" && req.url().includes("/vmenu/chats/contacts")) {
        contactsUrl = req.url();
      }
    });

    await page.goto("/vmenu");
    await expect(page.getByRole("heading", { name: "Вменю", exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: /Чаты/ }).click();

    await expect.poll(() => contactsUrl, { timeout: 15_000 }).toBeTruthy();
    await expect(page.getByText("Подписчики", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(FOLLOWER.display_name, { exact: true })).toBeVisible();
  });
});

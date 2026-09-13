import { test, expect } from "@playwright/test";
import { installProviderMocks, ME } from "./helpers/mockProvider.js";

const SAVED = {
  id: 1,
  title: "",
  is_group: false,
  is_saved_messages: true,
  is_client_correspondence: false,
  is_user_direct: false,
  organization: null,
  members: [{ user: ME.id, username: ME.username, role: "provider" }],
  last_message: null,
  unread_message_count: 0,
};

test.describe("Provider chats smoke", () => {
  test("/chats → Избранное in org folder", async ({ page }) => {
    await installProviderMocks(page, { conversations: [SAVED] });

    await page.goto("/chats");
    await expect(page.getByText("Чаты").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Избранное").first()).toBeVisible({ timeout: 15_000 });
  });
});

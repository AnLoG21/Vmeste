import { test, expect } from "@playwright/test";
import { installClientMocks, ME, ORG } from "./helpers/mockApi.js";

const ORG_CHAT = {
  id: 2,
  title: "",
  is_group: false,
  is_saved_messages: false,
  is_client_correspondence: true,
  is_user_direct: false,
  organization: ORG.provider,
  members: [
    { user: ME.id, username: ME.username, role: "client" },
    {
      user: ORG.provider,
      username: "salon-e2e",
      role: "provider",
      organization_name: ORG.organization_name,
    },
  ],
  last_message: { text: "Ждём вас", created_at: new Date().toISOString() },
  unread_message_count: 1,
};

test.describe("Client chats smoke", () => {
  test("/chats → org chat → open thread", async ({ page }) => {
    await installClientMocks(page, {
      conversations: [ORG_CHAT],
    });

    await page.goto("/chats");
    await expect(page.getByText("Чаты").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(ORG.organization_name).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/Ждём вас/)).toBeVisible();

    await page.getByText(ORG.organization_name).first().click();
    await expect(page.getByPlaceholder("Сообщение...")).toBeVisible({ timeout: 10_000 });
  });
});

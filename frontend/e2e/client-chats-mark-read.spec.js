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
  last_message: { id: 501, text: "Напоминание", created_at: new Date().toISOString() },
  unread_message_count: 1,
};

const SEED_MSG = {
  id: 501,
  conversation: 2,
  sender: ORG.provider,
  kind: "text",
  text: "Напоминание",
  display_text: "Напоминание",
  created_at: new Date().toISOString(),
  sender_username: "salon-e2e",
};

test.describe("Client chat mark-read", () => {
  test("/chats → open thread → POST mark-read", async ({ page }) => {
    await installClientMocks(page, {
      conversations: [ORG_CHAT],
      seedMessages: [SEED_MSG],
    });

    let markBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/conversations\/\d+\/mark-read/.test(req.url())) {
        try {
          markBody = JSON.parse(req.postData() || "{}");
        } catch {
          markBody = null;
        }
      }
    });

    await page.goto("/chats");
    await expect(page.getByText(ORG.organization_name).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(ORG.organization_name).first().click();
    await expect(page.locator("#tg-msg-501").getByText("Напоминание")).toBeVisible({ timeout: 10_000 });
    await expect.poll(() => Number(markBody?.message_id), { timeout: 15_000 }).toBe(501);
  });
});

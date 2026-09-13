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
  last_message: null,
  unread_message_count: 0,
};

test.describe("Client chat send", () => {
  test("/chats → type → Отправить → POST /messages/", async ({ page }) => {
    await installClientMocks(page, { conversations: [ORG_CHAT] });

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/chat/messages")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/chats");
    await expect(page.getByText(ORG.organization_name).first()).toBeVisible({ timeout: 20_000 });
    await page.getByText(ORG.organization_name).first().click();
    await expect(page.getByPlaceholder("Сообщение...")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Сообщение...").fill("Привет из E2E");
    await page.getByRole("button", { name: "Отправить сообщение" }).click();

    await expect.poll(() => postBody?.text, { timeout: 15_000 }).toBe("Привет из E2E");
    expect(Number(postBody.conversation)).toBe(ORG_CHAT.id);
    await expect(page.getByText("Привет из E2E")).toBeVisible({ timeout: 10_000 });
  });
});

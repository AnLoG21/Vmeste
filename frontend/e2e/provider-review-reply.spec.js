import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

const REVIEW = {
  id: 501,
  rating: 5,
  text: "Супер стрижка",
  client_name: "Мария Отзыв",
  staff_name: "",
  photos: [],
  reply: null,
  likes_count: 0,
  liked_by_me: false,
  is_new: true,
  created_at: new Date().toISOString(),
};

test.describe("Provider review reply + mark-seen", () => {
  test("/reviews → Ответить → POST reply + mark-seen", async ({ page }) => {
    await installProviderMocks(page, { reviews: [REVIEW] });

    let markSeen = false;
    let replyBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/reviews/mark-seen")) {
        markSeen = true;
      }
      if (req.method() === "POST" && /\/reviews\/\d+\/reply\/?/.test(req.url())) {
        try {
          replyBody = JSON.parse(req.postData() || "{}");
        } catch {
          replyBody = null;
        }
      }
    });

    await page.goto("/reviews");
    await expect(page.getByRole("heading", { name: "Отзывы" })).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => markSeen, { timeout: 15_000 }).toBe(true);
    await expect(page.getByText("Мария Отзыв")).toBeVisible({ timeout: 10_000 });

    await page.getByRole("button", { name: "Ответить" }).click();
    await page.getByPlaceholder("Текст ответа").fill("Спасибо, ждем снова!");
    await page.getByRole("button", { name: "Отправить" }).click();

    await expect.poll(() => replyBody?.text, { timeout: 15_000 }).toBe("Спасибо, ждем снова!");
    expect(replyBody.publish_reply).toBe(true);
    await expect(page.getByText(/Ответ организации/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Спасибо, ждем снова!")).toBeVisible();
  });
});

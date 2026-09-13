import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client change password", () => {
  test("/settings → Сменить пароль → POST change-password", async ({ page }) => {
    await installClientMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/change-password")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Смена пароля" })).toBeVisible({ timeout: 20_000 });

    await page.getByPlaceholder("Старый пароль").fill("OldPass123!");
    await page.getByPlaceholder("Новый пароль", { exact: true }).fill("NewPass456!");
    await page.getByPlaceholder("Повтори новый пароль").fill("NewPass456!");
    await page.getByRole("button", { name: "Сменить пароль" }).click();

    await expect.poll(() => postBody?.old_password, { timeout: 15_000 }).toBe("OldPass123!");
    expect(postBody.new_password).toBe("NewPass456!");
    await expect(page.getByText(/почт/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client delete account", () => {
  test("/cabinet → Удалить аккаунт → POST me/delete → logout", async ({ page }) => {
    await installClientMocks(page);

    let postBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/users/me/delete")) {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
      }
    });

    await page.goto("/cabinet");
    await expect(page.getByRole("heading", { name: "Удаление аккаунта" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByPlaceholder("Текущий пароль").fill("DeleteMe123!");
    await page.getByPlaceholder('Введите «удалить»').fill("удалить");
    await page.getByRole("button", { name: "Удалить аккаунт" }).click();

    await expect.poll(() => postBody?.confirm, { timeout: 15_000 }).toBe("удалить");
    expect(postBody.password).toBe("DeleteMe123!");
    await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Личный кабинет" })).toHaveCount(0);
  });
});

import { test, expect } from "@playwright/test";
import { installClientMocks } from "./helpers/mockApi.js";

test.describe("Client update profile", () => {
  test("/cabinet → Сохранить данные → PATCH /users/me/", async ({ page }) => {
    await installClientMocks(page);

    let patchBody = null;
    page.on("request", (req) => {
      if (req.method() === "PATCH" && req.url().includes("/users/me")) {
        try {
          patchBody = JSON.parse(req.postData() || "{}");
        } catch {
          patchBody = null;
        }
      }
    });

    await page.goto("/cabinet");
    await expect(page.getByRole("heading", { name: "Личная информация" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByPlaceholder("Фамилия").fill("Петров");
    await page.getByPlaceholder("Имя", { exact: true }).fill("Пётр");
    await page.getByPlaceholder("Отчество").fill("Петрович");
    await page.getByPlaceholder("Телефон").fill("+79005556677");
    await page.getByRole("button", { name: "Сохранить данные" }).click();

    await expect.poll(() => patchBody?.last_name, { timeout: 15_000 }).toBe("Петров");
    expect(patchBody.first_name).toBe("Пётр");
    expect(patchBody.patronymic).toBe("Петрович");
    expect(String(patchBody.phone)).toContain("9005556677");
    await expect(page.getByText(/Данные сохранены/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

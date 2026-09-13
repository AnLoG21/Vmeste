import { test, expect } from "@playwright/test";
import { installProviderMocks } from "./helpers/mockProvider.js";

test.describe("Provider booking messages", () => {
  test("/organization → save booking messages → PATCH me", async ({ page }) => {
    await installProviderMocks(page);

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

    await page.goto("/organization");
    await expect(page.getByRole("heading", { name: "Сообщения при работе с записями" })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("textbox", { name: "Подтверждение записи" }).fill("Запись подтверждена на {date}");
    await page.getByRole("textbox", { name: "Отмена записи" }).fill("Запись отменена {date}");
    await page.getByRole("textbox", { name: "Услуга оказана" }).fill("Услуга оказана {date}");
    await page.getByRole("button", { name: "Сохранить сообщения" }).click();

    await expect
      .poll(() => patchBody?.booking_confirm_message_default, { timeout: 15_000 })
      .toBe("Запись подтверждена на {date}");
    expect(patchBody.booking_cancel_message_default).toBe("Запись отменена {date}");
    expect(patchBody.booking_done_message_default).toBe("Услуга оказана {date}");
    await expect(page.getByText(/Сообщения.*сохранены/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Confirm password reset", () => {
  test("/reset-password?token=… → Сохранить пароль → POST confirm", async ({ page }) => {
    let postBody = null;

    await page.addInitScript(() => {
      window.__VMESTE_E2E__ = true;
      localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
    });

    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      const method = req.method();
      const json = (body, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(body),
        });

      if (path.includes("/users/confirm-password-reset") && method === "POST") {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
        return json({ detail: "Пароль обновлён. Войдите с новым паролем." });
      }
      if (path.includes("/users/me")) return json({}, 401);
      return json([]);
    });

    await page.goto("/reset-password?token=e2e-reset-token");
    const modal = page.locator(".auth-modal");
    await expect(modal.getByRole("heading", { name: "Новый пароль" })).toBeVisible({ timeout: 20_000 });

    // Scope to the dialog: after mobile landing folds, page scrollIntoView can land
    // clicks on the dimmed auth-modal-overlay instead of the submit control.
    await modal.getByPlaceholder("Новый пароль", { exact: true }).fill("NewPass456!");
    await modal.getByPlaceholder("Повторите новый пароль").fill("NewPass456!");
    await modal.locator("form").evaluate((form) => form.requestSubmit());

    await expect.poll(() => postBody?.token, { timeout: 15_000 }).toBe("e2e-reset-token");
    expect(postBody.new_password).toBe("NewPass456!");
    await expect(page.getByText(/Пароль обновлён|новым паролем/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("dialog").or(page.locator(".auth-modal")).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

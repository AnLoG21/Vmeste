import { test, expect } from "@playwright/test";

test.describe("Confirm password change", () => {
  test("/confirm-password-change?token=… → POST confirm → login modal", async ({ page }) => {
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

      if (path.includes("/users/confirm-password-change") && method === "POST") {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
        return json({ detail: "Пароль успешно изменён. Можно войти с новым паролем." });
      }
      if (path.includes("/users/me")) return json({}, 401);
      return json([]);
    });

    await page.goto("/confirm-password-change?token=e2e-confirm-token");

    await expect.poll(() => postBody?.token, { timeout: 15_000 }).toBe("e2e-confirm-token");
    await expect(page.getByText(/Пароль успешно изменён|пароль изменён/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("dialog").or(page.locator(".auth-modal")).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

import { test, expect } from "@playwright/test";

test.describe("Verify email", () => {
  test("/verify-email?token=… → POST verify-email → login modal", async ({ page }) => {
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

      if (path.includes("/users/verify-email") && method === "POST") {
        try {
          postBody = JSON.parse(req.postData() || "{}");
        } catch {
          postBody = null;
        }
        return json({ detail: "ok" });
      }
      if (path.includes("/users/me")) return json({}, 401);
      return json([]);
    });

    await page.goto("/verify-email?token=e2e-verify-token");

    await expect.poll(() => postBody?.token, { timeout: 15_000 }).toBe("e2e-verify-token");
    await expect(page.getByText(/Email подтвержден|подтвержд/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("dialog").or(page.locator(".auth-modal")).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

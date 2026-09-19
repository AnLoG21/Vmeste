import { test, expect } from "@playwright/test";

test.describe("Landing auth smoke", () => {
  test("open login modal → mock JWT login", async ({ page }) => {
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const path = url.pathname.replace(/\/+$/, "") || "/";
      const method = req.method();
      const json = (data, status = 200) =>
        route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify(data),
        });

      if (path.includes("/auth/token") && method === "POST" && !path.includes("refresh")) {
        return json({ access: "e2e-access-token", refresh: "e2e-refresh-token" });
      }
      if (path.endsWith("/users/me") && method === "GET") {
        return json({
          id: 501,
          username: "e2e-client",
          role: "client",
          first_name: "Тест",
          last_name: "Клиент",
          email: "e2e@example.com",
          profile_complete: true,
          needs_credentials_setup: false,
          email_verified: true,
        });
      }
      if (path.includes("/users/auth/providers") && method === "GET") {
        return json({ yandex: false, vk: false, telegram: false });
      }
      if (path.includes("/subscriptions/") && method === "GET") return json([]);
      if (path.includes("/notifications") && method === "GET") return json([]);
      if (method === "GET") return json([]);
      return json({ ok: true });
    });

    await page.addInitScript(() => {
      localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /Вместе/i }).first()).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: "Уже есть аккаунт — войти" }).click();
    await expect(page.getByPlaceholder("Логин")).toBeVisible({ timeout: 10_000 });
    await page.getByPlaceholder("Логин").fill("e2e-client");
    await page.getByPlaceholder("Пароль").fill("password123");
    await page.locator(".auth-modal").getByRole("button", { name: "Войти", exact: true }).click();

    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("vmeste_access")), { timeout: 15_000 })
      .toBe("e2e-access-token");
  });

  test("open register CTA from hero", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("vmeste_cookie_consent_v1", "necessary");
    });
    await page.route("**/api/users/auth/providers/**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ yandex: false, vk: false, telegram: false }),
      });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Попробовать бесплатно" }).first().click();
    await expect(page.getByRole("tab", { name: "Клиент" })).toBeVisible({ timeout: 10_000 });
  });
});

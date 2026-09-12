import { test, expect } from "@playwright/test";
import {
  installClientMocks,
  ORG,
  SERVICE,
  WINDOW,
  windowKey,
  CLIENT_PACKAGE,
} from "./helpers/mockApi.js";

async function waitE2E(page) {
  await page.waitForFunction(() => Boolean(window.__vmesteE2E), null, { timeout: 30_000 });
}

async function waitLocations(page) {
  await page.waitForFunction(() => (window.__vmesteE2E?.locationsCount?.() || 0) > 0, null, {
    timeout: 30_000,
  });
}

async function prepareBookForm(
  page,
  { prepayProfile = false, usePackage = false, clientPackageId = "", loyaltyPoints = "" } = {},
) {
  const bookDate = WINDOW.starts_at.slice(0, 10);
  const key = windowKey(WINDOW);
  await page.evaluate(
    async ({ orgId, serviceId, bookDate, prepayProfile, usePackage, clientPackageId, loyaltyPoints }) => {
      await window.__vmesteE2E.selectOrg(orgId, bookDate);
      if (prepayProfile) {
        window.__vmesteE2E.setOrgProfile({
          organization_name: "Салон E2E",
          provider_sphere: "hair_salon",
          prepay: { ready: true, mode: "full", percent: 100 },
        });
      }
      window.__vmesteE2E.openBookModal();
      window.__vmesteE2E.patchBookForm({
        provider: "201",
        serviceId: String(serviceId),
        bookDate,
        staffId: "any",
        optionIds: [],
        loyaltyPoints,
        usePackage,
        clientPackageId: usePackage ? String(clientPackageId || "") : "",
        windowKey: "",
      });
    },
    {
      orgId: ORG.id,
      serviceId: SERVICE.id,
      bookDate,
      prepayProfile,
      usePackage,
      clientPackageId,
      loyaltyPoints,
    },
  );

  // Wait for available-dates effect, then inject slot + key again.
  await page.waitForTimeout(500);
  await page.evaluate(
    ({ bookDate, slot, key, usePackage, clientPackageId, loyaltyPoints }) => {
      window.__vmesteE2E.patchBookForm({
        bookDate,
        windowKey: "",
        usePackage,
        clientPackageId: usePackage ? String(clientPackageId || "") : "",
        loyaltyPoints,
      });
      window.__vmesteE2E.setBookWindows([slot]);
      window.__vmesteE2E.patchBookForm({ windowKey: key });
    },
    { bookDate, slot: WINDOW, key, usePackage, clientPackageId, loyaltyPoints },
  );
  await expect(page.locator(".client-slot-chip").first()).toBeVisible({ timeout: 10_000 });
  await page.locator(".client-slot-chip").first().click();
  await expect(page.locator(".client-book-sticky-cta button[type='submit']")).toBeEnabled({
    timeout: 10_000,
  });
}

test.describe("Client book path", () => {
  test("map → org sheet → Записаться opens book modal", async ({ page }) => {
    await installClientMocks(page);
    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);

    await page.evaluate(({ orgId }) => window.__vmesteE2E.openOrgSheet(orgId), { orgId: ORG.id });
    await expect(page.getByRole("button", { name: "Записаться" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Записаться" }).click();
    await expect(page.getByRole("heading", { name: /Запись/ })).toBeVisible();
  });

  test("free book closes sheet and lands on Моё", async ({ page }) => {
    await installClientMocks(page, { prepay: false });
    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);
    await prepareBookForm(page);

    await expect(page.getByRole("heading", { name: /Запись/ })).toBeVisible();
    const submit = page.locator(".client-book-sticky-cta button[type='submit']");
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    await expect(page.getByRole("heading", { name: "Моё" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /Запись/ })).toHaveCount(0);
  });

  test("prepay book closes modal before redirect", async ({ page }) => {
    await installClientMocks(page, { prepay: true });
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });

    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);
    await prepareBookForm(page, { prepayProfile: true });

    const submit = page.locator(".client-book-sticky-cta button[type='submit']");
    await expect(submit).toBeEnabled({ timeout: 10_000 });
    await submit.click();

    await expect.poll(() => redirected, { timeout: 15_000 }).toContain("pay.example");
    await expect(page.getByRole("heading", { name: /Запись/ })).toHaveCount(0);
  });

  test("package book posts use_package and lands on Моё", async ({ page }) => {
    await installClientMocks(page, {
      prepay: true,
      clientPackages: [CLIENT_PACKAGE],
    });
    let bookBody = null;
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/?$/.test(new URL(req.url()).pathname)) {
        try {
          bookBody = JSON.parse(req.postData() || "{}");
        } catch {
          bookBody = null;
        }
      }
    });

    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);
    await prepareBookForm(page, {
      prepayProfile: true,
      usePackage: true,
      clientPackageId: CLIENT_PACKAGE.id,
    });
    await expect(page.getByText("Оплатить абонементом")).toBeVisible();

    await page.locator(".client-book-sticky-cta button[type='submit']").click();

    await expect.poll(() => bookBody, { timeout: 15_000 }).toMatchObject({
      use_package: true,
      client_package: String(CLIENT_PACKAGE.id),
      loyalty_points: 0,
    });
    await expect.poll(() => redirected, { timeout: 5_000 }).toBe("");
    await expect(page.getByRole("heading", { name: "Моё" })).toBeVisible({ timeout: 15_000 });
  });

  test("loyalty full cover skips pay redirect", async ({ page }) => {
    await installClientMocks(page, {
      prepay: true,
      loyalty: { enabled: true, balance: 1000, rub_per_point: 1 },
    });
    let bookBody = null;
    let redirected = "";
    await page.route("https://pay.example/**", async (route) => {
      redirected = route.request().url();
      await route.fulfill({ status: 200, body: "pay" });
    });
    page.on("request", (req) => {
      if (req.method() === "POST" && /\/booking\/?$/.test(new URL(req.url()).pathname)) {
        try {
          bookBody = JSON.parse(req.postData() || "{}");
        } catch {
          bookBody = null;
        }
      }
    });

    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);
    await prepareBookForm(page, {
      prepayProfile: true,
      loyaltyPoints: "1000",
    });
    await expect(page.locator(".client-book-total")).toContainText("баллы покрывают сумму", {
      timeout: 10_000,
    });

    await page.locator(".client-book-sticky-cta button[type='submit']").click();

    await expect.poll(() => bookBody, { timeout: 15_000 }).toMatchObject({
      loyalty_points: 1000,
      use_package: false,
    });
    await expect.poll(() => redirected, { timeout: 5_000 }).toBe("");
    await expect(page.getByRole("heading", { name: "Моё" })).toBeVisible({ timeout: 15_000 });
  });

  test("booking_payment return opens Моё", async ({ page }) => {
    await installClientMocks(page);
    await page.goto("/activity?booking_payment=success&booking_id=9001");
    await waitE2E(page);
    await expect(page.getByRole("heading", { name: "Моё" })).toBeVisible({ timeout: 15_000 });
  });
});

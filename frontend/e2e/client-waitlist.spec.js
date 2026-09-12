import { test, expect } from "@playwright/test";
import { installClientMocks, ORG, SERVICE, WINDOW } from "./helpers/mockApi.js";

async function waitE2E(page) {
  await page.waitForFunction(() => Boolean(window.__vmesteE2E), null, { timeout: 30_000 });
}

async function waitLocations(page) {
  await page.waitForFunction(() => (window.__vmesteE2E?.locationsCount?.() || 0) > 0, null, {
    timeout: 30_000,
  });
}

test.describe("Client waitlist", () => {
  test("empty slots → Встать в лист ожидания → POST waitlist", async ({ page }) => {
    await installClientMocks(page, { emptyWindows: true });

    let waitlistBody = null;
    page.on("request", (req) => {
      if (req.method() === "POST" && req.url().includes("/booking/waitlist")) {
        try {
          waitlistBody = JSON.parse(req.postData() || "{}");
        } catch {
          waitlistBody = null;
        }
      }
    });

    await page.goto("/map");
    await waitE2E(page);
    await waitLocations(page);

    const bookDate = WINDOW.starts_at.slice(0, 10);
    await page.evaluate(
      async ({ orgId, serviceId, bookDate, providerId }) => {
        await window.__vmesteE2E.selectOrg(orgId, bookDate);
        window.__vmesteE2E.openBookModal();
        window.__vmesteE2E.patchBookForm({
          provider: String(providerId),
          serviceId: String(serviceId),
          bookDate,
          staffId: "any",
          optionIds: [],
          windowKey: "",
        });
        window.__vmesteE2E.setBookWindows([]);
      },
      {
        orgId: ORG.id,
        serviceId: SERVICE.id,
        bookDate,
        providerId: ORG.provider,
      },
    );

    await expect(page.getByText("Нет свободных интервалов на эту дату.")).toBeVisible({
      timeout: 10_000,
    });
    await page.getByRole("button", { name: "Встать в лист ожидания" }).click();

    await expect.poll(() => waitlistBody, { timeout: 15_000 }).toMatchObject({
      provider: ORG.provider,
      service: SERVICE.id,
      preferred_date: bookDate,
    });
    await expect(page.getByText(/Вы в листе ожидания/)).toBeVisible({ timeout: 10_000 });
  });
});

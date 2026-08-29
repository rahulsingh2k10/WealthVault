import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma } from "../helpers/testDb";
import { ensureReferenceData } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../helpers/session";

test.skip(!hasTestDb(), "TEST_DATABASE_URL is not set in frontend/.env");

test.afterAll(async () => {
  await disconnectTestPrisma();
});

test.describe("Dashboard access", () => {
  test.beforeAll(async () => {
    await ensureReferenceData();
  });

  test("visiting /dashboard with no session redirects to the landing page", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("http://localhost:3100/", { timeout: 10000 });
    expect(page.url()).toBe("http://localhost:3100/");
  });

  test("visiting /dashboard with a locked vault (no encryptionKey) redirects to /unlock", async ({ page }) => {
    const sealed = await sealSessionCookie({ userId: "does-not-need-to-exist" });
    await page.context().addCookies([
      { name: SESSION_COOKIE_NAME, value: sealed, url: "http://localhost:3100" },
    ]);

    await page.goto("/dashboard");
    await page.waitForURL(/\/unlock/, { timeout: 10000 });
    expect(page.url()).toContain("/unlock");
  });

  test("visiting /dashboard with an unlocked vault renders the shell with no error", async ({ page }) => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id, encryptionKey: "fake-key-for-ui-check" });
      await page.context().addCookies([
        { name: SESSION_COOKIE_NAME, value: sealed, url: "http://localhost:3100" },
      ]);

      await page.goto("/dashboard");
      expect(page.url()).toContain("/dashboard");

      // The app shell (header + sidebar) renders — confirms no crash reached the client.
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      await expect(page.getByText(user.fullName)).toBeVisible();

      // No Next.js error overlay/digest is present.
      await expect(page.getByText(/application error/i)).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

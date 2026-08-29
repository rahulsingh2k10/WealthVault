import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma } from "../helpers/testDb";
import { ensureReferenceData } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../helpers/session";

test.skip(!hasTestDb(), "TEST_DATABASE_URL is not set in frontend/.env");

test.afterAll(async () => {
  await disconnectTestPrisma();
});

test.describe("Dashboard upgrade prompt", () => {
  test.beforeAll(async () => {
    await ensureReferenceData();
  });

  async function signIn(page: import("@playwright/test").Page, userId: string) {
    const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-for-ui-check" });
    await page.context().addCookies([
      { name: SESSION_COOKIE_NAME, value: sealed, url: "http://localhost:3100" },
    ]);
  }

  test("a FREE user sees the modal ~6s (short in tests) after the dashboard loads", async ({ page }) => {
    const user = await createTestUser(); // FREE
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");

      const dialog = page.getByRole("dialog", { name: /your wealth, fully unlocked/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await expect(page.getByRole("heading", { name: /your wealth, fully unlocked/i })).toBeVisible();
      // Sovereign offer price (₹1,200/mo) and offer caption present.
      await expect(page.getByText("₹1,200", { exact: false })).toBeVisible();
      await expect(page.getByText(/20% off/i).first()).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("dismissing it suppresses it for the rest of the session (survives reload)", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");

      const dialog = page.getByRole("dialog", { name: /your wealth, fully unlocked/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: /maybe later/i }).click();
      await expect(dialog).toBeHidden();

      await page.reload();
      // Wait longer than the test delay, then assert it did not reappear.
      await page.waitForTimeout(1200);
      await expect(dialog).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a paid user never sees the modal", async ({ page }) => {
    const user = await createTestUser({ tier: "ANNUAL" });
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");
      await page.waitForTimeout(1200); // > test delay
      await expect(page.getByRole("dialog", { name: /your wealth, fully unlocked/i })).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("selecting Reserve moves the selection state off Sovereign", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");
      await expect(page.getByRole("dialog", { name: /your wealth, fully unlocked/i })).toBeVisible({ timeout: 5000 });

      const reserveRadio = page.getByRole("radio", { name: /reserve/i });
      await reserveRadio.click();
      await expect(reserveRadio).toHaveAttribute("aria-checked", "true");
      await expect(page.getByRole("radio", { name: /sovereign/i })).toHaveAttribute("aria-checked", "false");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

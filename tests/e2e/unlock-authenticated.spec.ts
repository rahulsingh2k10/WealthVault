import path from "path";
import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../helpers/testDb";
import { ensureReferenceData } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../helpers/session";
import { deriveKey, encrypt } from "../../frontend/src/lib/encryption";

test.skip(!hasTestDb(), "TEST_DATABASE_URL is not set in frontend/.env");

const VALID_PASSPHRASE = "TestPass123!@#";
const WRONG_PASSPHRASE = "WrongPass456$%^";

test.afterAll(async () => {
  await disconnectTestPrisma();
});

async function signInAs(page: import("@playwright/test").Page, userId: string) {
  const sealed = await sealSessionCookie({ userId });
  await page.context().addCookies([
    {
      name: SESSION_COOKIE_NAME,
      value: sealed,
      url: "http://localhost:3100",
    },
  ]);
}

test.describe("Authenticated unlock flow (seeded session, no real OAuth)", () => {
  test.beforeAll(async () => {
    await ensureReferenceData();
  });

  test("correct passphrase for a returning user reaches /dashboard", async ({ page }) => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();

      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      expect(page.url()).toContain("/dashboard");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("wrong passphrase for a returning user shows an error and stays on /unlock", async ({ page }) => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(WRONG_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();

      await expect(page.getByText("Invalid passphrase")).toBeVisible({ timeout: 10000 });
      expect(page.url()).toContain("/unlock");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("clicking Sign out clears the session and redirects to the landing page", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByRole("button", { name: "Sign out" }).click();
      await page.waitForURL("http://localhost:3100/", { timeout: 10000 });
      expect(page.url()).toBe("http://localhost:3100/");

      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeUndefined();

      // The session is gone server-side too, not just client-side — revisiting
      // /unlock now bounces back to "/" per the middleware's auth check.
      await page.goto("/unlock");
      await page.waitForURL("http://localhost:3100/", { timeout: 10000 });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("uploading an avatar replaces the initials placeholder and persists to the database", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      // No avatar yet — the initials-only placeholder and the upload prompt are showing.
      await expect(page.getByRole("button", { name: "+ Add profile photo" })).toBeVisible();
      await expect(page.getByAltText(user.fullName)).not.toBeVisible();

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(path.join(__dirname, "fixtures", "test-avatar.png"));

      const avatarImg = page.getByAltText(user.fullName);
      await expect(avatarImg).toBeVisible({ timeout: 10000 });
      const src = await avatarImg.getAttribute("src");
      // resizeImage() always re-encodes to JPEG, regardless of the source file's format.
      expect(src).toMatch(/^data:image\/jpeg;base64,/);

      const prisma = getTestPrisma();
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.avatar).toBe(src);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

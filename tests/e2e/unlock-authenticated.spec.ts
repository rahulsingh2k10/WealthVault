import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma } from "../helpers/testDb";
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
});

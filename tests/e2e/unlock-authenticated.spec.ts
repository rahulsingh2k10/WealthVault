import path from "path";
import fs from "fs";
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

  test("first-time user sees the save-passphrase confirmation before anything is written to the server", async ({ page }) => {
    const user = await createTestUser({ verifier: null });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();

      await expect(page.getByRole("heading", { name: "Secure Your Passphrase to Continue" })).toBeVisible();
      // The passphrase is shown back for the user to copy — proof nothing has
      // round-tripped to the server yet (the server never echoes it back).
      await expect(page.getByText(VALID_PASSPHRASE, { exact: true })).toBeVisible();
      expect(page.url()).toContain("/unlock");

      const prisma = getTestPrisma();
      const stillNew = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stillNew.verifier).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("\"Go back and change passphrase\" closes the save-passphrase modal and sends nothing to the server", async ({ page }) => {
    const user = await createTestUser({ verifier: null });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();
      await expect(page.getByRole("heading", { name: "Secure Your Passphrase to Continue" })).toBeVisible();

      await page.getByRole("button", { name: "Go back and change passphrase" }).click();

      await expect(page.getByRole("heading", { name: "Secure Your Passphrase to Continue" })).not.toBeVisible();
      await expect(page.getByPlaceholder("Enter your passphrase")).toHaveValue(VALID_PASSPHRASE);
      expect(page.url()).toContain("/unlock");

      const prisma = getTestPrisma();
      const stillNew = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(stillNew.verifier).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("confirming the save-passphrase modal completes first-time setup, saves preferences, and reaches /dashboard", async ({ page }) => {
    const user = await createTestUser({ verifier: null });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();
      await expect(page.getByRole("heading", { name: "Secure Your Passphrase to Continue" })).toBeVisible();

      await page.getByRole("button", { name: "I've saved it — Open Vault" }).click();
      await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      expect(page.url()).toContain("/dashboard");

      const prisma = getTestPrisma();
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.verifier).toBeTruthy();

      const prefs = await prisma.userPreference.findMany({ where: { userId: user.id } });
      expect(prefs.map((p) => p.key).sort()).toEqual(["country", "locale", "theme"]);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("the loading overlay stays up continuously until the dashboard replaces the page — the form never reappears", async ({ page }) => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      const submitButton = page.getByRole("button", { name: /Unlock Vault|Verifying|Loading your settings|Opening vault/ });
      await submitButton.click();

      // Regression guard for a bug where router.push() resolving before the
      // dashboard actually mounted let the idle "Unlock Vault" label (and the
      // passphrase form beneath the overlay) flash back for a moment.
      let sawIdleLabelAgain = false;
      const poll = setInterval(() => {
        submitButton
          .textContent()
          .then((text) => {
            if (text?.trim() === "Unlock Vault") sawIdleLabelAgain = true;
          })
          .catch(() => {});
      }, 100);

      try {
        await page.waitForURL(/\/dashboard/, { timeout: 15000 });
      } finally {
        clearInterval(poll);
      }
      expect(sawIdleLabelAgain).toBe(false);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a session whose user row is deleted after page load is signed out when the passphrase is submitted", async ({ page }) => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");
      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);

      // Simulate the row disappearing between page load and submit (e.g. a
      // concurrent database wipe or account deletion) — not caught by
      // unlock/page.tsx's own check, since that already ran before this point.
      await deleteTestUser(user.id);

      await page.getByRole("button", { name: "Unlock Vault" }).click();
      await page.waitForURL("http://localhost:3100/", { timeout: 10000 });
      expect(page.url()).toBe("http://localhost:3100/");

      const cookies = await page.context().cookies();
      const sessionCookie = cookies.find((c) => c.name === SESSION_COOKIE_NAME);
      expect(sessionCookie).toBeUndefined();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("resetting the vault after a failed unlock clears the verifier and returns to the first-time flow", async ({ page }) => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      await signInAs(page, user.id);
      await page.goto("/unlock");

      await page.getByPlaceholder("Enter your passphrase").fill(WRONG_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();
      await expect(page.getByText("Invalid passphrase")).toBeVisible({ timeout: 10000 });

      await page.getByRole("button", { name: "Forgot your passphrase? Reset vault →" }).click();
      await page.getByRole("button", { name: "Yes, delete everything" }).click();

      // The client clears passphrase/error/showReset regardless of the response —
      // assert the actual server-side effect instead of the optimistic UI reset.
      const prisma = getTestPrisma();
      await expect
        .poll(
          async () => (await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).verifier,
          { timeout: 10000 },
        )
        .toBeNull();

      // Submitting again now goes through the first-time flow, not a passphrase check.
      await page.getByPlaceholder("Enter your passphrase").fill(VALID_PASSPHRASE);
      await page.getByRole("button", { name: "Unlock Vault" }).click();
      await expect(page.getByRole("heading", { name: "Secure Your Passphrase to Continue" })).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("avatar spinner shows while the photo downloads, then the photo replaces it", async ({ page }) => {
    const user = await createTestUser();
    const prisma = getTestPrisma();
    await prisma.user.update({ where: { id: user.id }, data: { avatar: "https://example.com/avatar.png" } });
    try {
      // Delay the image response so the spinner has time to be observed —
      // a real network fetch, not a data: URL, so it goes through routing.
      await page.route("https://example.com/avatar.png", async (route) => {
        await new Promise((r) => setTimeout(r, 1000));
        await route.fulfill({
          status: 200,
          contentType: "image/png",
          body: fs.readFileSync(path.join(__dirname, "fixtures", "test-avatar.png")),
        });
      });

      await signInAs(page, user.id);
      // domcontentloaded, not the default "load" — "load" waits for every
      // resource (including the deliberately delayed avatar image below) to
      // finish, which would make the spinner already gone by the time goto()
      // returns.
      await page.goto("/unlock", { waitUntil: "domcontentloaded" });

      await expect(page.getByRole("status", { name: "Loading photo" })).toBeVisible();
      await expect(page.getByAltText(user.fullName)).toBeVisible({ timeout: 5000 });
      await expect(page.getByRole("status", { name: "Loading photo" })).not.toBeVisible();
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

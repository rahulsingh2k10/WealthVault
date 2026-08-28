import { test, expect } from "@playwright/test";

test.describe("Landing page auth", () => {
  test("shows a sign-in link for each supported OAuth provider", async ({ page }) => {
    await page.goto("/");

    await expect(page.locator('a[href="/api/auth/google"]')).toBeVisible();
    await expect(page.locator('a[href="/api/auth/apple"]')).toBeVisible();
    await expect(page.locator('a[href="/api/auth/x"]')).toBeVisible();
    await expect(page.locator('a[href="/api/auth/linkedin"]')).toBeVisible();
  });

  test("clicking the Google sign-in link navigates to Google's OAuth authorize endpoint", async ({ page }) => {
    await page.goto("/");
    // Google's real auth server immediately redirects further (o/oauth2/v2/auth
    // -> v3/signin/identifier), so this only waits for the initial cross-origin
    // hop, not any specific path on Google's side.
    await Promise.all([
      page.waitForURL((url) => url.hostname === "accounts.google.com"),
      page.click('a[href="/api/auth/google"]'),
    ]);
    expect(new URL(page.url()).hostname).toBe("accounts.google.com");
  });
});

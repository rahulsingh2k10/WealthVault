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

  // Apple sign-in isn't click-tested here: it requires a real APPLE_PRIVATE_KEY
  // (a .p8 file) to be configured, which isn't assumed to be present in every
  // dev/CI environment — the app returns a 500 "Apple OAuth not configured"
  // instead of redirecting when it's absent. Visibility of the link is still
  // covered above.

  test("clicking the X sign-in link navigates to X's OAuth authorize endpoint", async ({ page }) => {
    await page.goto("/");
    // The initiate route builds the URL against twitter.com, but X's server
    // redirects that to its x.com domain before rendering the authorize page.
    await Promise.all([
      page.waitForURL((url) => url.hostname === "x.com"),
      page.click('a[href="/api/auth/x"]'),
    ]);
    expect(new URL(page.url()).hostname).toBe("x.com");
  });

  test("clicking the LinkedIn sign-in link navigates to LinkedIn's OAuth authorize endpoint", async ({ page }) => {
    await page.goto("/");
    await Promise.all([
      page.waitForURL((url) => url.hostname === "www.linkedin.com"),
      page.click('a[href="/api/auth/linkedin"]'),
    ]);
    expect(new URL(page.url()).hostname).toBe("www.linkedin.com");
  });
});

test.describe("Landing page feature carousel (mobile)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("clicking a slide dot updates which card is active", async ({ page }) => {
    await page.goto("/");

    const dot1 = page.getByRole("button", { name: "Go to slide 1" });
    const dot3 = page.getByRole("button", { name: "Go to slide 3" });
    await expect(dot1).toHaveCSS("width", "18px"); // slide 1 is active on load

    await dot3.scrollIntoViewIfNeeded();
    await dot3.click();

    // The active dot is the only one this component widens (18px vs 6px) and
    // recolors — asserted via computed style since there's no aria-current.
    await expect(dot3).toHaveCSS("width", "18px");
    await expect(dot1).toHaveCSS("width", "6px");
  });
});

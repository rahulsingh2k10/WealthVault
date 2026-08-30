import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../helpers/testDb";
import { ensureReferenceData } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";
import { createSubscriptionRow } from "../helpers/subscriptionFactory";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../helpers/session";
import { signedWebhook } from "../helpers/fakeProvider";

test.skip(!hasTestDb(), "TEST_DATABASE_URL is not set in frontend/.env");

test.afterAll(async () => {
  await disconnectTestPrisma();
});

// The stubbed Razorpay checkout signs the payment with this secret in-page; it
// must match RAZORPAY_KEY_SECRET in playwright.config.ts so FakeProvider's
// verifyCheckoutSignature (same HMAC scheme) accepts it on /api/subscription/verify.
const KEY_SECRET = "test_key_secret_123";
// `signedWebhook` signs with RAZORPAY_WEBHOOK_SECRET. Both the dev server (Next
// .env loading) and this runner (loadFrontendEnv in playwright.config.ts) read
// the same value from frontend/.env, so the signatures match.

// Whether the dev server under test actually runs with PAYMENTS_PROVIDER=fake.
// playwright.config.ts sets it, but `reuseExistingServer: true` means a pre-existing
// `next dev` on :3100 started WITHOUT it would use the real Razorpay provider and
// these tests would try to hit the real API. Detected once in beforeAll.
let fakeProviderActive = false;

async function signIn(page: import("@playwright/test").Page, userId: string) {
  const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-for-ui-check" });
  await page.context().addCookies([
    { name: SESSION_COOKIE_NAME, value: sealed, url: "http://localhost:3100" },
  ]);
}

/**
 * Injects a fake `window.Razorpay` BEFORE any page script runs. The real popup
 * doesn't exist in e2e; the stub reads the subscription id from its constructor
 * options, computes the checkout HMAC in-page, and calls the handler. Because
 * `loadRazorpayCheckout()` early-returns when `window.Razorpay` is truthy, no
 * CDN script interception is needed.
 */
async function stubRazorpay(page: import("@playwright/test").Page) {
  await page.addInitScript((keySecret: string) => {
    async function hmacHex(secret: string, msg: string) {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
      return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    (window as unknown as { Razorpay: unknown }).Razorpay = class {
      opts: { subscription_id: string; handler: (r: unknown) => void };
      constructor(o: typeof this.opts) { this.opts = o; }
      async open() {
        const paymentId = "pay_e2e";
        const subscriptionId = this.opts.subscription_id;
        const signature = await hmacHex(keySecret, `${paymentId}|${subscriptionId}`);
        this.opts.handler({ razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature });
      }
    };
  }, KEY_SECRET);
}

test.describe("Razorpay subscription flow", () => {
  test.beforeAll(async ({ request }) => {
    await ensureReferenceData();

    // Detect the active payment provider: create a subscription as a throwaway
    // FREE user and check the id shape. FakeProvider → "sub_fake_…".
    const probe = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: probe.id, encryptionKey: "fake-key-for-ui-check" });
      const res = await request.post("/api/subscription/create", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}`, "content-type": "application/json" },
        data: { tier: "ANNUAL" },
      });
      if (!res.ok()) {
        // A failed probe is a real problem (misconfigured plan, seed failure, the
        // stale-Prisma baseline reaching these models) — surface it loudly rather
        // than silently downgrading to "fake provider not active" and skipping.
        throw new Error(`subscription probe failed: ${res.status()} ${await res.text()}`);
      }
      const body = (await res.json()) as { checkout?: { razorpay?: { subscriptionId?: string } } };
      fakeProviderActive = !!body.checkout?.razorpay?.subscriptionId?.startsWith("sub_fake_");
    } finally {
      await deleteTestUser(probe.id);
    }
  });

  const SKIP_MSG =
    "PAYMENTS_PROVIDER=fake is not active on the :3100 dev server — run with no pre-existing `next dev` on :3100 so playwright.config.ts's env takes effect";

  test("a FREE user subscribes end-to-end, then the webhook activates the subscription", async ({ page }) => {
    test.skip(!fakeProviderActive, SKIP_MSG);
    test.slow(); // multi-step: checkout -> verify -> webhook -> two reloads -> manage page
    const user = await createTestUser(); // FREE
    try {
      await signIn(page, user.id);
      await stubRazorpay(page);
      await page.goto("/dashboard?wvUpgradePromptDelayMs=150");

      const dialog = page.getByRole("dialog", { name: /your wealth, fully unlocked/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await page.getByRole("button", { name: /go sovereign/i }).click();

      // Stub fires -> POST /api/subscription/verify -> 200 -> modal closes. Generous
      // timeout: the first hit compiles the /verify route (lazy dev-server compile),
      // which can take several seconds when the whole suite runs.
      await expect(dialog).toBeHidden({ timeout: 20000 });

      // Simulate Razorpay's webhook against the real providerSubscriptionId that
      // /api/subscription/create generated (FakeProvider: "sub_fake_…").
      const sub = await getTestPrisma().subscription.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      expect(sub?.providerSubscriptionId).toMatch(/^sub_fake_/);

      const { body, signature, eventId } = signedWebhook("subscription.activated", {
        id: sub!.providerSubscriptionId,
        current_end: Math.floor(Date.now() / 1000) + 400 * 24 * 3600,
      });
      const res = await page.request.post("/api/subscription/webhook/razorpay", {
        data: body,
        headers: { "x-razorpay-signature": signature, "content-type": "application/json" },
      });
      expect(res.status()).toBe(200);
      await getTestPrisma().processedWebhookEvent.deleteMany({ where: { eventId } });

      // A paid user no longer sees the upgrade prompt.
      await page.goto("/dashboard?wvUpgradePromptDelayMs=150");
      await page.waitForTimeout(1000);
      await expect(page.getByRole("dialog", { name: /your wealth, fully unlocked/i })).toHaveCount(0);

      // The manage screen shows the Sovereign (ANNUAL) plan.
      await page.goto("/subscription");
      await expect(page.getByText(/sovereign/i).first()).toBeVisible();
      await expect(page.getByText(/your price is locked through/i)).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a subscribed user cancels and keeps access until the cycle end", async ({ page }) => {
    test.skip(!fakeProviderActive, SKIP_MSG);
    const user = await createTestUser({ tier: "ANNUAL" });
    try {
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "active",
        currentEnd: new Date(Date.now() + 300 * 24 * 3600 * 1000),
        providerSubscriptionId: "sub_fake_cancel1",
      });
      await signIn(page, user.id);
      await page.goto("/subscription");

      // handleCancel uses window.confirm — Playwright auto-dismisses dialogs by
      // default, so accept it explicitly before the click.
      page.on("dialog", (d) => d.accept());
      await page.getByRole("button", { name: /cancel subscription/i }).click();

      await expect(page.getByText(/access continues until/i)).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a webhook with a bad signature is rejected with 400", async ({ page }) => {
    const res = await page.request.post("/api/subscription/webhook/razorpay", {
      data: JSON.stringify({ id: "evt_x", event: "subscription.activated", payload: {} }),
      headers: { "x-razorpay-signature": "deadbeef", "content-type": "application/json" },
    });
    expect(res.status()).toBe(400);
  });
});

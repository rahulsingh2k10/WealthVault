import { createHmac } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "./webhookSecret";
import { normalizeRazorpayWebhookEvent } from "./razorpay";
import type {
  CreateSubscriptionInput,
  CreatedSubscription,
  EnsureCustomerUser,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
} from "./types";

/**
 * Deterministic provider for tests + e2e. Selected when PAYMENTS_PROVIDER === "fake".
 * verifyCheckoutSignature / verifyWebhookSignature use the SAME HMAC scheme as
 * RazorpayProvider so signed test fixtures work against either.
 */
export class FakeProvider implements PaymentProvider {
  readonly name: ProviderName = "razorpay";
  private keySecret = process.env.RAZORPAY_KEY_SECRET || "test_key_secret_123";

  async ensureCustomer(user: EnsureCustomerUser): Promise<string> {
    return user.razorpayCustomerId ?? `cust_fake_${user.id.slice(0, 8)}`;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const id = `sub_fake_${Math.random().toString(36).slice(2, 10)}`;
    return { providerSubscriptionId: id, status: "created", shortUrl: `https://fake.rzp/${id}`, raw: input };
  }

  verifyCheckoutSignature({ paymentId, subscriptionId, signature }: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    const good = createHmac("sha256", this.keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
    return good === signature;
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex") === signatureHeader;
  }

  normalizeWebhookEvent(rawBody: string, eventId: string | null): NormalizedWebhookEvent {
    // Reuse RazorpayProvider's (pure, standalone) parsing logic directly —
    // NOT `new RazorpayProvider()`, which now throws if real Razorpay keys
    // aren't set (see Task 3's fail-fast fix), which would defeat the point
    // of a fake provider in tests that don't set them.
    return normalizeRazorpayWebhookEvent(rawBody, eventId);
  }

  async cancelNow(): Promise<void> {
    /* no-op */
  }

  async fetchSubscription(id: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }> {
    return { status: "active", currentEnd: null, shortUrl: `https://fake.rzp/${id}` };
  }
}

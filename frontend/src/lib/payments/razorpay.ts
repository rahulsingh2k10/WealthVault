import Razorpay from "razorpay";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "./webhookSecret";
import type {
  CreateSubscriptionInput,
  CreatedSubscription,
  EnsureCustomerUser,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
  WebhookEventKind,
} from "./types";

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function unixToDate(v: unknown): Date | null {
  return typeof v === "number" && v > 0 ? new Date(v * 1000) : null;
}

const EVENT_KIND: Record<string, WebhookEventKind> = {
  "subscription.authenticated": "authenticated",
  "subscription.activated": "activated",
  "subscription.charged": "charged",
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "completed",
  "subscription.updated": "updated",
};

/**
 * Pure — does not touch `this`, so it's exported standalone rather than only
 * as a RazorpayProvider method. FakeProvider reuses this directly instead of
 * constructing a RazorpayProvider (which requires real RAZORPAY_KEY_ID/SECRET
 * at construction time).
 */
export function normalizeRazorpayWebhookEvent(rawBody: string, eventId: string | null): NormalizedWebhookEvent {
  const body = JSON.parse(rawBody) as {
    event: string;
    payload?: { subscription?: { entity?: Record<string, unknown> } };
  };
  const e = body.payload?.subscription?.entity ?? {};
  const kind = EVENT_KIND[body.event] ?? "ignored";
  return {
    kind,
    eventId: eventId || sha256Hex(rawBody),
    providerSubscriptionId: String(e.id ?? ""),
    status: String(e.status ?? ""),
    paidCount: typeof e.paid_count === "number" ? e.paid_count : undefined,
    currentStart: unixToDate(e.current_start),
    currentEnd: unixToDate(e.current_end),
    chargeAt: unixToDate(e.charge_at),
    cancelAtCycleEnd: kind === "cancelled" ? Boolean(e.current_end) : undefined,
    providerPlanId: e.plan_id ? String(e.plan_id) : undefined,
  };
}

export class RazorpayProvider implements PaymentProvider {
  readonly name: ProviderName = "razorpay";
  private client: Razorpay;
  private keySecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error(
        "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set — refusing to construct a RazorpayProvider with a missing/empty key (this would silently sign and verify with a guessable key).",
      );
    }
    this.keySecret = keySecret;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  verifyCheckoutSignature({ paymentId, subscriptionId, signature }: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    return safeEqualHex(hmacHex(this.keySecret, `${paymentId}|${subscriptionId}`), signature);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return safeEqualHex(hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody), signatureHeader);
  }

  normalizeWebhookEvent(rawBody: string, eventId: string | null): NormalizedWebhookEvent {
    return normalizeRazorpayWebhookEvent(rawBody, eventId);
  }

  async ensureCustomer(user: EnsureCustomerUser): Promise<string> {
    if (user.razorpayCustomerId) return user.razorpayCustomerId;
    // fail_existing must be the string "0" — Razorpay's API ignores a numeric 0
    // and falls back to its default (throw if a customer with this email already
    // exists); "0" makes it return the existing customer instead. The SDK's
    // types wrongly narrow this to `0 | 1 | boolean`, hence the cast.
    const created = await this.client.customers.create({
      name: user.fullName,
      ...(user.email ? { email: user.email } : {}),
      fail_existing: "0" as unknown as 0,
      notes: { userId: user.id },
    });
    return created.id;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const sub = await this.client.subscriptions.create({
      plan_id: input.plan.providerPlanId,
      total_count: input.plan.totalCount,
      quantity: 1,
      customer_notify: 1,
      customer_id: input.providerCustomerId,
      ...(input.startAt ? { start_at: input.startAt } : {}),
      ...(input.offerId ? { offer_id: input.offerId } : {}),
      notes: input.notes,
    } as Parameters<typeof this.client.subscriptions.create>[0]);
    return {
      providerSubscriptionId: sub.id,
      status: String(sub.status),
      shortUrl: (sub as { short_url?: string }).short_url,
      raw: sub,
    };
  }

  async cancelNow(providerSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(providerSubscriptionId, false);
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }> {
    const s = await this.client.subscriptions.fetch(providerSubscriptionId);
    return {
      status: String(s.status),
      currentEnd: unixToDate((s as { current_end?: number }).current_end),
      shortUrl: (s as { short_url?: string }).short_url,
    };
  }
}

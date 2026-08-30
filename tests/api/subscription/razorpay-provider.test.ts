import { createHmac } from "node:crypto";
import { RazorpayProvider } from "@/lib/payments/razorpay";
import { RAZORPAY_WEBHOOK_SECRET } from "@/lib/payments/webhookSecret";

// The provider reads RAZORPAY_KEY_SECRET at construction; set a known one.
const KEY_SECRET = "test_key_secret_123";
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_KEY_ID = "rzp_test_x";

const provider = new RazorpayProvider();

describe("verifyCheckoutSignature", () => {
  const paymentId = "pay_ABC";
  const subscriptionId = "sub_XYZ";
  const good = createHmac("sha256", KEY_SECRET).update(`${paymentId}|${subscriptionId}`).digest("hex");

  test("accepts a correct signature", () => {
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: good })).toBe(true);
  });
  test("rejects a wrong signature", () => {
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: "deadbeef" })).toBe(false);
  });
  test("rejects when the payload differs", () => {
    const other = createHmac("sha256", KEY_SECRET).update(`pay_OTHER|${subscriptionId}`).digest("hex");
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: other })).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "subscription.charged", payload: {} });
  const good = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

  test("accepts a correct signature over the raw body", () => {
    expect(provider.verifyWebhookSignature(body, good)).toBe(true);
  });
  test("rejects a tampered body", () => {
    expect(provider.verifyWebhookSignature(body + " ", good)).toBe(false);
  });
  test("rejects a null header", () => {
    expect(provider.verifyWebhookSignature(body, null)).toBe(false);
  });
});

describe("normalizeWebhookEvent", () => {
  function evt(event: string, sub: Record<string, unknown>) {
    return JSON.stringify({
      entity: "event",
      account_id: "acc_test",
      event,
      contains: ["subscription"],
      payload: { subscription: { entity: { id: "sub_1", status: "active", plan_id: "plan_1", ...sub } } },
      created_at: 1735689600,
    });
  }

  test("subscription.activated → kind 'activated', dates parsed from unix seconds", () => {
    const n = provider.normalizeWebhookEvent(
      evt("subscription.activated", { status: "active", current_start: 1735689600, current_end: 1738368000, charge_at: 1738368000, paid_count: 1 }),
      "evt_1",
    );
    expect(n.kind).toBe("activated");
    expect(n.status).toBe("active");
    expect(n.providerSubscriptionId).toBe("sub_1");
    expect(n.eventId).toBe("evt_1");
    expect(n.paidCount).toBe(1);
    expect(n.currentEnd?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  test("eventId comes from the header arg, not the body", () => {
    const n = provider.normalizeWebhookEvent(evt("subscription.charged", { paid_count: 2 }), "evt_from_header");
    expect(n.eventId).toBe("evt_from_header");
  });

  test("subscription.charged → kind 'charged'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.charged", { paid_count: 2 }), "evt_1").kind).toBe("charged");
  });
  test("subscription.pending → kind 'pending'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.pending", { status: "pending" }), "evt_1").kind).toBe("pending");
  });
  test("subscription.halted → kind 'halted'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.halted", { status: "halted" }), "evt_1").kind).toBe("halted");
  });
  test("subscription.cancelled → kind 'cancelled'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.cancelled", { status: "cancelled" }), "evt_1").kind).toBe("cancelled");
  });
  test("subscription.completed → kind 'completed'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.completed", { status: "completed" }), "evt_1").kind).toBe("completed");
  });
  test("subscription.authenticated → kind 'authenticated'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.authenticated", { status: "authenticated" }), "evt_1").kind).toBe("authenticated");
  });
  test("unknown event → kind 'ignored'", () => {
    expect(provider.normalizeWebhookEvent(evt("payment.captured", {}), "evt_1").kind).toBe("ignored");
  });
});

describe("RazorpayProvider construction", () => {
  test("throws if RAZORPAY_KEY_SECRET is missing", () => {
    const prevId = process.env.RAZORPAY_KEY_ID;
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_ID = "rzp_test_x";
    delete process.env.RAZORPAY_KEY_SECRET;
    try {
      expect(() => new RazorpayProvider()).toThrow();
    } finally {
      process.env.RAZORPAY_KEY_ID = prevId;
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
    }
  });

  test("throws if RAZORPAY_KEY_ID is missing", () => {
    const prevId = process.env.RAZORPAY_KEY_ID;
    const prevSecret = process.env.RAZORPAY_KEY_SECRET;
    delete process.env.RAZORPAY_KEY_ID;
    process.env.RAZORPAY_KEY_SECRET = "test_key_secret_123";
    try {
      expect(() => new RazorpayProvider()).toThrow();
    } finally {
      process.env.RAZORPAY_KEY_ID = prevId;
      process.env.RAZORPAY_KEY_SECRET = prevSecret;
    }
  });
});

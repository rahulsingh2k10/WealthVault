import { createHmac } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "../../frontend/src/lib/payments/webhookSecret";

/** Build a Razorpay-shaped webhook body + its signature for the webhook route tests. */
export function signedWebhook(event: string, subscriptionEntity: Record<string, unknown>, eventId = `evt_${Math.random().toString(36).slice(2)}`) {
  const body = JSON.stringify({
    entity: "event",
    account_id: "acc_test",
    event,
    contains: ["subscription"],
    payload: { subscription: { entity: { id: "sub_1", status: "active", plan_id: "plan_test_annual", ...subscriptionEntity } } },
    created_at: Math.floor(Date.now() / 1000),
  });
  const signature = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  return { body, signature, eventId };
}

/** Build a checkout signature the verify route will accept (matches RazorpayProvider). */
export function checkoutSignature(paymentId: string, subscriptionId: string, keySecret = process.env.RAZORPAY_KEY_SECRET || "test_key_secret_123") {
  return createHmac("sha256", keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
}

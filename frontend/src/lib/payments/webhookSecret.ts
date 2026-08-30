/**
 * The Razorpay webhook secret. In production this MUST come from the env
 * (set when the webhook is created in the Razorpay dashboard). Tests and the
 * e2e run use the fixed fallback so signed fixtures are reproducible.
 */
export const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_test_wealthvault_fixed";

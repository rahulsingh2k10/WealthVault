import type { PaymentProvider, ProviderName } from "./types";
import { RazorpayProvider } from "./razorpay";
import { FakeProvider } from "./fake";

let cached: PaymentProvider | null = null;

export function getProvider(_name: ProviderName = "razorpay"): PaymentProvider {
  if (cached) return cached;
  cached = process.env.PAYMENTS_PROVIDER === "fake" ? new FakeProvider() : new RazorpayProvider();
  return cached;
}

/** test-only: reset the cached instance between tests */
export function __resetProviderCache(): void {
  cached = null;
}

export type { PaymentProvider } from "./types";

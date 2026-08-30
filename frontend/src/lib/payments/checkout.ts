import type { CheckoutParams } from "./types";

let scriptPromise: Promise<void> | null = null;

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== "undefined" && (window as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open(): void };
}

/**
 * Opens the provider's checkout, resolves true once the payment is verified
 * server-side, false if the user dismisses it.
 */
export async function startCheckout(
  params: CheckoutParams,
  onVerified: (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => Promise<void>,
): Promise<boolean> {
  if (params.provider !== "razorpay" || !params.razorpay) throw new Error("unsupported checkout provider");
  await loadRazorpayCheckout();
  const RP = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  const { keyId, subscriptionId, name } = params.razorpay;

  return new Promise<boolean>((resolve, reject) => {
    const rzp = new RP({
      key: keyId,
      subscription_id: subscriptionId,
      name,
      handler: async (resp: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
        try {
          await onVerified(resp);
          resolve(true);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => resolve(false) },
    });
    rzp.open();
  });
}

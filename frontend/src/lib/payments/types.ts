export type ProviderName = "razorpay";

export interface PlanForCheckout {
  tier: string;
  providerPlanId: string;
  totalCount: number;
  amountPaise: number;
  currency: string;
}

export interface CreateSubscriptionInput {
  userId: string;
  plan: PlanForCheckout;
  providerCustomerId: string;
  startAt?: number; // unix seconds
  offerId?: string;
  notes: Record<string, string>;
}

export interface CreatedSubscription {
  providerSubscriptionId: string;
  status: string; // normalised
  shortUrl?: string;
  raw: unknown;
}

export interface CheckoutParams {
  provider: ProviderName;
  razorpay?: { keyId: string; subscriptionId: string; name: string };
}

export type WebhookEventKind =
  | "authenticated"
  | "activated"
  | "charged"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "updated"
  | "ignored";

export interface NormalizedWebhookEvent {
  kind: WebhookEventKind;
  eventId: string;
  providerSubscriptionId: string;
  status: string; // normalised subscription status
  paidCount?: number;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  cancelAtCycleEnd?: boolean;
  providerPlanId?: string;
}

export interface EnsureCustomerUser {
  id: string;
  fullName: string;
  email: string | null;
  razorpayCustomerId: string | null;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  ensureCustomer(user: EnsureCustomerUser): Promise<string>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription>;
  verifyCheckoutSignature(p: { paymentId: string; subscriptionId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  normalizeWebhookEvent(rawBody: string): NormalizedWebhookEvent;
  cancelAtCycleEnd(providerSubscriptionId: string): Promise<void>;
  fetchSubscription(providerSubscriptionId: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }>;
}

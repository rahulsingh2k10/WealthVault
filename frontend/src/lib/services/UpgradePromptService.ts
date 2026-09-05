import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";
import { getEffectivePlan } from "./SubscriptionService";

export type PaidTier = "MONTHLY" | "QUARTERLY" | "ANNUAL";

export interface PlanCardView {
  tier: PaidTier;
  billingMonths: 1 | 3 | 12;
  currency: string;
  /** Amount per billing period, whole units (e.g. 6000 for a ₹6,000/quarter plan). */
  basePerPeriod: number;
  /** offerPrice when the offer is live, otherwise basePerPeriod. */
  effectivePerPeriod: number;
  offerActive: boolean;
  /** round((1 - effective/base) * 100); 0 when no offer is active. */
  discountPercent: number;
  /** ISO string of offerEndDate when the offer is live, else null. */
  offerEndsAt: string | null;
}

export interface UpgradePromptData {
  plans: PlanCardView[];
  /** Paid-member count floored to a round hundred, or null when <= 100. */
  memberCount: number | null;
}

/**
 * Turn a SubscriptionPlan row into the view model the modal renders.
 * `plan.tier` must be a paid tier (MONTHLY / QUARTERLY / ANNUAL) — callers filter out FREE.
 * Pure: `now` is injected so the offer window is testable without a clock.
 */
export function buildPlanCardView(plan: SubscriptionPlan, now: Date): PlanCardView {
  const tier = plan.tier as PaidTier;
  if (plan.intervalMonths == null) {
    throw new Error(`SubscriptionPlan ${plan.id} (${tier}) has no intervalMonths`);
  }
  const billingMonths = plan.intervalMonths as 1 | 3 | 12;
  const base = Number(plan.price);
  const offerPrice = plan.offerPrice == null ? null : Number(plan.offerPrice);

  const withinWindow =
    (plan.offerStartDate == null || now >= plan.offerStartDate) &&
    (plan.offerEndDate == null || now <= plan.offerEndDate);
  const offerActive = offerPrice !== null && withinWindow;

  const effective = offerActive ? (offerPrice as number) : base;
  const discountPercent =
    offerActive && base > 0 ? Math.round((1 - effective / base) * 100) : 0;

  return {
    tier,
    billingMonths,
    currency: plan.currency,
    basePerPeriod: base,
    effectivePerPeriod: effective,
    offerActive,
    discountPercent,
    offerEndsAt: offerActive && plan.offerEndDate ? plan.offerEndDate.toISOString() : null,
  };
}

/**
 * Data for the dashboard upgrade prompt, or null when it must not show:
 * missing user id, user not found, or the user is not on the FREE tier.
 */
export async function getUpgradePromptData(
  userId: string | undefined,
): Promise<UpgradePromptData | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const eff = await getEffectivePlan(userId);
  if (eff.tier !== "FREE") return null;

  const now = new Date();
  const [rows, paidCount] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true, tier: { not: "FREE" } },
      orderBy: { tier: "asc" }, // enum order: MONTHLY, QUARTERLY, ANNUAL
    }),
    prisma.user.count({ where: { subscriptionPlan: { tier: { not: "FREE" } } } }),
  ]);

  const plans = rows.map((row) => buildPlanCardView(row, now));
  const memberCount = paidCount > 100 ? Math.floor(paidCount / 100) * 100 : null;

  return { plans, memberCount };
}

/**
 * The active paid-plan catalog as card view models, with no gating on the
 * caller's own tier. Used by the Manage Subscription screen so a PAID user
 * can see the same plan-comparison cards a FREE user sees (unlike
 * getUpgradePromptData, which is FREE-only by design).
 */
export async function listAllPlanCards(): Promise<PlanCardView[]> {
  const now = new Date();
  const rows = await prisma.subscriptionPlan.findMany({
    where: { isActive: true, tier: { not: "FREE" } },
    orderBy: { tier: "asc" },
  });
  return rows.map((row) => buildPlanCardView(row, now));
}

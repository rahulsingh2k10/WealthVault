import { getTestPrisma } from "./testDb";
import { getPlanId, type Tier } from "./seedReferenceData";

type Overrides = Partial<{
  tier: Tier;
  status: string;
  currentEnd: Date | null;
  currentStart: Date | null;
  cancelAtCycleEnd: boolean;
  totalCount: number;
  paidCount: number;
  supersedesId: string | null;
  startAt: Date | null;
  providerSubscriptionId: string;
  createdAt: Date;
}>;

export async function createSubscriptionRow(userId: string, o: Overrides = {}) {
  const prisma = getTestPrisma();
  const tier = o.tier ?? "ANNUAL";
  const subscriptionPlanId = await getPlanId(tier);
  return prisma.subscription.create({
    data: {
      userId,
      subscriptionPlanId,
      provider: "razorpay",
      providerSubscriptionId: o.providerSubscriptionId ?? `sub_${Math.random().toString(36).slice(2, 12)}`,
      providerPlanId: `plan_test_${tier.toLowerCase()}`,
      status: o.status ?? "active",
      totalCount: o.totalCount ?? 3,
      paidCount: o.paidCount ?? 1,
      currentStart: o.currentStart ?? new Date(Date.now() - 86400_000),
      currentEnd: o.currentEnd === undefined ? new Date(Date.now() + 30 * 86400_000) : o.currentEnd,
      cancelAtCycleEnd: o.cancelAtCycleEnd ?? false,
      supersedesId: o.supersedesId ?? null,
      startAt: o.startAt ?? null,
      amount: 1440000,
      currency: "INR",
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
}

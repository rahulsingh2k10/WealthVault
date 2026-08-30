import { getTestPrisma } from "./testDb";

export const TIERS = ["FREE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export const PLATFORMS = ["GOOGLE", "APPLE", "X", "LINKEDIN"] as const;

export type Tier = (typeof TIERS)[number];

// Keep in lockstep with frontend/prisma/seed.ts — placeholder pricing + launch offer.
const OFFER_START = new Date("2026-08-01T00:00:00Z");
const OFFER_END = new Date("2026-09-30T23:59:59Z");

const PLAN_PRICING: Record<
  Tier,
  { price: number; offerPrice: number | null; offerStartDate: Date | null; offerEndDate: Date | null; intervalMonths: number | null; termMonths: number | null; razorpayPlanId: string | null }
> = {
  FREE:      { price: 0,     offerPrice: null,  offerStartDate: null,        offerEndDate: null,        intervalMonths: null, termMonths: null, razorpayPlanId: null },
  MONTHLY:   { price: 9000,  offerPrice: 3600,  offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 1,   termMonths: 36,   razorpayPlanId: 'plan_test_monthly' },
  QUARTERLY: { price: 18000, offerPrice: 7200,  offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 3,   termMonths: 36,   razorpayPlanId: 'plan_test_quarterly' },
  ANNUAL:    { price: 36000, offerPrice: 14400, offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 12,  termMonths: 36,   razorpayPlanId: 'plan_test_annual' },
};

export async function ensureReferenceData(): Promise<void> {
  const prisma = getTestPrisma();

  for (const tier of TIERS) {
    const pricing = PLAN_PRICING[tier];
    await prisma.subscriptionPlan.upsert({
      where: { tier },
      update: { ...pricing, currency: "INR", isActive: true },
      create: { tier, ...pricing, currency: "INR", isActive: true },
    });
  }

  for (const platform of PLATFORMS) {
    await prisma.authPlatform.upsert({
      where: { platform },
      update: {},
      create: { platform },
    });
  }
}

export async function getPlanId(tier: Tier): Promise<string> {
  const prisma = getTestPrisma();
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier } });
  return plan.id;
}

export async function getFreePlanId(): Promise<string> {
  return getPlanId("FREE");
}

export async function getPlatformId(platform: (typeof PLATFORMS)[number]): Promise<string> {
  const prisma = getTestPrisma();
  const row = await prisma.authPlatform.findUniqueOrThrow({ where: { platform } });
  return row.id;
}

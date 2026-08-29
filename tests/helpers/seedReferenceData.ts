import { getTestPrisma } from "./testDb";

export const TIERS = ["FREE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export const PLATFORMS = ["GOOGLE", "APPLE", "X", "LINKEDIN"] as const;

export type Tier = (typeof TIERS)[number];

// Keep in lockstep with frontend/prisma/seed.ts — placeholder pricing + launch offer.
const OFFER_START = new Date("2026-08-01T00:00:00Z");
const OFFER_END = new Date("2026-09-30T23:59:59Z");

const PLAN_PRICING: Record<
  Tier,
  { price: number; offerPrice: number | null; offerStartDate: Date | null; offerEndDate: Date | null }
> = {
  FREE:      { price: 0,     offerPrice: null,  offerStartDate: null,        offerEndDate: null },
  MONTHLY:   { price: 3000,  offerPrice: null,  offerStartDate: null,        offerEndDate: null },
  QUARTERLY: { price: 6000,  offerPrice: 4800,  offerStartDate: OFFER_START, offerEndDate: OFFER_END },
  ANNUAL:    { price: 18000, offerPrice: 14400, offerStartDate: OFFER_START, offerEndDate: OFFER_END },
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

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Required by the OAuth callbacks (findUniqueOrThrow on FREE plan + platform
// row) and by checkout. Safe to re-run: upserts, never deletes.
const TIERS = ["FREE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
const PLATFORMS = ["GOOGLE", "APPLE", "X", "LINKEDIN"] as const;

// Keep in lockstep with tests/helpers/seedReferenceData.ts — pricing + launch offer.
const OFFER_START = new Date("2026-08-01T00:00:00Z");
const OFFER_END = new Date("2026-09-30T23:59:59Z");

type Tier = (typeof TIERS)[number];

const PLAN_PRICING: Record<
  Tier,
  { price: number; offerPrice: number | null; offerStartDate: Date | null; offerEndDate: Date | null; intervalMonths: number | null; termMonths: number | null; razorpayPlanId: string | null }
> = {
  FREE:      { price: 0,     offerPrice: null,  offerStartDate: null,        offerEndDate: null,      intervalMonths: null, termMonths: null, razorpayPlanId: null },
  MONTHLY:   { price: 9000,  offerPrice: 3600,  offerStartDate: OFFER_START, offerEndDate: OFFER_END, intervalMonths: 7,   termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_MONTHLY   ?? null },
  QUARTERLY: { price: 18000, offerPrice: 7200,  offerStartDate: OFFER_START, offerEndDate: OFFER_END, intervalMonths: 9,   termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_QUARTERLY ?? null },
  ANNUAL:    { price: 36000, offerPrice: 14400, offerStartDate: OFFER_START, offerEndDate: OFFER_END, intervalMonths: 12,  termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_ANNUAL    ?? null },
};

async function main() {
  for (const tier of TIERS) {
    const pricing = PLAN_PRICING[tier];
    await prisma.subscriptionPlan.upsert({
      where: { tier },
      update: { ...pricing, currency: "INR", isActive: true },
      create: { tier, ...pricing, currency: "INR", isActive: true },
    });
    console.log(`  subscription_plans: ${tier} ok`);
  }

  for (const platform of PLATFORMS) {
    await prisma.authPlatform.upsert({
      where: { platform },
      update: {},
      create: { platform },
    });
    console.log(`  auth_platforms: ${platform} ok`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

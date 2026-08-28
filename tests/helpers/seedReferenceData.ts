import { getTestPrisma } from "./testDb";

export const TIERS = ["FREE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export const PLATFORMS = ["GOOGLE", "APPLE", "X", "LINKEDIN"] as const;

export async function ensureReferenceData(): Promise<void> {
  const prisma = getTestPrisma();

  for (const tier of TIERS) {
    await prisma.subscriptionPlan.upsert({
      where: { tier },
      update: {},
      create: {
        tier,
        price: tier === "FREE" ? 0 : tier === "MONTHLY" ? 199 : tier === "QUARTERLY" ? 499 : 1999,
        currency: "INR",
      },
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

export async function getFreePlanId(): Promise<string> {
  const prisma = getTestPrisma();
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });
  return plan.id;
}

export async function getPlatformId(platform: (typeof PLATFORMS)[number]): Promise<string> {
  const prisma = getTestPrisma();
  const row = await prisma.authPlatform.findUniqueOrThrow({ where: { platform } });
  return row.id;
}

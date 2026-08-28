import { randomUUID } from "crypto";
import { getTestPrisma } from "./testDb";
import { getFreePlanId, getPlatformId, PLATFORMS } from "./seedReferenceData";

export interface CreateTestUserOptions {
  platform?: (typeof PLATFORMS)[number];
  verifier?: string | null;
}

export async function createTestUser(options: CreateTestUserOptions = {}) {
  const prisma = getTestPrisma();
  const platform = options.platform ?? "GOOGLE";
  const [freePlanId, platformId] = await Promise.all([
    getFreePlanId(),
    getPlatformId(platform),
  ]);

  return prisma.user.create({
    data: {
      fullName: "Test User",
      username: `test-user-${randomUUID()}@example.com`,
      auth_platformId: platformId,
      subscriptionPlanId: freePlanId,
      verifier: options.verifier ?? null,
    },
  });
}

export async function deleteTestUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.subscriptionPeriod.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}

import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

// Subscription.userId has no ON DELETE CASCADE (confirmed by trying deleteTestUser
// alone: it left orphaned users + subscription rows behind, silently, because
// deleteTestUser swallows delete errors). Delete Subscription rows for the user
// before deleteTestUser in every test's cleanup.
async function cleanupUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.subscription.deleteMany({ where: { userId } });
  await deleteTestUser(userId);
}

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("getEffectivePlan", () => {
  const { getEffectivePlan, totalCountFor } = require("@/lib/services/SubscriptionService");

  test("totalCountFor computes term/interval", () => {
    expect(totalCountFor({ termMonths: 36, intervalMonths: 1 })).toBe(36);
    expect(totalCountFor({ termMonths: 36, intervalMonths: 3 })).toBe(12);
    expect(totalCountFor({ termMonths: 36, intervalMonths: 12 })).toBe(3);
  });

  test("no subscription rows → FREE", async () => {
    const user = await createTestUser();
    try {
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("FREE");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("active subscription → its paid tier", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("ANNUAL");
      expect(eff.paymentRetrying).toBe(false);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("pending subscription → tier kept, paymentRetrying true", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "pending" });
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("MONTHLY");
      expect(eff.paymentRetrying).toBe(true);
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("halted → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "halted", currentEnd: null });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("cancelled with currentEnd in the future → tier kept", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "cancelled", currentEnd: new Date(Date.now() + 5 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("completed with currentEnd in the past → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "completed", currentEnd: new Date(Date.now() - 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("plan change: old completed (past) + new active → new tier", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "completed", currentEnd: new Date(Date.now() - 86400_000), createdAt: new Date(Date.now() - 10 * 86400_000) });
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", currentEnd: new Date(Date.now() + 300 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await cleanupUser(user.id);
    }
  });

  test("lazy reconciliation: stale User.subscriptionPlanId gets corrected to FREE", async () => {
    const { getTestPrisma } = require("../../helpers/testDb");
    const { getPlanId } = require("../../helpers/seedReferenceData");
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      // user points at ANNUAL but their only sub is completed & lapsed
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionPlanId: await getPlanId("ANNUAL") } });
      await createSubscriptionRow(user.id, { status: "completed", currentEnd: new Date(Date.now() - 86400_000) });
      await getEffectivePlan(user.id);
      const after = await prisma.user.findUnique({ where: { id: user.id }, include: { subscriptionPlan: true } });
      expect(after.subscriptionPlan.tier).toBe("FREE");
    } finally {
      await cleanupUser(user.id);
    }
  });
});

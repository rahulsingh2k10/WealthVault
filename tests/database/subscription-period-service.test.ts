import { hasTestDb, getTestPrisma, disconnectTestPrisma } from "../helpers/testDb";
import { ensureReferenceData, getFreePlanId, getPlatformId } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    // This suite imports the real service module below, which reads the app's
    // own DATABASE_URL (via @/lib/prisma) rather than TEST_DATABASE_URL — the
    // two happen to be equal in this environment, but that's an environment
    // fact, not something this test should assume. Refuse to run at all if
    // they ever diverge, rather than silently risking a write against whatever
    // DATABASE_URL points at.
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL differ — refusing to run " +
          "logSubscriptionPeriodIfChanged against the real @/lib/prisma singleton, " +
          "since it would not necessarily hit the test database."
      );
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("logSubscriptionPeriodIfChanged (real service, not reimplemented)", () => {
  // Imported lazily inside the describe block so the DATABASE_URL/TEST_DATABASE_URL
  // safety check above has already run before this module (and its own
  // `@/lib/prisma` singleton) is ever loaded.
  const { logSubscriptionPeriodIfChanged } = require("@/lib/services/SubscriptionPeriodService");

  test("first call for a user with no prior rows inserts exactly one row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const freePlanId = await getFreePlanId();

      await logSubscriptionPeriodIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPeriod.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].subscriptionPlanId).toBe(freePlanId);
    } finally {
      await prisma.subscriptionPeriod.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });

  test("calling again with the same plan does not insert a second row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const freePlanId = await getFreePlanId();

      await logSubscriptionPeriodIfChanged(user.id, freePlanId);
      await logSubscriptionPeriodIfChanged(user.id, freePlanId);
      await logSubscriptionPeriodIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPeriod.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
    } finally {
      await prisma.subscriptionPeriod.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });

  test("calling with a different plan inserts a new row without touching the previous one", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const [freePlanId, monthlyPlanId] = await Promise.all([
        getFreePlanId(),
        prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "MONTHLY" } }).then((p) => p.id),
      ]);

      await logSubscriptionPeriodIfChanged(user.id, freePlanId);
      const firstRow = await prisma.subscriptionPeriod.findFirstOrThrow({ where: { userId: user.id } });

      await logSubscriptionPeriodIfChanged(user.id, monthlyPlanId);

      const rows = await prisma.subscriptionPeriod.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      expect(rows).toHaveLength(2);

      // The original row is untouched — inserted, never updated.
      expect(rows[0].id).toBe(firstRow.id);
      expect(rows[0].subscriptionPlanId).toBe(freePlanId);
      expect(rows[0].createdAt).toEqual(firstRow.createdAt);

      // The most recent row reflects the new plan.
      expect(rows[1].subscriptionPlanId).toBe(monthlyPlanId);
    } finally {
      await prisma.subscriptionPeriod.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });

  test("switching back to an earlier plan still inserts a new row (compares only against the most recent)", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const [freePlanId, monthlyPlanId] = await Promise.all([
        getFreePlanId(),
        prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "MONTHLY" } }).then((p) => p.id),
      ]);

      await logSubscriptionPeriodIfChanged(user.id, freePlanId);
      await logSubscriptionPeriodIfChanged(user.id, monthlyPlanId);
      await logSubscriptionPeriodIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPeriod.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(3);
    } finally {
      await prisma.subscriptionPeriod.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });
});

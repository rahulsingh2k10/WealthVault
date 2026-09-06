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
          "logSubscriptionPlanHistoryIfChanged against the real @/lib/prisma singleton, " +
          "since it would not necessarily hit the test database."
      );
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("logSubscriptionPlanHistoryIfChanged (real service, not reimplemented)", () => {
  // Imported lazily inside the describe block so the DATABASE_URL/TEST_DATABASE_URL
  // safety check above has already run before this module (and its own
  // `@/lib/prisma` singleton) is ever loaded.
  const { logSubscriptionPlanHistoryIfChanged } = require("@/lib/services/SubscriptionPlanHistoryService");

  test("first call for a user with no prior rows inserts exactly one row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const freePlanId = await getFreePlanId();

      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPlanHistory.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].subscriptionPlanId).toBe(freePlanId);
    } finally {
      await prisma.subscriptionPlanHistory.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });

  test("calling again with the same plan does not insert a second row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const freePlanId = await getFreePlanId();

      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);
      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);
      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPlanHistory.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
    } finally {
      await prisma.subscriptionPlanHistory.deleteMany({ where: { userId: user.id } });
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

      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);
      const firstRow = await prisma.subscriptionPlanHistory.findFirstOrThrow({ where: { userId: user.id } });

      await logSubscriptionPlanHistoryIfChanged(user.id, monthlyPlanId);

      const rows = await prisma.subscriptionPlanHistory.findMany({
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
      await prisma.subscriptionPlanHistory.deleteMany({ where: { userId: user.id } });
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

      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);
      await logSubscriptionPlanHistoryIfChanged(user.id, monthlyPlanId);
      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);

      const rows = await prisma.subscriptionPlanHistory.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(3);
    } finally {
      await prisma.subscriptionPlanHistory.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });

  test("two concurrent calls for the same new plan insert exactly one row, not two (race safety)", async () => {
    // Production hit this as two real, separate webhook deliveries landing
    // close together (confirmed from live data: two rows inserted 2ms
    // apart). A same-process Promise.all here isn't a proven reproduction of
    // that specific race — earlier attempts to force it (including gating
    // the outer client's findFirst) didn't trigger, since the fix runs the
    // read-then-insert inside prisma.$transaction, and Prisma hands the
    // callback its own `tx` client distinct from the outer one, so spying on
    // the outer client's methods never sees the transaction's queries. What
    // this test does verify: the advisory lock (pg_advisory_xact_lock, keyed
    // on userId) correctly serializes genuinely concurrent calls end to end,
    // so real concurrent access can't produce a duplicate row.
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const [freePlanId, monthlyPlanId] = await Promise.all([
        getFreePlanId(),
        prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "MONTHLY" } }).then((p) => p.id),
      ]);

      await logSubscriptionPlanHistoryIfChanged(user.id, freePlanId);

      await Promise.all([
        logSubscriptionPlanHistoryIfChanged(user.id, monthlyPlanId),
        logSubscriptionPlanHistoryIfChanged(user.id, monthlyPlanId),
      ]);

      const rows = await prisma.subscriptionPlanHistory.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
      });
      expect(rows).toHaveLength(2);
      expect(rows[0].subscriptionPlanId).toBe(freePlanId);
      expect(rows[1].subscriptionPlanId).toBe(monthlyPlanId);
    } finally {
      await prisma.subscriptionPlanHistory.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });
});

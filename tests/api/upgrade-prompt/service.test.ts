import { hasTestDb, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL differ — refusing to run getUpgradePromptData " +
          "against the real @/lib/prisma singleton, since it would not necessarily hit the test database.",
      );
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("getUpgradePromptData", () => {
  // Lazy require: the DATABASE_URL/TEST_DATABASE_URL check above must run before
  // the service module (and its own @/lib/prisma singleton) is loaded.
  const { getUpgradePromptData } = require("@/lib/services/UpgradePromptService");

  test("returns null when userId is undefined", async () => {
    expect(await getUpgradePromptData(undefined)).toBeNull();
  });

  test("returns null when the user does not exist", async () => {
    expect(await getUpgradePromptData("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("returns null for a paid user", async () => {
    const user = await createTestUser({ tier: "ANNUAL" });
    try {
      // getUpgradePromptData now gates on getEffectivePlan, which derives tier from an
      // actual granting Subscription row, not the (possibly stale) User.subscriptionPlanId.
      await createSubscriptionRow(user.id, { tier: "ANNUAL" });
      expect(await getUpgradePromptData(user.id)).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns the three paid plans in MONTHLY, QUARTERLY, ANNUAL order for a FREE user", async () => {
    const user = await createTestUser(); // FREE by default
    try {
      const data = await getUpgradePromptData(user.id);
      expect(data).not.toBeNull();
      expect(data.plans.map((p: { tier: string }) => p.tier)).toEqual([
        "MONTHLY",
        "QUARTERLY",
        "ANNUAL",
      ]);
      const byTier = Object.fromEntries(data.plans.map((p: { tier: string }) => [p.tier, p]));
      expect(byTier.MONTHLY.basePerPeriod).toBe(9000);
      expect(byTier.QUARTERLY.basePerPeriod).toBe(18000);
      expect(byTier.ANNUAL.basePerPeriod).toBe(36000);
      expect(byTier.MONTHLY.currency).toBe("INR");
      // effectivePerPeriod / offerActive / discountPercent are exercised by
      // plan-card-view.test.ts with a fixed clock — not asserted here (they depend
      // on whether the seeded launch-offer window is still open).
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("memberCount is null when there are 100 or fewer paid users", async () => {
    const user = await createTestUser();
    try {
      const data = await getUpgradePromptData(user.id);
      expect(data.memberCount).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

import { hasTestDb, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";

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
      const annual = data.plans.find((p: { tier: string }) => p.tier === "ANNUAL");
      expect(annual.offerActive).toBe(true);
      expect(annual.effectivePerPeriod).toBe(14400);
      expect(annual.discountPercent).toBe(20);
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

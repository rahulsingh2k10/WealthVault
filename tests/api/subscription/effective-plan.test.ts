import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

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
      await deleteTestUser(user.id);
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
      await deleteTestUser(user.id);
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
      await deleteTestUser(user.id);
    }
  });

  test("halted → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "halted", currentEnd: null });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelled with currentEnd in the future → tier kept", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "cancelled", currentEnd: new Date(Date.now() + 5 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("completed with currentEnd in the past → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "completed", currentEnd: new Date(Date.now() - 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelAtCycleEnd + currentEnd in the future → tier kept", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() + 5 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelAtCycleEnd + currentEnd in the past → FREE (even though status is still 'active')", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() - 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("plan change: old completed (past) + new active → new tier", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "completed", currentEnd: new Date(Date.now() - 86400_000), createdAt: new Date(Date.now() - 10 * 86400_000) });
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", currentEnd: new Date(Date.now() + 300 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("tie-break: infinite-granting row beats a finite-granting row", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: null,
        createdAt: new Date(Date.now() - 10 * 86400_000),
      });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY",
        status: "cancelled",
        currentEnd: new Date(Date.now() + 10 * 86400_000),
      });
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("pending with currentEnd: null wins its tie-break", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "pending", currentEnd: null });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY",
        status: "cancelled",
        currentEnd: new Date(Date.now() + 300 * 86400_000),
      });
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("pending grants regardless of a past currentEnd", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "pending", currentEnd: new Date(Date.now() - 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("expired status does not grant → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "expired" });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("scheduled (future startAt) row does not grant yet", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 5 * 86400_000),
        createdAt: new Date(Date.now() - 10 * 86400_000),
      });
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        currentEnd: null,
        startAt: new Date(Date.now() + 5 * 86400_000),
      });
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
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
      await deleteTestUser(user.id);
    }
  });
});

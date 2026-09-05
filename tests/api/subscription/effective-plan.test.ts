import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

// getEffectivePlan now reaches for getProvider().cancelNow() to finalize an
// expired cancel-at-cycle-end row — force the deterministic fake so these
// in-process tests never hit the real Razorpay API.
process.env.PAYMENTS_PROVIDER = "fake";

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

  test("cancelAtCycleEnd + currentEnd in the past finalizes the row as cancelled on the provider, not left paused", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, {
        tier: "MONTHLY", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() - 86400_000),
      });
      await getEffectivePlan(user.id);
      const updated = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("cancelled");
      expect(updated.endedAt).not.toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelAtCycleEnd row already finalized (endedAt set) is not touched again", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, {
        tier: "MONTHLY", status: "cancelled", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() - 86400_000),
      });
      await getTestPrisma().subscription.update({ where: { id: row.id }, data: { endedAt: new Date(Date.now() - 3600_000) } });
      await getEffectivePlan(user.id);
      const updated = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("cancelled");
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

describeOrSkip("finalizeExpiredCancellations", () => {
  const { finalizeExpiredCancellations } = require("@/lib/services/SubscriptionService");

  test("finalizes an expired cancel-at-cycle-end row across users, independent of any request from that user", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      const rowA = await createSubscriptionRow(userA.id, {
        tier: "MONTHLY", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() - 86400_000),
      });
      // userB is unaffected — still within their paid cycle.
      const rowB = await createSubscriptionRow(userB.id, {
        tier: "ANNUAL", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() + 86400_000),
      });

      const result = await finalizeExpiredCancellations();
      expect(result.finalized).toBe(1);

      const afterA = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: rowA.id } });
      expect(afterA.status).toBe("cancelled");
      expect(afterA.endedAt).not.toBeNull();

      const afterB = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: rowB.id } });
      expect(afterB.status).toBe("active");
      expect(afterB.endedAt).toBeNull();

      // The affected user's cached tier is reconciled immediately — not
      // waiting for their next request.
      const userAfter = await getTestPrisma().user.findUniqueOrThrow({ where: { id: userA.id }, include: { subscriptionPlan: true } });
      expect(userAfter.subscriptionPlan.tier).toBe("FREE");
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("running it twice does not re-cancel an already-finalized row", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, {
        tier: "MONTHLY", status: "active", cancelAtCycleEnd: true, currentEnd: new Date(Date.now() - 86400_000),
      });
      await finalizeExpiredCancellations();
      const second = await finalizeExpiredCancellations();
      expect(second.finalized).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("reconcileSupersedingSubscriptions", () => {
  const { reconcileSupersedingSubscriptions } = require("@/lib/services/SubscriptionService");

  test("new plan reached active by startAt → cancels the superseded old plan", async () => {
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const newRow = await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      const result = await reconcileSupersedingSubscriptions({ userId: user.id });
      expect(result.upgraded).toBe(1);
      expect(result.rolledBack).toBe(0);

      const oldAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(oldAfter.status).toBe("cancelled");
      expect(oldAfter.endedAt).not.toBeNull();

      const newAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: newRow.id } });
      expect(newAfter.status).toBe("active");
      expect(newAfter.endedAt).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test.each(["created", "halted"])(
    "new plan never activated (%s) by startAt → resumes the old plan, closes out the dead row",
    async (deadStatus) => {
      const user = await createTestUser();
      try {
        const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
        const newRow = await createSubscriptionRow(user.id, {
          tier: "QUARTERLY", status: deadStatus, supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
        });

        const result = await reconcileSupersedingSubscriptions({ userId: user.id });
        expect(result.upgraded).toBe(0);
        expect(result.rolledBack).toBe(1);

        const oldAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
        expect(oldAfter.status).toBe("active");
        expect(oldAfter.endedAt).toBeNull();

        const newAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: newRow.id } });
        expect(newAfter.status).toBe("cancelled");
        expect(newAfter.endedAt).not.toBeNull();
      } finally {
        await deleteTestUser(user.id);
      }
    },
  );

  test.each(["authenticated", "pending"])(
    "new plan still live (%s) past startAt → left untouched, not yet resolved",
    async (liveStatus) => {
      const user = await createTestUser();
      try {
        const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
        const newRow = await createSubscriptionRow(user.id, {
          tier: "QUARTERLY", status: liveStatus, supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
        });

        const result = await reconcileSupersedingSubscriptions({ userId: user.id });
        expect(result.upgraded).toBe(0);
        expect(result.rolledBack).toBe(0);

        const oldAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
        expect(oldAfter.status).toBe("active");
        expect(oldAfter.endedAt).toBeNull();

        const newAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: newRow.id } });
        expect(newAfter.status).toBe(liveStatus);
        expect(newAfter.endedAt).toBeNull();
      } finally {
        await deleteTestUser(user.id);
      }
    },
  );

  test("startAt still in the future → left untouched even if status looks resolved", async () => {
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() + 3600_000),
      });

      const result = await reconcileSupersedingSubscriptions({ userId: user.id });
      expect(result.upgraded).toBe(0);
      expect(result.rolledBack).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("userId scoping — a due row for a different user is left alone", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      const oldA = await createSubscriptionRow(userA.id, { tier: "MONTHLY", status: "active" });
      const newA = await createSubscriptionRow(userA.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldA.id, startAt: new Date(Date.now() - 3600_000),
      });

      const result = await reconcileSupersedingSubscriptions({ userId: userB.id });
      expect(result.upgraded).toBe(0);

      const oldAfter = await getTestPrisma().subscription.findUniqueOrThrow({ where: { id: oldA.id } });
      expect(oldAfter.status).toBe("active");
      void newA;
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("no userId → global sweep across all users", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      const oldA = await createSubscriptionRow(userA.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(userA.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldA.id, startAt: new Date(Date.now() - 3600_000),
      });
      const oldB = await createSubscriptionRow(userB.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(userB.id, {
        tier: "ANNUAL", status: "active", supersedesId: oldB.id, startAt: new Date(Date.now() - 3600_000),
      });

      const result = await reconcileSupersedingSubscriptions();
      expect(result.upgraded).toBe(2);
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("running it twice does not re-cancel an already-resolved row", async () => {
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      await reconcileSupersedingSubscriptions({ userId: user.id });
      const second = await reconcileSupersedingSubscriptions({ userId: user.id });
      expect(second.upgraded).toBe(0);
      expect(second.rolledBack).toBe(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("two concurrent reconciliation passes never both act on the same row", async () => {
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      const [a, b] = await Promise.all([
        reconcileSupersedingSubscriptions({ userId: user.id }),
        reconcileSupersedingSubscriptions({ userId: user.id }),
      ]);
      expect(a.upgraded + b.upgraded).toBe(1);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData, getPlanId } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";
import { signedWebhook } from "../../helpers/fakeProvider";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { normalizeRazorpayWebhookEvent } from "@/lib/payments/razorpay";
import { __resetProviderCache } from "@/lib/payments";

// applySubscriptionEvent now reaches for getProvider().cancelNow() when a
// superseding row activates — force the deterministic fake so these in-process
// tests never hit the real Razorpay API.
process.env.PAYMENTS_PROVIDER = "fake";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    __resetProviderCache();
    await ensureReferenceData();
    await ensureDevServer();
  }
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("applySubscriptionEvent", () => {
  const { applySubscriptionEvent, getEffectivePlan } = require("@/lib/services/SubscriptionService");

  test("activated on a created row → active, currentEnd set, User tier updated, SubscriptionPlanHistory row logged", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "created", currentEnd: null, paidCount: 0 });
      const nowSec = Math.floor(Date.now() / 1000);
      const { body, eventId } = signedWebhook("subscription.activated", {
        id: row.providerSubscriptionId,
        status: "active",
        current_start: nowSec,
        current_end: nowSec + 30 * 86400,
        charge_at: nowSec + 30 * 86400,
        paid_count: 1,
      });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("active");
      expect(updated.currentEnd?.toISOString()).toBe(new Date((nowSec + 30 * 86400) * 1000).toISOString());

      const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { subscriptionPlan: true } });
      expect(afterUser.subscriptionPlan.tier).toBe("ANNUAL");

      const planHistory = await prisma.subscriptionPlanHistory.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      expect(planHistory?.subscriptionPlanId).toBe(await getPlanId("ANNUAL"));
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("activating a first-time subscription cancels the user's other pending first-time subscriptions, but leaves a plan-change row untouched", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const winner = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "created", currentEnd: null, paidCount: 0 });
      const sibling = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "created", currentEnd: null, paidCount: 0 });
      const oldPaidPlan = await createSubscriptionRow(user.id, { tier: "QUARTERLY", status: "active", currentEnd: new Date(Date.now() + 30 * 86400_000) });
      const planChangeRow = await createSubscriptionRow(user.id, { tier: "QUARTERLY", status: "created", supersedesId: oldPaidPlan.id, currentEnd: null });

      const nowSec = Math.floor(Date.now() / 1000);
      const { body, eventId } = signedWebhook("subscription.activated", {
        id: winner.providerSubscriptionId,
        status: "active",
        current_start: nowSec,
        current_end: nowSec + 30 * 86400,
        charge_at: nowSec + 30 * 86400,
        paid_count: 1,
      });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const updatedWinner = await prisma.subscription.findUniqueOrThrow({ where: { id: winner.id } });
      expect(updatedWinner.status).toBe("active");

      const updatedSibling = await prisma.subscription.findUniqueOrThrow({ where: { id: sibling.id } });
      expect(updatedSibling.status).toBe("cancelled");
      expect(updatedSibling.endedAt).not.toBeNull();

      // governed by reconcileSupersedingSubscriptions, not this cleanup
      const updatedPlanChangeRow = await prisma.subscription.findUniqueOrThrow({ where: { id: planChangeRow.id } });
      expect(updatedPlanChangeRow.status).toBe("created");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("charged with a higher paid_count → absolute update", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", paidCount: 2 });
      const { body, eventId } = signedWebhook("subscription.charged", { id: row.providerSubscriptionId, paid_count: 9 });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.paidCount).toBe(9);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("pending → tier kept, next getEffectivePlan().paymentRetrying === true", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "QUARTERLY", status: "active" });
      const { body, eventId } = signedWebhook("subscription.pending", { id: row.providerSubscriptionId, status: "pending" });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("QUARTERLY");
      expect(eff.paymentRetrying).toBe(true);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("halted → User falls back to FREE", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", currentEnd: new Date(Date.now() + 10 * 86400_000) });
      const { body, eventId } = signedWebhook("subscription.halted", { id: row.providerSubscriptionId, status: "halted" });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { subscriptionPlan: true } });
      expect(afterUser.subscriptionPlan.tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelled with future current_end → tier kept until then", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const futureSec = Math.floor(Date.now() / 1000) + 20 * 86400;
      const { body, eventId } = signedWebhook("subscription.cancelled", { id: row.providerSubscriptionId, status: "cancelled", current_end: futureSec });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("missing event-id header → normalize does not throw, eventId is stable across identical bodies", () => {
    const { body } = signedWebhook("subscription.charged", { id: "sub_no_header", paid_count: 1 });
    const a = normalizeRazorpayWebhookEvent(body, null);
    const b = normalizeRazorpayWebhookEvent(body, null);
    expect(a.eventId).toBeTruthy();
    expect(a.eventId).toBe(b.eventId);
  });

  test("late non-terminal event does not resurrect an ended terminal subscription", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "halted", paidCount: 3 });
      await prisma.subscription.update({ where: { id: row.id }, data: { endedAt: new Date() } });

      const { body, eventId } = signedWebhook("subscription.charged", { id: row.providerSubscriptionId, status: "active", paid_count: 9 });
      const evt = normalizeRazorpayWebhookEvent(body, eventId);

      await applySubscriptionEvent(evt);

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("halted");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("an activated event for a superseding row updates its own status but does not itself retire the old plan — that's reconciliation's job (see reconcileSupersedingSubscriptions)", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const soon = new Date(Date.now() + 5 * 86400_000);
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", currentEnd: soon });
      const newRow = await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        supersedesId: oldRow.id,
        startAt: soon,
        currentEnd: null,
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const { body, eventId } = signedWebhook("subscription.activated", {
        id: newRow.providerSubscriptionId,
        status: "active",
        current_start: nowSec,
        current_end: nowSec + 365 * 86400,
        paid_count: 1,
      });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const updatedNew = await prisma.subscription.findUniqueOrThrow({ where: { id: newRow.id } });
      expect(updatedNew.status).toBe("active");
      // The old plan is left exactly as-is — reconciliation (login-triggered or
      // the daily cron) retires it once startAt has genuinely arrived, not the
      // webhook the instant Razorpay happens to deliver it.
      const updatedOld = await prisma.subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(updatedOld.status).toBe("active");
      expect(updatedOld.endedAt).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a halted event for a superseding row is still reconciled — the webhook's own endedAt does not hide it from the rollback sweep", async () => {
    const { reconcileSupersedingSubscriptions } = require("@/lib/services/SubscriptionService");
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const newRow = await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        supersedesId: oldRow.id,
        startAt: new Date(Date.now() - 3600_000), // already due
        currentEnd: null,
      });

      // applySubscriptionEvent itself sets endedAt for any terminal status
      // (halted/completed/expired) — this must not make reconcileSupersedingSubscriptions'
      // "due" query silently skip the row before it ever gets a chance to resume the old plan.
      const { body, eventId } = signedWebhook("subscription.halted", { id: newRow.providerSubscriptionId, status: "halted" });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const halted = await prisma.subscription.findUniqueOrThrow({ where: { id: newRow.id } });
      expect(halted.status).toBe("halted");
      expect(halted.endedAt).not.toBeNull(); // set by the webhook handler itself, before reconciliation ever runs

      const result = await reconcileSupersedingSubscriptions({ userId: user.id });
      expect(result.rolledBack).toBe(1);

      const oldAfter = await prisma.subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(oldAfter.status).toBe("active");
      expect(oldAfter.endedAt).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a halted event for a superseding row still surfaces as failedChange — buildManageView must not hide it behind the webhook's own endedAt either", async () => {
    const { buildManageView } = require("@/lib/services/SubscriptionService");
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, {
        tier: "MONTHLY", status: "active", currentEnd: new Date(Date.now() + 20 * 86400_000),
      });
      const newRow = await createSubscriptionRow(user.id, {
        tier: "ANNUAL", status: "authenticated", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      const { body, eventId } = signedWebhook("subscription.halted", { id: newRow.providerSubscriptionId, status: "halted" });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const view = await buildManageView(user.id);
      expect(view.tier).toBe("MONTHLY");
      expect(view.scheduledChange).toBeNull();
      expect(view.failedChange).not.toBeNull();
      expect(view.failedChange.tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("authenticated (e-mandate set up, first charge not yet run) grants access immediately", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "created", currentEnd: null });
      const { body, eventId } = signedWebhook("subscription.authenticated", { id: row.providerSubscriptionId, status: "authenticated" });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("authenticated");

      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("MONTHLY");
      expect(eff.paymentRetrying).toBe(false);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("reaching 'authenticated' (not just 'active') already grants access, so it must cancel sibling first-time checkouts too", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const winner = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "created", currentEnd: null });
      const sibling = await createSubscriptionRow(user.id, { tier: "QUARTERLY", status: "created", currentEnd: null });

      const { body, eventId } = signedWebhook("subscription.authenticated", { id: winner.providerSubscriptionId, status: "authenticated" });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const updatedWinner = await prisma.subscription.findUniqueOrThrow({ where: { id: winner.id } });
      expect(updatedWinner.status).toBe("authenticated");

      const updatedSibling = await prisma.subscription.findUniqueOrThrow({ where: { id: sibling.id } });
      expect(updatedSibling.status).toBe("cancelled");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("completed (fixed-term plan finishes its run) → terminal, access ends at the last-paid current_end", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", totalCount: 3, paidCount: 3 });
      const pastSec = Math.floor(Date.now() / 1000) - 3600; // the run already finished by the time the event lands
      const { body, eventId } = signedWebhook("subscription.completed", {
        id: row.providerSubscriptionId,
        status: "completed",
        current_end: pastSec,
        paid_count: 3,
      });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("completed");
      expect(updated.endedAt).not.toBeNull();

      const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { subscriptionPlan: true } });
      expect(afterUser.subscriptionPlan.tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a renewal charge on a cancel-at-cycle-end row ends the subscription", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const cycleEnd = new Date(Date.now() + 2 * 3600_000);
      const row = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        cancelAtCycleEnd: true,
        currentEnd: cycleEnd,
        paidCount: 1,
      });

      const nowSec = Math.floor(Date.now() / 1000);
      const { body, eventId } = signedWebhook("subscription.charged", {
        id: row.providerSubscriptionId,
        status: "active",
        current_start: nowSec,
        current_end: nowSec + 30 * 86400,
        paid_count: 2,
      });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("cancelled");
      expect(updated.endedAt).not.toBeNull();
      // access ends at the cycle the user last paid for, not the renewed one
      expect(updated.currentEnd?.toISOString()).toBe(cycleEnd.toISOString());
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("POST /api/subscription/webhook/[provider]", () => {
  async function postWebhook(body: string, signature: string | null, eventId?: string) {
    const headers: Record<string, string> = {};
    if (signature) headers["x-razorpay-signature"] = signature;
    if (eventId) headers["x-razorpay-event-id"] = eventId;
    return fetch(`${TEST_SERVER_URL}/api/subscription/webhook/razorpay`, {
      method: "POST",
      headers,
      body,
    });
  }

  test("bad signature → 400", async () => {
    const { body, eventId } = signedWebhook("subscription.charged", { id: "sub_bad_sig", paid_count: 1 });
    const res = await postWebhook(body, "not_a_real_signature", eventId);
    expect(res.status).toBe(400);
  });

  test("unknown event id first time → processed; same event id again → duplicate, paidCount unchanged", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", paidCount: 0 });
      const { body, signature, eventId } = signedWebhook("subscription.charged", { id: row.providerSubscriptionId, paid_count: 4 });

      const first = await postWebhook(body, signature, eventId);
      expect(first.status).toBe(200);
      const firstJson = await first.json();
      expect(firstJson.duplicate).toBeFalsy();

      const afterFirst = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(afterFirst.paidCount).toBe(4);

      const second = await postWebhook(body, signature, eventId);
      expect(second.status).toBe(200);
      const secondJson = await second.json();
      expect(secondJson.duplicate).toBe(true);

      const afterSecond = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(afterSecond.paidCount).toBe(4);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("stuck 'processing' row (crashed prior attempt) is reprocessed, not treated as done", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", paidCount: 0 });
      const { body, signature, eventId } = signedWebhook("subscription.charged", { id: row.providerSubscriptionId, paid_count: 7 });

      await prisma.processedWebhookEvent.create({ data: { provider: "razorpay", eventId, status: "processing" } });

      const res = await postWebhook(body, signature, eventId);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.duplicate).toBeFalsy();

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.paidCount).toBe(7);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("'done' row is genuinely skipped, not reprocessed", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", paidCount: 3 });
      const { body, signature, eventId } = signedWebhook("subscription.charged", { id: row.providerSubscriptionId, paid_count: 8 });

      await prisma.processedWebhookEvent.create({ data: { provider: "razorpay", eventId, status: "done" } });
      const before = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });

      const res = await postWebhook(body, signature, eventId);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.duplicate).toBe(true);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.paidCount).toBe(before.paidCount);
      expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("valid signature but tampered body → 400", async () => {
    const { body, signature, eventId } = signedWebhook("subscription.charged", { id: "sub_tampered", paid_count: 1 });
    const tampered = body.replace('"paid_count":1', '"paid_count":9');
    const res = await postWebhook(tampered, signature, eventId);
    expect(res.status).toBe(400);
  });

  test("missing signature header → 400", async () => {
    const { body, eventId } = signedWebhook("subscription.charged", { id: "sub_no_sig", paid_count: 1 });
    const res = await postWebhook(body, null, eventId);
    expect(res.status).toBe(400);
  });
});

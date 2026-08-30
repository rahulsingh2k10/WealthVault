import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData, getPlanId } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";
import { signedWebhook } from "../../helpers/fakeProvider";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { normalizeRazorpayWebhookEvent } from "@/lib/payments/razorpay";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    await ensureReferenceData();
    await ensureDevServer();
  }
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("applySubscriptionEvent", () => {
  const { applySubscriptionEvent, getEffectivePlan } = require("@/lib/services/SubscriptionService");

  test("activated on a created row → active, currentEnd set, User tier updated, SubscriptionPeriod row logged", async () => {
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

      const period = await prisma.subscriptionPeriod.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
      expect(period?.subscriptionPlanId).toBe(await getPlanId("ANNUAL"));
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

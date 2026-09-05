import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";
import { signedWebhook } from "../../helpers/fakeProvider";
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

// These routes sit behind middleware.ts's generic "/api/*" gate, which requires
// session.encryptionKey (vault unlocked) in addition to userId — same as the
// dashboard route (see tests/api/dashboard/dashboard.test.ts) and Task 9's
// create/verify routes.
async function cookieFor(userId: string): Promise<string> {
  const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-not-validated-by-this-route" });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

async function postCancel(cookie: string) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/cancel`, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

async function postChangePlan(cookie: string, body: unknown) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/change-plan`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describeOrSkip("buildManageView", () => {
  const { buildManageView } = require("@/lib/services/SubscriptionService");
  const { formatMoney } = require("@/lib/utils");

  test("no granting rows → { tier: \"FREE\" }", async () => {
    const user = await createTestUser();
    try {
      const view = await buildManageView(user.id);
      expect(view).toEqual({ tier: "FREE" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("active ANNUAL → full view, priceLockedThrough ≈ createdAt + termMonths", async () => {
    const user = await createTestUser();
    try {
      const createdAt = new Date(Date.now() - 5 * 86400_000);
      const row = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", createdAt });
      const view = await buildManageView(user.id);

      expect(view.tier).toBe("ANNUAL");
      expect(view.planName).toBe("Sovereign");
      expect(view.status).toBe("active");
      expect(view.amountPerCycle).toBe(formatMoney(Math.round(row.amount / 100), row.currency));
      expect(view.intervalLabel).toBe("year");
      expect(view.currentEnd).toBe(row.currentEnd?.toISOString());
      expect(view.cancelAtCycleEnd).toBe(false);
      expect(view.paymentRetrying).toBe(false);
      expect(view.retryUrl).toBeNull();

      const expectedLock = new Date(createdAt);
      expectedLock.setMonth(expectedLock.getMonth() + 36); // ANNUAL's termMonths, per seedReferenceData
      expect(view.priceLockedThrough).toBe(expectedLock.toISOString());
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("pending → paymentRetrying: true, retryUrl from providerData.shortUrl", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "pending" });
      await prisma.subscription.update({ where: { id: row.id }, data: { providerData: { shortUrl: "https://fake.rzp/retry_test" } } });

      const view = await buildManageView(user.id);
      expect(view.paymentRetrying).toBe(true);
      expect(view.retryUrl).toBe("https://fake.rzp/retry_test");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  // Not one of the plan's 3 required cases. buildManageView now reuses
  // getEffectivePlan's chooseGrantingRow helper, so a scheduled (not-yet-started)
  // plan-change row no longer shadows the still-effective old plan in the manage
  // view — both functions agree on which row is "current".
  test("surfaces a scheduled plan change from a superseding row", async () => {
    const user = await createTestUser();
    try {
      const cur = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 20 * 86400_000),
      });

      // Without a superseding row, there is no scheduled change.
      const before = await buildManageView(user.id);
      expect(before.tier).toBe("MONTHLY");
      expect(before.scheduledChange).toBeNull();

      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        supersedesId: cur.id,
        startAt: cur.currentEnd,
      });

      const view = await buildManageView(user.id);
      expect(view.tier).toBe("MONTHLY"); // still on the old plan
      expect(view.scheduledChange).not.toBeNull();
      expect(view.scheduledChange.planName).toBe("Sovereign");
      expect(view.scheduledChange.startsAt).toBe(cur.currentEnd?.toISOString());
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a newer scheduled (future startAt) row does not shadow the still-effective old plan", async () => {
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 5 * 86400_000),
        createdAt: new Date(Date.now() - 10 * 86400_000),
      });
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        supersedesId: oldRow.id,
        startAt: new Date(Date.now() + 5 * 86400_000), // scheduled — hasn't started yet
        createdAt: new Date(), // most recent → rows.find() picks this one first
      });

      const view = await buildManageView(user.id);
      // getEffectivePlan (the source of truth for access) says MONTHLY:
      const { getEffectivePlan } = require("@/lib/services/SubscriptionService");
      expect((await getEffectivePlan(user.id)).tier).toBe("MONTHLY");
      // ...and buildManageView now agrees, instead of showing the not-yet-started ANNUAL row.
      expect(view.tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a superseding row stuck at 'created' (failed/abandoned checkout) is surfaced as failedChange, not scheduledChange", async () => {
    const user = await createTestUser();
    try {
      const cur = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 20 * 86400_000),
      });

      // /api/subscription/change-plan writes exactly this row *before* Razorpay
      // checkout ever opens. If the payment fails or the user abandons checkout,
      // nothing ever updates it — it's left stuck at "created" forever.
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "created",
        supersedesId: cur.id,
        startAt: cur.currentEnd,
      });

      const view = await buildManageView(user.id);
      expect(view.tier).toBe("MONTHLY");
      // Must NOT be reported as a genuine upcoming switch...
      expect(view.scheduledChange).toBeNull();
      // ...but the failed attempt must be surfaced so the UI can offer a retry.
      expect(view.failedChange).not.toBeNull();
      expect(view.failedChange.tier).toBe("ANNUAL");
      expect(view.failedChange.planName).toBe("Sovereign");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a superseding row that reached 'halted' (mandate authenticated, then the charge failed) is surfaced as failedChange too", async () => {
    const user = await createTestUser();
    try {
      const cur = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 20 * 86400_000),
      });

      // Mandate was authenticated, Razorpay attempted the first charge at
      // startAt, retried, and gave up — startAt is now in the past.
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "halted",
        supersedesId: cur.id,
        startAt: new Date(Date.now() - 2 * 86400_000),
      });

      const view = await buildManageView(user.id);
      expect(view.tier).toBe("MONTHLY");
      expect(view.scheduledChange).toBeNull();
      expect(view.failedChange).not.toBeNull();
      expect(view.failedChange.tier).toBe("ANNUAL");
      expect(view.failedChange.planName).toBe("Sovereign");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a genuinely scheduled change (authenticated) takes precedence over an older failed ('created') attempt", async () => {
    const user = await createTestUser();
    try {
      const cur = await createSubscriptionRow(user.id, {
        tier: "MONTHLY",
        status: "active",
        currentEnd: new Date(Date.now() + 20 * 86400_000),
        createdAt: new Date(Date.now() - 10 * 86400_000),
      });
      // First attempt failed and was abandoned at "created"...
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "created",
        supersedesId: cur.id,
        startAt: cur.currentEnd,
        createdAt: new Date(Date.now() - 5 * 86400_000),
      });
      // ...then the user retried and this one actually completed checkout.
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY",
        status: "authenticated",
        supersedesId: cur.id,
        startAt: cur.currentEnd,
        createdAt: new Date(),
      });

      const view = await buildManageView(user.id);
      expect(view.scheduledChange).not.toBeNull();
      expect(view.scheduledChange.tier).toBe("QUARTERLY");
      expect(view.failedChange).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("POST /api/subscription/cancel", () => {
  test("no cookie → 401", async () => {
    const res = await postCancel("");
    expect(res.status).toBe(401);
  });

  test("no active subscription → 404", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await postCancel(cookie);
      expect(res.status).toBe(404);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("active subscription → { ok: true, accessUntil }, DB row cancelAtCycleEnd: true", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const cookie = await cookieFor(user.id);

      const res = await postCancel(cookie);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(new Date(json.accessUntil).toISOString()).toBe(row.currentEnd?.toISOString());

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.cancelAtCycleEnd).toBe(true);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

async function postResume(cookie: string) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/resume`, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

describeOrSkip("POST /api/subscription/resume", () => {
  test("no cookie → 401", async () => {
    const res = await postResume("");
    expect(res.status).toBe(401);
  });

  test("no cancel-at-cycle-end subscription → 404", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", cancelAtCycleEnd: false });
      const cookie = await cookieFor(user.id);
      const res = await postResume(cookie);
      expect(res.status).toBe(404);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("flips cancelAtCycleEnd back to false while the cycle is still running", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, {
        tier: "ANNUAL", status: "active", cancelAtCycleEnd: true,
        currentEnd: new Date(Date.now() + 10 * 86400_000),
      });
      const cookie = await cookieFor(user.id);

      const res = await postResume(cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.cancelAtCycleEnd).toBe(false);
      expect(updated.status).toBe("active");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cycle already ended → 409 (must re-subscribe)", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, {
        tier: "ANNUAL", status: "active", cancelAtCycleEnd: true,
        currentEnd: new Date(Date.now() - 86400_000),
      });
      const cookie = await cookieFor(user.id);
      const res = await postResume(cookie);
      expect(res.status).toBe(409);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("POST /api/subscription/change-plan", () => {
  test("no cookie → 401", async () => {
    const res = await postChangePlan("", { tier: "ANNUAL" });
    expect(res.status).toBe(401);
  });

  test("tier: FREE or garbage → 400", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const cookie = await cookieFor(user.id);
      for (const tier of ["FREE", "not_a_real_tier"]) {
        const res = await postChangePlan(cookie, { tier });
        expect(res.status).toBe(400);
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("same tier as current → 400", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const cookie = await cookieFor(user.id);
      const res = await postChangePlan(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(400);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("no active subscription to change from → 404", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await postChangePlan(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(404);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("current subscription has null currentEnd → 409, not 500", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "authenticated", currentEnd: null });
      const cookie = await cookieFor(user.id);
      const res = await postChangePlan(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toEqual(expect.any(String));
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("valid change → creates a superseding row (created, supersedesId, startAt = old currentEnd) and returns checkout", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const cookie = await cookieFor(user.id);

      const res = await postChangePlan(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.checkout.razorpay.subscriptionId).toEqual(expect.any(String));

      const newRow = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id, providerSubscriptionId: json.checkout.razorpay.subscriptionId },
        include: { subscriptionPlan: true },
      });
      expect(newRow.status).toBe("created");
      expect(newRow.supersedesId).toBe(oldRow.id);
      expect(newRow.subscriptionPlan.tier).toBe("ANNUAL");
      expect(newRow.startAt?.toISOString()).toBe(oldRow.currentEnd?.toISOString());
    } finally {
      await deleteTestUser(user.id);
    }
  });

  // The route has no upgrade/downgrade direction check — it schedules a plan
  // switch for any tier != current. Same code path as the upgrade test above,
  // asserted explicitly since "downgrade" is a distinct product use case.
  test("downgrade (ANNUAL → MONTHLY) creates a superseding row the same way an upgrade does", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const cookie = await cookieFor(user.id);

      const res = await postChangePlan(cookie, { tier: "MONTHLY" });
      expect(res.status).toBe(200);
      const json = await res.json();

      const newRow = await prisma.subscription.findFirstOrThrow({
        where: { userId: user.id, providerSubscriptionId: json.checkout.razorpay.subscriptionId },
        include: { subscriptionPlan: true },
      });
      expect(newRow.status).toBe("created");
      expect(newRow.supersedesId).toBe(oldRow.id);
      expect(newRow.subscriptionPlan.tier).toBe("MONTHLY");
      expect(newRow.startAt?.toISOString()).toBe(oldRow.currentEnd?.toISOString());

      // The old (more expensive) plan keeps granting access until the switch takes effect.
      const { getEffectivePlan } = require("@/lib/services/SubscriptionService");
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test.each(["authenticated", "pending"])(
    "a live pending change (%s) already exists → 409, nothing created",
    async (liveStatus) => {
      const prisma = getTestPrisma();
      const user = await createTestUser();
      try {
        const cur = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
        await createSubscriptionRow(user.id, {
          tier: "QUARTERLY", status: liveStatus, supersedesId: cur.id, startAt: cur.currentEnd,
        });
        const cookie = await cookieFor(user.id);

        const before = await prisma.subscription.count({ where: { userId: user.id } });
        const res = await postChangePlan(cookie, { tier: "ANNUAL" });
        expect(res.status).toBe(409);
        const json = await res.json();
        expect(json.error).toEqual(expect.any(String));

        const after = await prisma.subscription.count({ where: { userId: user.id } });
        expect(after).toBe(before);
      } finally {
        await deleteTestUser(user.id);
      }
    },
  );

  test.each(["created", "halted"])(
    "a dead pending change (%s) is retired automatically, then the new change proceeds",
    async (deadStatus) => {
      const prisma = getTestPrisma();
      const user = await createTestUser();
      try {
        const cur = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
        const dead = await createSubscriptionRow(user.id, {
          tier: "QUARTERLY", status: deadStatus, supersedesId: cur.id, startAt: cur.currentEnd,
        });
        const cookie = await cookieFor(user.id);

        const res = await postChangePlan(cookie, { tier: "ANNUAL" });
        expect(res.status).toBe(200);
        const json = await res.json();

        const deadAfter = await prisma.subscription.findUnique({ where: { id: dead.id } });
        expect(deadAfter).toBeNull();

        const newRow = await prisma.subscription.findFirstOrThrow({
          where: { userId: user.id, providerSubscriptionId: json.checkout.razorpay.subscriptionId },
          include: { subscriptionPlan: true },
        });
        expect(newRow.supersedesId).toBe(cur.id);
        expect(newRow.status).toBe("created");
        expect(newRow.subscriptionPlan.tier).toBe("ANNUAL");
      } finally {
        await deleteTestUser(user.id);
      }
    },
  );

  test("a dead pending change that reached halted via a real webhook (endedAt already set by applySubscriptionEvent) is still retired, not left dangling", async () => {
    const { applySubscriptionEvent } = require("@/lib/services/SubscriptionService");
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const cur = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const dead = await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "authenticated", supersedesId: cur.id, startAt: cur.currentEnd,
      });

      // applySubscriptionEvent itself sets endedAt for a terminal "halted"
      // status — the guard below must not use endedAt to detect "still pending".
      const { body, eventId } = signedWebhook("subscription.halted", { id: dead.providerSubscriptionId, status: "halted" });
      await applySubscriptionEvent(normalizeRazorpayWebhookEvent(body, eventId));
      const deadBefore = await prisma.subscription.findUniqueOrThrow({ where: { id: dead.id } });
      expect(deadBefore.status).toBe("halted");
      expect(deadBefore.endedAt).not.toBeNull();

      const cookie = await cookieFor(user.id);
      const res = await postChangePlan(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(200);
      const json = await res.json();

      const deadAfter = await prisma.subscription.findUnique({ where: { id: dead.id } });
      expect(deadAfter).toBeNull();

      const rows = await prisma.subscription.findMany({ where: { userId: user.id, supersedesId: cur.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0].providerSubscriptionId).toBe(json.checkout.razorpay.subscriptionId);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

async function postCancelScheduledChange(cookie: string) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/cancel-scheduled-change`, {
    method: "POST",
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

describeOrSkip("POST /api/subscription/cancel-scheduled-change", () => {
  test("no cookie → 401", async () => {
    const res = await postCancelScheduledChange("");
    expect(res.status).toBe(401);
  });

  test("no scheduled change → 404", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const cookie = await cookieFor(user.id);
      const res = await postCancelScheduledChange(cookie);
      expect(res.status).toBe(404);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("drops the pending row and leaves the current plan untouched", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const soon = new Date(Date.now() + 10 * 86400_000);
      const cur = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active", currentEnd: soon });
      const pending = await createSubscriptionRow(user.id, {
        tier: "ANNUAL",
        status: "authenticated",
        supersedesId: cur.id,
        startAt: soon,
      });
      const cookie = await cookieFor(user.id);

      const res = await postCancelScheduledChange(cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      expect(await prisma.subscription.findUnique({ where: { id: pending.id } })).toBeNull();
      const curAfter = await prisma.subscription.findUniqueOrThrow({ where: { id: cur.id } });
      expect(curAfter.status).toBe("active");
      expect(curAfter.cancelAtCycleEnd).toBe(false);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

async function getSubscription(cookie: string) {
  return fetch(`${TEST_SERVER_URL}/api/subscription`, {
    method: "GET",
    headers: { ...(cookie ? { cookie } : {}) },
  });
}

describeOrSkip("GET /api/subscription", () => {
  test("no cookie → 401", async () => {
    const res = await getSubscription("");
    expect(res.status).toBe(401);
  });

  test("FREE user → 200 { tier: \"FREE\" }", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await getSubscription(cookie);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ tier: "FREE" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("paid user → 200 with the same shape buildManageView returns", async () => {
    const { buildManageView } = require("@/lib/services/SubscriptionService");
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      const cookie = await cookieFor(user.id);

      const res = await getSubscription(cookie);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual(await buildManageView(user.id));
      expect(json.tier).toBe("MONTHLY");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("listPaidPlansForChange", () => {
  const { listPaidPlansForChange } = require("@/lib/services/SubscriptionService");
  const { formatMoney } = require("@/lib/utils");

  test("returns MONTHLY, QUARTERLY, ANNUAL in enum declaration order, excluding FREE", async () => {
    const plans = await listPaidPlansForChange();
    expect(plans.map((p: { tier: string }) => p.tier)).toEqual(["MONTHLY", "QUARTERLY", "ANNUAL"]);
  });

  test("names and per-month/per-cycle prices match the plan picker shown on the Manage screen", async () => {
    const prisma = getTestPrisma();
    const plans = await listPaidPlansForChange();
    const byTier = Object.fromEntries(plans.map((p: { tier: string }) => [p.tier, p]));

    expect(byTier.MONTHLY.name).toBe("Reserve");
    expect(byTier.QUARTERLY.name).toBe("Treasury");
    expect(byTier.ANNUAL.name).toBe("Sovereign");

    for (const tier of ["MONTHLY", "QUARTERLY", "ANNUAL"] as const) {
      const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier } });
      const amount = Number(plan.offerPrice ?? plan.price);
      expect(byTier[tier].perCycle).toBe(formatMoney(amount, plan.currency));
      expect(byTier[tier].perMonth).toBe(formatMoney(Math.round(amount / (plan.intervalMonths ?? 1)), plan.currency));
    }
  });
});

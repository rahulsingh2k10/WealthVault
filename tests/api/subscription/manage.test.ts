import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

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
});

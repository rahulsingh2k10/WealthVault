import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";
import { checkoutSignature } from "../../helpers/fakeProvider";
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
// dashboard route (see tests/api/dashboard/dashboard.test.ts).
async function cookieFor(userId: string): Promise<string> {
  const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-not-validated-by-this-route" });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

async function postCreate(cookie: string, body: unknown) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/create`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

async function postVerify(cookie: string, body: unknown) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describeOrSkip("POST /api/subscription/create", () => {
  test("no cookie → 401", async () => {
    const res = await postCreate("", { tier: "ANNUAL" });
    expect(res.status).toBe(401);
  });

  test("FREE user, tier: ANNUAL → 200, returns checkout.razorpay.subscriptionId, Subscription row created, user.razorpayCustomerId set", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.checkout.razorpay.subscriptionId).toEqual(expect.any(String));

      const row = await prisma.subscription.findFirst({ where: { userId: user.id, providerSubscriptionId: json.checkout.razorpay.subscriptionId } });
      expect(row?.status).toBe("created");

      const afterUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterUser.razorpayCustomerId).toEqual(expect.any(String));
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("already-subscribed user → 409", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "active" });
      const cookie = await cookieFor(user.id);
      const res = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res.status).toBe(409);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("second click on the same plan reuses the pending created subscription instead of creating a duplicate", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res1 = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      const res2 = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      expect(json2.checkout.razorpay.subscriptionId).toBe(json1.checkout.razorpay.subscriptionId);

      const rows = await prisma.subscription.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("choosing a different plan before paying leaves the earlier pending subscription untouched and creates a separate one for the new plan", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res1 = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res1.status).toBe(200);
      const json1 = await res1.json();

      const res2 = await postCreate(cookie, { tier: "MONTHLY" });
      expect(res2.status).toBe(200);
      const json2 = await res2.json();

      expect(json2.checkout.razorpay.subscriptionId).not.toBe(json1.checkout.razorpay.subscriptionId);

      const rows = await prisma.subscription.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
      expect(rows).toHaveLength(2);
      expect(rows.every((r) => r.status === "created")).toBe(true);
      expect(rows[0].providerSubscriptionId).toBe(json1.checkout.razorpay.subscriptionId);
      expect(rows[1].providerSubscriptionId).toBe(json2.checkout.razorpay.subscriptionId);

      // retrying the ANNUAL plan still reuses the original row, untouched by
      // the MONTHLY click in between
      const res3 = await postCreate(cookie, { tier: "ANNUAL" });
      expect(res3.status).toBe(200);
      const json3 = await res3.json();
      expect(json3.checkout.razorpay.subscriptionId).toBe(json1.checkout.razorpay.subscriptionId);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("tier: FREE or garbage → 400", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      for (const tier of ["FREE", "not_a_real_tier"]) {
        const res = await postCreate(cookie, { tier });
        expect(res.status).toBe(400);
      }
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("malformed JSON body → clean error response, not a crash", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await fetch(`${TEST_SERVER_URL}/api/subscription/create`, {
        method: "POST",
        headers: { "content-type": "application/json", cookie },
        body: "not json",
      });
      expect([400, 500]).toContain(res.status);
      const json = await res.json();
      expect(json.error).toEqual(expect.any(String));
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("POST /api/subscription/verify", () => {
  test("matching checkoutSignature → row authenticated, { ok: true }", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { status: "created" });
      const cookie = await cookieFor(user.id);
      const paymentId = "pay_test_1";
      const signature = checkoutSignature(paymentId, row.providerSubscriptionId);

      const res = await postVerify(cookie, {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: row.providerSubscriptionId,
        razorpay_signature: signature,
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ ok: true });

      const updated = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(updated.status).toBe("authenticated");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("bad signature → 400", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { status: "created" });
      const cookie = await cookieFor(user.id);

      const res = await postVerify(cookie, {
        razorpay_payment_id: "pay_test_2",
        razorpay_subscription_id: row.providerSubscriptionId,
        razorpay_signature: "not_a_real_signature",
      });
      expect(res.status).toBe(400);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("verify for another user's subscription id → 404", async () => {
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      const rowB = await createSubscriptionRow(userB.id, { status: "created" });
      const cookieA = await cookieFor(userA.id);
      const paymentId = "pay_test_3";
      const signature = checkoutSignature(paymentId, rowB.providerSubscriptionId);

      const res = await postVerify(cookieA, {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: rowB.providerSubscriptionId,
        razorpay_signature: signature,
      });
      expect(res.status).toBe(404);
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("verify on a superseding row leaves the old subscription untouched", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const oldRow = await createSubscriptionRow(user.id, { status: "active" });
      const newRow = await createSubscriptionRow(user.id, { status: "created", supersedesId: oldRow.id });
      const cookie = await cookieFor(user.id);
      const paymentId = "pay_test_supersede";
      const signature = checkoutSignature(paymentId, newRow.providerSubscriptionId);

      const res = await postVerify(cookie, {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: newRow.providerSubscriptionId,
        razorpay_signature: signature,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true });

      // The new row advances; the old one is NOT cancelled here — that happens
      // only when the new plan actually activates (via the webhook).
      const updatedNew = await prisma.subscription.findUniqueOrThrow({ where: { id: newRow.id } });
      expect(updatedNew.status).toBe("authenticated");
      const updatedOld = await prisma.subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(updatedOld.cancelAtCycleEnd).toBe(false);
      expect(updatedOld.status).toBe("active");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("re-verifying the same subscription twice is a safe no-op", async () => {
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { status: "created" });
      const cookie = await cookieFor(user.id);
      const paymentId = "pay_test_idempotent";
      const signature = checkoutSignature(paymentId, row.providerSubscriptionId);
      const payload = {
        razorpay_payment_id: paymentId,
        razorpay_subscription_id: row.providerSubscriptionId,
        razorpay_signature: signature,
      };

      const res1 = await postVerify(cookie, payload);
      expect(res1.status).toBe(200);
      expect(await res1.json()).toEqual({ ok: true });

      const res2 = await postVerify(cookie, payload);
      expect(res2.status).toBe(200);
      expect(await res2.json()).toEqual({ ok: true });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

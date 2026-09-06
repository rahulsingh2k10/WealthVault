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

// Same middleware gate as create/verify — see create-verify.test.ts.
async function cookieFor(userId: string): Promise<string> {
  const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-not-validated-by-this-route" });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

async function postAbandon(cookie: string, body: unknown) {
  return fetch(`${TEST_SERVER_URL}/api/subscription/abandon`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describeOrSkip("POST /api/subscription/abandon", () => {
  test("no cookie → 401", async () => {
    const res = await postAbandon("", { providerSubscriptionId: "sub_x" });
    expect(res.status).toBe(401);
  });

  test("missing providerSubscriptionId → 400", async () => {
    const user = await createTestUser();
    try {
      const cookie = await cookieFor(user.id);
      const res = await postAbandon(cookie, {});
      expect(res.status).toBe(400);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancels the caller's own 'created' row → 200, cancelled: true", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { status: "created" });
      const cookie = await cookieFor(user.id);

      const res = await postAbandon(cookie, { providerSubscriptionId: row.providerSubscriptionId });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ cancelled: true });

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe("cancelled");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cannot cancel another user's row → 200, cancelled: false, row untouched", async () => {
    const prisma = getTestPrisma();
    const userA = await createTestUser();
    const userB = await createTestUser();
    try {
      const row = await createSubscriptionRow(userB.id, { status: "created" });
      const cookieA = await cookieFor(userA.id);

      const res = await postAbandon(cookieA, { providerSubscriptionId: row.providerSubscriptionId });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ cancelled: false });

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe("created");
    } finally {
      await deleteTestUser(userA.id);
      await deleteTestUser(userB.id);
    }
  });

  test("row already authenticated → cancelled: false, left untouched", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const row = await createSubscriptionRow(user.id, { status: "authenticated" });
      const cookie = await cookieFor(user.id);

      const res = await postAbandon(cookie, { providerSubscriptionId: row.providerSubscriptionId });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ cancelled: false });

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe("authenticated");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

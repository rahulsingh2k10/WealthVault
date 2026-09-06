import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";
import { deriveKey, encrypt, decrypt } from "../../../frontend/src/lib/encryption";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

const VALID_PASSPHRASE = "TestPass123!@#";
const WRONG_PASSPHRASE = "WrongPass456$%^";

async function unlock(cookie: string, passphrase: string) {
  return fetch(`${TEST_SERVER_URL}/api/auth/unlock`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ passphrase }),
  });
}

beforeAll(async () => {
  await ensureDevServer();
  if (hasTestDb()) await ensureReferenceData();
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("POST /api/auth/unlock", () => {
  test("401 when there is no session cookie", async () => {
    const res = await unlock("", VALID_PASSPHRASE);
    expect(res.status).toBe(401);
  });

  test("400 when passphrase is missing", async () => {
    const cookie = await sealSessionCookie({ userId: "does-not-matter" });
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: `${SESSION_COOKIE_NAME}=${cookie}` },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  test("400 when first-time passphrase fails strength validation", async () => {
    const user = await createTestUser({ verifier: null });
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, "short");
      expect(res.status).toBe(400);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("first-time unlock stores a verifier and returns firstTime: true", async () => {
    const user = await createTestUser({ verifier: null });
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, VALID_PASSPHRASE);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, firstTime: true });

      const prisma = getTestPrisma();
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.verifier).toBeTruthy();
      // The stored verifier decrypts back to the known plaintext under the derived key.
      const keyHex = deriveKey(VALID_PASSPHRASE);
      expect(decrypt(updated.verifier!, keyHex)).toBe("PORTFOLIO_APP_V1");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returning user: correct passphrase unlocks without rewriting the verifier", async () => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, VALID_PASSPHRASE);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true, firstTime: false });

      const prisma = getTestPrisma();
      const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(unchanged.verifier).toBe(verifier);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returning user: wrong passphrase is rejected with 401 and the verifier is untouched", async () => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, WRONG_PASSPHRASE);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Invalid passphrase");

      const prisma = getTestPrisma();
      const unchanged = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(unchanged.verifier).toBe(verifier);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("404 when the session's userId no longer exists", async () => {
    const sealed = await sealSessionCookie({ userId: "00000000-0000-0000-0000-000000000000" });
    const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, VALID_PASSPHRASE);
    expect(res.status).toBe(404);
  });

  test("a due plan-change reconciles synchronously before the response is returned — no cron needed", async () => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      const prisma = getTestPrisma();
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, VALID_PASSPHRASE);
      expect(res.status).toBe(200);

      const oldAfter = await prisma.subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(oldAfter.status).toBe("cancelled");
      expect(oldAfter.endedAt).not.toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("leaves the user's own stale first-time checkout alone on unlock — only an activation elsewhere cleans those up", async () => {
    const keyHex = deriveKey(VALID_PASSPHRASE);
    const verifier = encrypt("PORTFOLIO_APP_V1", keyHex);
    const user = await createTestUser({ verifier });
    try {
      const prisma = getTestPrisma();
      const row = await createSubscriptionRow(user.id, {
        status: "created", createdAt: new Date(Date.now() - 2 * 3600_000),
      });

      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await unlock(`${SESSION_COOKIE_NAME}=${sealed}`, VALID_PASSPHRASE);
      expect(res.status).toBe(200);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe("created");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

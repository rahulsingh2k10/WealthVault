import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
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

async function cookieFor(userId: string): Promise<string> {
  // /api/preferences sits behind middleware.ts but is explicitly allowed
  // without encryptionKey — only userId is required.
  const sealed = await sealSessionCookie({ userId });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

function getPrefs(cookie?: string) {
  return fetch(`${TEST_SERVER_URL}/api/preferences`, {
    headers: cookie ? { cookie } : {},
  });
}

function patchPref(body: unknown, cookie?: string) {
  return fetch(`${TEST_SERVER_URL}/api/preferences`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describeOrSkip("/api/preferences", () => {
  test("GET without a session cookie → 401", async () => {
    const res = await getPrefs();
    expect(res.status).toBe(401);
  });

  test("PATCH without a session cookie → 401", async () => {
    const res = await patchPref({ key: "country", value: "IN" });
    expect(res.status).toBe(401);
  });

  test("GET for a user with no rows → all defaults", async () => {
    const user = await createTestUser();
    try {
      const res = await getPrefs(await cookieFor(user.id));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ country: "US", locale: "en-US", theme: "dark" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("PATCH persists a preference and GET reads it back over the defaults", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      const patch = await patchPref({ key: "country", value: "IN" }, cookie);
      expect(patch.status).toBe(200);
      await expect(patch.json()).resolves.toEqual({ success: true });

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: user.id, key: "country", value: "IN" });

      const get = await getPrefs(cookie);
      await expect(get.json()).resolves.toEqual({ country: "IN", locale: "en-US", theme: "dark" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a second PATCH on the same key updates the same row (upsert, not insert)", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      await patchPref({ key: "theme", value: "light" }, cookie);
      await patchPref({ key: "theme", value: "dark" }, cookie);

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id, key: "theme" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("dark");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("PATCH with a key outside the allow-list → 400 and writes nothing", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      const res = await patchPref({ key: "isAdmin", value: "true" }, cookie);
      expect(res.status).toBe(400);

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

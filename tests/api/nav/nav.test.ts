import { hasTestDb, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { ensureNavData } from "../../helpers/seedNavData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton."
      );
    }
    await ensureReferenceData();
    await ensureNavData();
    await ensureDevServer();
  }
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

async function cookieFor(userId: string): Promise<string> {
  const sealed = await sealSessionCookie({ userId });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

function getNav(country?: string, cookie?: string) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  return fetch(`${TEST_SERVER_URL}/api/nav${qs}`, {
    headers: cookie ? { cookie } : {},
  });
}

describeOrSkip("/api/nav", () => {
  test("GET without a session cookie -> 401", async () => {
    const res = await getNav("IN");
    expect(res.status).toBe(401);
  });

  test("GET ?country=IN -> 11 rows, sortOrder ascending", async () => {
    const user = await createTestUser();
    try {
      const res = await getNav("IN", await cookieFor(user.id));
      expect(res.status).toBe(200);
      const rows = (await res.json()) as { href: string; sortOrder: number; iconName: string }[];
      expect(rows).toHaveLength(11);
      expect(rows.map((r) => r.sortOrder)).toEqual(
        [...rows.map((r) => r.sortOrder)].sort((a, b) => a - b)
      );
      expect(rows[0].href).toBe("/dashboard");
      expect(rows.find((r) => r.href === "/fixed-income")?.iconName).toBe("Vault");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("GET ?country=ZZ (unconfigured) -> India's 11 rows", async () => {
    const user = await createTestUser();
    try {
      const res = await getNav("ZZ", await cookieFor(user.id));
      expect(res.status).toBe(200);
      const rows = (await res.json()) as unknown[];
      expect(rows).toHaveLength(11);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

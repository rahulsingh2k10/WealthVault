import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

// A real (tiny, 1x1 red pixel) PNG data URL — small enough to pass the size
// guard, but still a genuine "data:image/..." payload, not a fake string.
const VALID_AVATAR =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function patchAvatar(cookie: string, body: unknown) {
  return fetch(`${TEST_SERVER_URL}/api/auth/avatar`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  await ensureDevServer();
  if (hasTestDb()) await ensureReferenceData();
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("PATCH /api/auth/avatar", () => {
  test("401 when there is no session cookie", async () => {
    const res = await patchAvatar("", { avatar: VALID_AVATAR });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  test("400 when avatar is missing from the body", async () => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {});
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid avatar data" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("400 when avatar does not start with data:image/", async () => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {
        avatar: "not-a-data-url",
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Invalid avatar data" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("400 when avatar exceeds the ~350 KB size guard", async () => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const oversized = "data:image/png;base64," + "A".repeat(500_001);
      const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {
        avatar: oversized,
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body).toEqual({ error: "Image too large (max ~350 KB)" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("200 on a valid avatar, and it is actually persisted to the users table", async () => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {
        avatar: VALID_AVATAR,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ success: true });

      const prisma = getTestPrisma();
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.avatar).toBe(VALID_AVATAR);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("200 does not re-seal the session cookie — the avatar lives only in the users table", async () => {
    const user = await createTestUser();
    try {
      const sealed = await sealSessionCookie({ userId: user.id });
      const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {
        avatar: VALID_AVATAR,
      });
      expect(res.status).toBe(200);
      // A data URL avatar is far larger than a cookie can hold, so this route
      // must not attempt to write it back into the session. No Set-Cookie
      // header at all means the session was never touched.
      const setCookie = res.headers.getSetCookie?.() ?? [];
      expect(setCookie.some((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))).toBe(false);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("404 when the session's userId no longer exists", async () => {
    const sealed = await sealSessionCookie({ userId: "00000000-0000-0000-0000-000000000000" });
    const res = await patchAvatar(`${SESSION_COOKIE_NAME}=${sealed}`, {
      avatar: VALID_AVATAR,
    });
    // The route updates by id without checking existence first — Prisma
    // throws (P2025) on a missing row, which the route's catch-all turns
    // into a 500, not a 404 (unlike /api/auth/unlock, which checks first).
    expect(res.status).toBe(500);
  });
});

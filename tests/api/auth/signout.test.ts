import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

beforeAll(async () => {
  await ensureDevServer();
}, 70000);

function firstCookiePair(setCookieHeader: string): string {
  return setCookieHeader.split(";")[0];
}

describe("POST /api/auth/signout", () => {
  test("200 with no session cookie at all", async () => {
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/signout`, { method: "POST" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  test("clears the session cookie (Max-Age=0) even with no prior session", async () => {
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/signout`, { method: "POST" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  test("200 with a populated session cookie, and clears it the same way", async () => {
    const sealed = await sealSessionCookie({
      userId: "does-not-need-to-exist-for-this-route",
      userName: "Test User",
      userEmail: "test@example.com",
    });
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/signout`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookie).toMatch(/Max-Age=0/i);
  });

  test("the cleared cookie it returns no longer carries a valid session", async () => {
    const sealed = await sealSessionCookie({ userId: "some-user-id" });
    const signOutRes = await fetch(`${TEST_SERVER_URL}/api/auth/signout`, {
      method: "POST",
      headers: { cookie: `${SESSION_COOKIE_NAME}=${sealed}` },
    });
    const clearedCookiePair = firstCookiePair(signOutRes.headers.get("set-cookie") ?? "");
    expect(clearedCookiePair).toBeTruthy();

    // Re-send exactly the cookie signout just returned to an endpoint that
    // requires a session — it must now be treated as unauthenticated.
    const unlockRes = await fetch(`${TEST_SERVER_URL}/api/auth/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: clearedCookiePair },
      body: JSON.stringify({ passphrase: "irrelevant" }),
    });
    expect(unlockRes.status).toBe(401);
  });
});

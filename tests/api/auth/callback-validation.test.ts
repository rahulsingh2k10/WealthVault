import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";

// These callback routes exchange the "code" param with the real provider —
// that leg can't be exercised without a live OAuth session, so this suite
// covers only the pre-provider validation logic every callback runs first:
// missing params, CSRF state mismatch, and (for X) the PKCE cookie check.
// The successful upsert path is covered at the Prisma level instead, in the
// database suite.
//
// Apple's callback is a POST reading form-encoded fields (Apple's
// response_mode=form_post), not a GET with query params like the other three.
const GET_PROVIDERS = ["google", "x", "linkedin"] as const;

beforeAll(async () => {
  await ensureDevServer();
}, 70000);

describe("OAuth callback validation", () => {
  for (const provider of GET_PROVIDERS) {
    test(`GET /api/auth/${provider}/callback redirects to /?error=missing_params when code/state absent`, async () => {
      const res = await fetch(`${TEST_SERVER_URL}/api/auth/${provider}/callback`, {
        redirect: "manual",
      });
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/?error=missing_params");
    });

    test(`GET /api/auth/${provider}/callback redirects to /?error=invalid_state on CSRF mismatch`, async () => {
      const res = await fetch(
        `${TEST_SERVER_URL}/api/auth/${provider}/callback?code=abc&state=wrong-state`,
        {
          redirect: "manual",
          headers: { cookie: "oauth_state=correct-state" },
        }
      );
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/?error=invalid_state");
    });
  }

  test("POST /api/auth/apple/callback redirects to /?error=missing_params when code/state absent", async () => {
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/apple/callback`, {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams(),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/?error=missing_params");
  });

  test("POST /api/auth/apple/callback redirects to /?error=invalid_state on CSRF mismatch", async () => {
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/apple/callback`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: "oauth_state=correct-state" },
      body: new URLSearchParams({ code: "abc", state: "wrong-state" }),
    });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/?error=invalid_state");
  });

  test("GET /api/auth/x/callback redirects to /?error=invalid_state when x_code_verifier cookie is missing", async () => {
    const res = await fetch(
      `${TEST_SERVER_URL}/api/auth/x/callback?code=abc&state=matching-state`,
      {
        redirect: "manual",
        headers: { cookie: "oauth_state=matching-state" },
      }
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/?error=invalid_state");
  });
});

import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { loadFrontendEnv } from "../../helpers/loadEnv";

loadFrontendEnv();

const PROVIDER_ENV_VAR = {
  google: "GOOGLE_CLIENT_ID",
  apple: "APPLE_CLIENT_ID",
  x: "X_CLIENT_ID",
  linkedin: "LINKEDIN_CLIENT_ID",
} as const;
const PROVIDERS = Object.keys(PROVIDER_ENV_VAR) as (keyof typeof PROVIDER_ENV_VAR)[];

function setCookies(res: Response): string {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  return headers.getSetCookie ? headers.getSetCookie().join(";") : headers.get("set-cookie") ?? "";
}

beforeAll(async () => {
  await ensureDevServer();
}, 70000);

describe("OAuth initiate routes", () => {
  for (const provider of PROVIDERS) {
    const isConfigured = !!process.env[PROVIDER_ENV_VAR[provider]];
    const t = isConfigured ? test : test.skip;

    t(`GET /api/auth/${provider} redirects with an oauth_state cookie`, async () => {
      const res = await fetch(`${TEST_SERVER_URL}/api/auth/${provider}`, {
        redirect: "manual",
      });

      expect(res.status).toBe(307);
      const location = res.headers.get("location");
      expect(location).toBeTruthy();

      expect(setCookies(res)).toContain("oauth_state=");
    });
  }

  test("GET /api/auth/x also sets an x_code_verifier cookie (PKCE)", async () => {
    const res = await fetch(`${TEST_SERVER_URL}/api/auth/x`, { redirect: "manual" });
    expect(setCookies(res)).toContain("x_code_verifier=");
  });
});

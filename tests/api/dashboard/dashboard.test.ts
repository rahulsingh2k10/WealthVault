import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

beforeAll(async () => {
  await ensureDevServer();
}, 70000);

async function getDashboard(cookie: string) {
  return fetch(`${TEST_SERVER_URL}/dashboard`, {
    redirect: "manual",
    headers: cookie ? { cookie } : {},
  });
}

describe("GET /dashboard", () => {
  test("307 to / when there is no session cookie at all", async () => {
    const res = await getDashboard("");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/");
  });

  test("307 to /unlock when userId is present but encryptionKey is missing (vault locked)", async () => {
    const sealed = await sealSessionCookie({ userId: "does-not-need-to-exist" });
    const res = await getDashboard(`${SESSION_COOKIE_NAME}=${sealed}`);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/unlock");
  });

  test("200 when both userId and encryptionKey are present (vault unlocked)", async () => {
    const sealed = await sealSessionCookie({
      userId: "does-not-need-to-exist",
      encryptionKey: "fake-key-not-validated-by-this-route",
    });
    const res = await getDashboard(`${SESSION_COOKIE_NAME}=${sealed}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});

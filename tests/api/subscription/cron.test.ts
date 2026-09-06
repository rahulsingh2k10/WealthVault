import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

// The route calls finalizeExpiredCancellations(), which reaches for
// getProvider().cancelNow() — force the deterministic fake so this never
// hits the real Razorpay API.
process.env.PAYMENTS_PROVIDER = "fake";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("GET /api/cron/finalize-cancellations", () => {
  const originalSecret = process.env.CRON_SECRET;

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });

  test("CRON_SECRET set, no Authorization header → 401", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const { GET } = require("@/app/api/cron/finalize-cancellations/route");
    const res = await GET(new Request("http://localhost/api/cron/finalize-cancellations"));
    expect(res.status).toBe(401);
  });

  test("CRON_SECRET set, wrong Authorization header → 401", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const { GET } = require("@/app/api/cron/finalize-cancellations/route");
    const res = await GET(
      new Request("http://localhost/api/cron/finalize-cancellations", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
    );
    expect(res.status).toBe(401);
  });

  test("CRON_SECRET set, correct Authorization header → 200 with finalized count", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const { GET } = require("@/app/api/cron/finalize-cancellations/route");
    const res = await GET(
      new Request("http://localhost/api/cron/finalize-cancellations", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.finalized).toBe("number");
  });

  test("CRON_SECRET unset → runs without requiring a header (local/dev fallback)", async () => {
    delete process.env.CRON_SECRET;
    const { GET } = require("@/app/api/cron/finalize-cancellations/route");
    const res = await GET(new Request("http://localhost/api/cron/finalize-cancellations"));
    expect(res.status).toBe(200);
  });

  test("also resolves a due plan-change across users, not just cancel-at-cycle-end rows", async () => {
    delete process.env.CRON_SECRET;
    const user = await createTestUser();
    try {
      const prisma = getTestPrisma();
      const oldRow = await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "active" });
      await createSubscriptionRow(user.id, {
        tier: "QUARTERLY", status: "active", supersedesId: oldRow.id, startAt: new Date(Date.now() - 3600_000),
      });

      const { GET } = require("@/app/api/cron/finalize-cancellations/route");
      const res = await GET(new Request("http://localhost/api/cron/finalize-cancellations"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.upgraded).toBe(1);

      const oldAfter = await prisma.subscription.findUniqueOrThrow({ where: { id: oldRow.id } });
      expect(oldAfter.status).toBe("cancelled");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("leaves a stale first-time checkout (no supersedesId) alone — only an activation elsewhere cleans those up", async () => {
    delete process.env.CRON_SECRET;
    const user = await createTestUser();
    try {
      const prisma = getTestPrisma();
      const row = await createSubscriptionRow(user.id, {
        status: "created", createdAt: new Date(Date.now() - 2 * 3600_000),
      });

      const { GET } = require("@/app/api/cron/finalize-cancellations/route");
      const res = await GET(new Request("http://localhost/api/cron/finalize-cancellations"));
      expect(res.status).toBe(200);

      const after = await prisma.subscription.findUniqueOrThrow({ where: { id: row.id } });
      expect(after.status).toBe("created");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

import { randomUUID } from "crypto";
import { hasTestDb, getTestPrisma, disconnectTestPrisma } from "../helpers/testDb";
import { ensureReferenceData, getFreePlanId, getPlatformId } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) await ensureReferenceData();
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("users table", () => {
  test("physical column order matches the documented sequence", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'users' ORDER BY ordinal_position`
    );
    const columns = rows.map((r) => r.column_name);
    // db push appends new columns in diff-engine (alphabetical) order, not schema order
    expect(columns).toEqual([
      "id",
      "fullName",
      "username",
      "avatar",
      "auth_platformId",
      "subscriptionPlanId",
      "verifier",
      "createdAt",
      "updatedAt",
      "razorpayCustomerId",
    ]);
  });

  test("username is unique", async () => {
    const user = await createTestUser();
    try {
      const prisma = getTestPrisma();
      const [freePlanId, platformId] = await Promise.all([
        getFreePlanId(),
        getPlatformId("GOOGLE"),
      ]);
      await expect(
        prisma.user.create({
          data: {
            fullName: "Duplicate",
            username: user.username,
            auth_platformId: platformId,
            subscriptionPlanId: freePlanId,
          },
        })
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("auth_platformId must reference an existing auth_platforms row", async () => {
    const prisma = getTestPrisma();
    const freePlanId = await getFreePlanId();
    await expect(
      prisma.user.create({
        data: {
          fullName: "Bad FK",
          username: `bad-fk-${randomUUID()}@example.com`,
          auth_platformId: randomUUID(),
          subscriptionPlanId: freePlanId,
        },
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("subscriptionPlanId must reference an existing subscription_plans row", async () => {
    const prisma = getTestPrisma();
    const platformId = await getPlatformId("GOOGLE");
    await expect(
      prisma.user.create({
        data: {
          fullName: "Bad FK",
          username: `bad-fk-${randomUUID()}@example.com`,
          auth_platformId: platformId,
          subscriptionPlanId: randomUUID(),
        },
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("an auth_platforms row cannot be deleted while a user still references it (ON DELETE RESTRICT)", async () => {
    const user = await createTestUser({ platform: "LINKEDIN" });
    try {
      const prisma = getTestPrisma();
      const platformId = await getPlatformId("LINKEDIN");
      await expect(prisma.authPlatform.delete({ where: { id: platformId } })).rejects.toThrow();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("OAuth upsert shape", () => {
  test("upsert-by-username creates a new user with a FREE plan and no verifier", async () => {
    const prisma = getTestPrisma();
    const [freePlanId, platformId] = await Promise.all([
      getFreePlanId(),
      getPlatformId("GOOGLE"),
    ]);
    const username = `oauth-upsert-${randomUUID()}@example.com`;

    const user = await prisma.user.upsert({
      where: { username },
      update: { fullName: "Updated Name" },
      create: {
        fullName: "New Sign-in",
        username,
        auth_platformId: platformId,
        subscriptionPlanId: freePlanId,
      },
    });

    try {
      expect(user.subscriptionPlanId).toBe(freePlanId);
      expect(user.verifier).toBeNull();

      const again = await prisma.user.upsert({
        where: { username },
        update: { fullName: "Updated Name" },
        create: {
          fullName: "New Sign-in",
          username,
          auth_platformId: platformId,
          subscriptionPlanId: freePlanId,
        },
      });
      expect(again.id).toBe(user.id);
      expect(again.fullName).toBe("Updated Name");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

// The actual insert-only-on-change logging behavior is tested against the
// real logSubscriptionPlanHistoryIfChanged() service function, not
// reimplemented here — see subscription-plan-history-service.test.ts.

describeOrSkip("auth_platforms table", () => {
  test("physical column order matches the documented sequence", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'auth_platforms' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual(["id", "platform", "createdAt", "updatedAt"]);
  });

  test("platform is unique", async () => {
    const prisma = getTestPrisma();
    await expect(
      prisma.authPlatform.create({ data: { platform: "GOOGLE" } })
    ).rejects.toMatchObject({ code: "P2002" });
  });
});

describeOrSkip("subscription_plans table", () => {
  test("physical column order matches the documented sequence", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'subscription_plans' ORDER BY ordinal_position`
    );
    // db push appends new columns in diff-engine (alphabetical) order, not schema order
    expect(rows.map((r) => r.column_name)).toEqual([
      "id",
      "tier",
      "price",
      "offerPrice",
      "currency",
      "offerStartDate",
      "offerEndDate",
      "isActive",
      "createdAt",
      "updatedAt",
      "intervalMonths",
      "razorpayPlanId",
      "termMonths",
    ]);
  });

  test("tier is unique", async () => {
    const prisma = getTestPrisma();
    await expect(
      prisma.subscriptionPlan.create({ data: { tier: "FREE", price: 0 } })
    ).rejects.toMatchObject({ code: "P2002" });
  });

  test("a subscription_plans row cannot be deleted while a user still references it (ON DELETE RESTRICT)", async () => {
    const user = await createTestUser();
    try {
      const prisma = getTestPrisma();
      const freePlanId = await getFreePlanId();
      await expect(prisma.subscriptionPlan.delete({ where: { id: freePlanId } })).rejects.toThrow();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("subscription_plan_history table", () => {
  test("physical column order matches the documented sequence", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'subscription_plan_history' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      "id",
      "userId",
      "subscriptionPlanId",
      "createdAt",
    ]);
  });

  test("userId must reference an existing users row", async () => {
    const prisma = getTestPrisma();
    const freePlanId = await getFreePlanId();
    await expect(
      prisma.subscriptionPlanHistory.create({
        data: { userId: randomUUID(), subscriptionPlanId: freePlanId },
      })
    ).rejects.toMatchObject({ code: "P2003" });
  });

  test("subscriptionPlanId must reference an existing subscription_plans row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      await expect(
        prisma.subscriptionPlanHistory.create({
          data: { userId: user.id, subscriptionPlanId: randomUUID() },
        })
      ).rejects.toMatchObject({ code: "P2003" });
    } finally {
      await deleteTestUser(user.id);
    }
  });
});

describeOrSkip("ON UPDATE CASCADE", () => {
  test("updating an auth_platforms row's id cascades to users.auth_platformId", async () => {
    const prisma = getTestPrisma();
    const originalId = await getPlatformId("LINKEDIN");
    const user = await createTestUser({ platform: "LINKEDIN" });
    const tempId = randomUUID();
    try {
      await prisma.authPlatform.update({ where: { id: originalId }, data: { id: tempId } });

      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updatedUser.auth_platformId).toBe(tempId);
    } finally {
      // Revert first so the seeded reference row's id is restored regardless
      // of whether the assertion above passed or failed.
      await prisma.authPlatform.update({ where: { id: tempId }, data: { id: originalId } });
      await deleteTestUser(user.id);
    }
  });

  test("updating a subscription_plans row's id cascades to users.subscriptionPlanId", async () => {
    const prisma = getTestPrisma();
    const originalId = await getFreePlanId();
    const user = await createTestUser();
    const tempId = randomUUID();
    try {
      await prisma.subscriptionPlan.update({ where: { id: originalId }, data: { id: tempId } });

      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updatedUser.subscriptionPlanId).toBe(tempId);
    } finally {
      await prisma.subscriptionPlan.update({ where: { id: tempId }, data: { id: originalId } });
      await deleteTestUser(user.id);
    }
  });
});

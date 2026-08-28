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

describeOrSkip("subscription_periods logging", () => {
  test("a row is inserted only when the user's plan changes from the most recent logged row", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      const freePlanId = await getFreePlanId();

      await prisma.subscriptionPeriod.create({
        data: { userId: user.id, subscriptionPlanId: freePlanId },
      });

      const countAfterFirst = await prisma.subscriptionPeriod.count({ where: { userId: user.id } });
      expect(countAfterFirst).toBe(1);

      const mostRecent = await prisma.subscriptionPeriod.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
      });
      expect(mostRecent?.subscriptionPlanId).toBe(freePlanId);
    } finally {
      await prisma.subscriptionPeriod.deleteMany({ where: { userId: user.id } });
      await deleteTestUser(user.id);
    }
  });
});

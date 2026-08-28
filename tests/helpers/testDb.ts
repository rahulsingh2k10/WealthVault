// Reuses frontend's own generated Prisma Client artifact — a client is
// generated 1:1 from a schema.prisma, so this is unavoidable coupling to the
// actual app being tested, not to frontend's test tooling. Regenerating a
// second copy from this project resolves to the exact same location anyway
// (Prisma places generated code next to the @prisma/client package nearest
// the schema.prisma file, i.e. frontend/node_modules).
import { PrismaClient } from "../../frontend/node_modules/@prisma/client";
import { loadFrontendEnv } from "./loadEnv";

loadFrontendEnv();

let client: PrismaClient | undefined;

export function hasTestDb(): boolean {
  return !!process.env.TEST_DATABASE_URL;
}

export function getTestPrisma(): PrismaClient {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      "TEST_DATABASE_URL is not set in frontend/.env — required to run this suite."
    );
  }
  if (!client) {
    client = new PrismaClient({
      datasources: { db: { url: process.env.TEST_DATABASE_URL } },
    });
  }
  return client;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (client) {
    await client.$disconnect();
    client = undefined;
  }
}

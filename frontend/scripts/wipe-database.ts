/**
 * Wipes all user-generated data — users, subscriptions, plan history,
 * processed webhook events, user preferences — from one or both Railway
 * databases. Cancels every non-terminal Razorpay subscription first, since
 * Razorpay has no delete API and an orphaned local-DB row would otherwise
 * leave a subscription running on their side forever.
 *
 * subscription_plans and auth_platforms are NEVER touched — the app depends
 * on them to function (this is exactly the bug that broke login after a
 * manual TRUNCATE once already), so there's nothing to reseed for those.
 *
 * nav_config (sidebar config) is preserved by default too, but — unlike the
 * two above — it's safe to wipe (GET /api/nav just returns [] when empty,
 * nothing throws), so pass --include-nav-config to also clear it. Reseed
 * afterward with `npm run db:seed-nav`.
 *
 * --env=testing/production/both requires PRODUCTION_DATABASE_URL and/or
 * TESTING_DATABASE_URL in the environment (or frontend/.env, gitignored) —
 * never hardcode a connection string here. --env=current instead uses
 * whatever DATABASE_URL is already loaded from frontend/.env, no extra
 * setup required — this replaces the old scripts/reset-test-data.ts for
 * "just reset whatever DB my local dev is pointed at right now".
 *
 * Without --yes, this only PREVIEWS row counts — nothing is deleted.
 * Targeting production also requires --confirm-production, in addition to
 * --yes, as a second deliberate step.
 *
 * Usage:
 *   npx tsx scripts/wipe-database.ts --env=current --yes
 *   npx tsx scripts/wipe-database.ts --env=testing --yes
 *   npx tsx scripts/wipe-database.ts --env=production --yes --confirm-production
 *   npx tsx scripts/wipe-database.ts --env=both --yes --confirm-production
 *   npx tsx scripts/wipe-database.ts --env=testing --yes --include-nav-config
 */
import fs from "node:fs";
import path from "node:path";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    const value = rawValue.trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    process.env[key] = value;
  }
}
loadEnvFile(path.join(__dirname, "..", ".env"));

const NON_TERMINAL_STATUSES = ["created", "authenticated", "active", "pending", "halted", "paused"];

type Target = "production" | "testing" | "current";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="))?.split("=")[1];
const doIt = args.includes("--yes");
const confirmedProduction = args.includes("--confirm-production");
const includeNavConfig = args.includes("--include-nav-config");

if (!envArg || !["current", "testing", "production", "both"].includes(envArg)) {
  console.error("Usage: npx tsx scripts/wipe-database.ts --env=current|testing|production|both [--yes] [--confirm-production]");
  process.exit(1);
}

const targets: Target[] = envArg === "both" ? ["production", "testing"] : [envArg as Target];

const DIVIDER = "─".repeat(56);

function printRows(rows: Record<string, number>) {
  const width = Math.max(...Object.keys(rows).map((k) => k.length));
  for (const [key, value] of Object.entries(rows)) {
    console.log(`  ${key.padEnd(width)} : ${value}`);
  }
}

async function deleteTable(tableName: string, fn: () => Promise<{ count: number }>) {
  console.log(`  → Deleting ${tableName}...`);
  const result = await fn();
  const noun = result.count === 1 ? "row" : "rows";
  console.log(`    ✓ ${tableName} deleted (${result.count} ${noun})`);
  return result;
}

if (targets.includes("production") && doIt && !confirmedProduction) {
  console.error("Refusing: targeting production requires --confirm-production in addition to --yes.");
  process.exit(1);
}

async function runTarget(target: Target) {
  if (target === "current") {
    if (!process.env.DATABASE_URL) {
      console.error("Missing DATABASE_URL — set it in frontend/.env.");
      process.exit(1);
    }
    // Already loaded from .env — nothing to override.
  } else {
    const urlVar = target === "production" ? "PRODUCTION_DATABASE_URL" : "TESTING_DATABASE_URL";
    const url = process.env[urlVar];
    if (!url) {
      console.error(`Missing ${urlVar} — set it in the environment or frontend/.env.`);
      process.exit(1);
    }
    process.env.DATABASE_URL = url;
  }

  // Re-require so Prisma picks up the DATABASE_URL just set for this target.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  const host = new URL(process.env.DATABASE_URL!).host;
  console.log(`\n${DIVIDER}`);
  console.log(`  Environment : ${target.toUpperCase()}`);
  console.log(`  Host        : ${host}`);
  console.log(DIVIDER);
  try {
    const counts: Record<string, number> = {
      user_preference: await prisma.userPreference.count(),
      processed_webhook_events: await prisma.processedWebhookEvent.count(),
      subscription_plan_history: await prisma.subscriptionPlanHistory.count(),
      subscriptions: await prisma.subscription.count(),
      users: await prisma.user.count(),
      ...(includeNavConfig ? { nav_config: await prisma.navConfig.count() } : {}),
    };
    console.log("\nRow counts (before):");
    printRows(counts);

    if (!doIt) {
      console.log("\n(dry run — pass --yes to actually delete)");
      return;
    }

    const { RazorpayProvider } = await import("../src/lib/payments/razorpay");
    const provider = new RazorpayProvider();
    const subs = await prisma.subscription.findMany({
      where: { status: { in: NON_TERMINAL_STATUSES } },
      select: { providerSubscriptionId: true, status: true },
    });
    if (subs.length > 0) {
      console.log(`\nCancelling ${subs.length} non-terminal Razorpay subscription(s):`);
      for (const sub of subs) {
        try {
          await provider.cancelNow(sub.providerSubscriptionId);
          console.log(`  ✓ Cancelled ${sub.providerSubscriptionId} (was ${sub.status})`);
        } catch (err) {
          console.log(`  ✗ Could not cancel ${sub.providerSubscriptionId}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    console.log("\nDeleting rows:");
    const userPreferences = await deleteTable("user_preference", () => prisma.userPreference.deleteMany({}));
    const processedWebhookEvents = await deleteTable("processed_webhook_events", () => prisma.processedWebhookEvent.deleteMany({}));
    const planHistory = await deleteTable("subscription_plan_history", () => prisma.subscriptionPlanHistory.deleteMany({}));
    const subscriptions = await deleteTable("subscriptions", () => prisma.subscription.deleteMany({}));
    const users = await deleteTable("users", () => prisma.user.deleteMany({}));
    const navConfig = includeNavConfig
      ? await deleteTable("nav_config", () => prisma.navConfig.deleteMany({}))
      : null;

    console.log("\nDeleted:");
    printRows({
      user_preference: userPreferences.count,
      processed_webhook_events: processedWebhookEvents.count,
      subscription_plan_history: planHistory.count,
      subscriptions: subscriptions.count,
      users: users.count,
      ...(navConfig ? { nav_config: navConfig.count } : {}),
    });

    console.log("\nPreserved (untouched):");
    printRows({
      subscription_plans: await prisma.subscriptionPlan.count(),
      auth_platforms: await prisma.authPlatform.count(),
      ...(includeNavConfig ? {} : { nav_config: await prisma.navConfig.count() }),
    });

    if (includeNavConfig) {
      console.log("\nnav_config was wiped too — reseed with: npm run db:seed-nav");
    }
    console.log(DIVIDER);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  for (const target of targets) {
    await runTarget(target);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

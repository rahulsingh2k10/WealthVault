/**
 * Wipes all user-generated data — users, subscriptions, plan history,
 * processed webhook events, user preferences — from one or both Railway
 * databases. Cancels every non-terminal Razorpay subscription first, since
 * Razorpay has no delete API and an orphaned local-DB row would otherwise
 * leave a subscription running on their side forever.
 *
 * Reference tables (subscription_plans, auth_platforms, nav_config) are
 * NEVER touched — the app depends on them to function (this is exactly the
 * bug that broke login after a manual TRUNCATE once already), so there's
 * nothing to reseed afterward.
 *
 * Requires PRODUCTION_DATABASE_URL and/or TESTING_DATABASE_URL in the
 * environment (or frontend/.env, which is gitignored) — never hardcode a
 * connection string here.
 *
 * Without --yes, this only PREVIEWS row counts — nothing is deleted.
 * Targeting production also requires --confirm-production, in addition to
 * --yes, as a second deliberate step.
 *
 * Usage:
 *   npx tsx scripts/wipe-database.ts --env=testing --yes
 *   npx tsx scripts/wipe-database.ts --env=production --yes --confirm-production
 *   npx tsx scripts/wipe-database.ts --env=both --yes --confirm-production
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

type Target = "production" | "testing";

const args = process.argv.slice(2);
const envArg = args.find((a) => a.startsWith("--env="))?.split("=")[1];
const doIt = args.includes("--yes");
const confirmedProduction = args.includes("--confirm-production");

if (!envArg || !["testing", "production", "both"].includes(envArg)) {
  console.error("Usage: npx tsx scripts/wipe-database.ts --env=testing|production|both [--yes] [--confirm-production]");
  process.exit(1);
}

const targets: Target[] = envArg === "both" ? ["production", "testing"] : [envArg as Target];

if (targets.includes("production") && doIt && !confirmedProduction) {
  console.error("Refusing: targeting production requires --confirm-production in addition to --yes.");
  process.exit(1);
}

async function runTarget(target: Target) {
  const urlVar = target === "production" ? "PRODUCTION_DATABASE_URL" : "TESTING_DATABASE_URL";
  const url = process.env[urlVar];
  if (!url) {
    console.error(`Missing ${urlVar} — set it in the environment or frontend/.env.`);
    process.exit(1);
  }
  process.env.DATABASE_URL = url;

  // Re-require so Prisma picks up the DATABASE_URL just set for this target.
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();

  console.log(`\n=== ${target.toUpperCase()} ===`);
  try {
    const counts = {
      users: await prisma.user.count(),
      subscriptions: await prisma.subscription.count(),
      subscriptionPlanHistory: await prisma.subscriptionPlanHistory.count(),
      processedWebhookEvents: await prisma.processedWebhookEvent.count(),
      userPreferences: await prisma.userPreference.count(),
    };
    console.log("Current row counts:", JSON.stringify(counts));

    if (!doIt) {
      console.log("(dry run — pass --yes to actually delete)");
      return;
    }

    const { RazorpayProvider } = await import("../src/lib/payments/razorpay");
    const provider = new RazorpayProvider();
    const subs = await prisma.subscription.findMany({
      where: { status: { in: NON_TERMINAL_STATUSES } },
      select: { providerSubscriptionId: true, status: true },
    });
    for (const sub of subs) {
      try {
        await provider.cancelNow(sub.providerSubscriptionId);
        console.log(`Cancelled Razorpay subscription ${sub.providerSubscriptionId} (was ${sub.status})`);
      } catch (err) {
        console.warn(`Could not cancel ${sub.providerSubscriptionId}:`, err instanceof Error ? err.message : err);
      }
    }

    const userPreferences = await prisma.userPreference.deleteMany({});
    const processedWebhookEvents = await prisma.processedWebhookEvent.deleteMany({});
    const planHistory = await prisma.subscriptionPlanHistory.deleteMany({});
    const subscriptions = await prisma.subscription.deleteMany({});
    const users = await prisma.user.deleteMany({});

    console.log("Deleted ->", JSON.stringify({
      userPreferences: userPreferences.count,
      processedWebhookEvents: processedWebhookEvents.count,
      planHistory: planHistory.count,
      subscriptions: subscriptions.count,
      users: users.count,
    }));

    const preserved = {
      subscriptionPlans: await prisma.subscriptionPlan.count(),
      authPlatforms: await prisma.authPlatform.count(),
      navConfig: await prisma.navConfig.count(),
    };
    console.log("Preserved (untouched) ->", JSON.stringify(preserved));
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

/**
 * Cancels every non-terminal Razorpay subscription found in the DB, then
 * deletes all rows except the prerequisite reference tables (subscription
 * plans, auth platforms). Razorpay has no delete API for subscriptions —
 * cancel is terminal and cancelled/completed/expired records stay on their
 * side permanently, so there is nothing further to clean up there.
 *
 * Usage: npm run db:reset-test
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

const NON_TERMINAL_STATUSES = ["created", "authenticated", "active", "pending", "halted"];

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const { RazorpayProvider } = await import("../src/lib/payments/razorpay");

  const prisma = new PrismaClient();
  const provider = new RazorpayProvider();

  try {
    const subs = await prisma.subscription.findMany({
      where: { status: { in: NON_TERMINAL_STATUSES } },
      select: { providerSubscriptionId: true, status: true },
    });

    for (const sub of subs) {
      try {
        await provider.cancelNow(sub.providerSubscriptionId);
        console.log(`Cancelled ${sub.providerSubscriptionId} (was ${sub.status})`);
      } catch (err) {
        console.warn(`Could not cancel ${sub.providerSubscriptionId}:`, err instanceof Error ? err.message : err);
      }
    }

    const webhookEvents = await prisma.processedWebhookEvent.deleteMany({});
    const planHistory = await prisma.subscriptionPlanHistory.deleteMany({});
    const subscriptions = await prisma.subscription.deleteMany({});
    const users = await prisma.user.deleteMany({});

    console.log("Deleted ->", {
      webhookEvents: webhookEvents.count,
      planHistory: planHistory.count,
      subscriptions: subscriptions.count,
      users: users.count,
    });

    const plans = await prisma.subscriptionPlan.count();
    const platforms = await prisma.authPlatform.count();
    console.log("Preserved ->", { plans, platforms });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

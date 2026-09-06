import { prisma } from '@/lib/prisma'

// Logs a new subscription_plan_history row only when the user's plan differs
// from the one their most recent row recorded — never updates existing rows.
// The very first login for a user (no rows yet) always logs one.
//
// Two callers can race this for the same user — e.g. two Razorpay webhook
// deliveries (authenticated, then activated) landing close together both
// reconcile the same tier change. Without serialization, both can read the
// same stale "latest" row before either has inserted, and both then insert,
// producing a duplicate. A per-user Postgres advisory lock, held for the
// duration of the transaction, makes the read-then-insert atomic across
// concurrent callers without needing a schema-level uniqueness constraint
// (revisiting an earlier plan later is legitimate and must still insert).
export async function logSubscriptionPlanHistoryIfChanged(userId: string, subscriptionPlanId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`

    const latest = await tx.subscriptionPlanHistory.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    if (!latest || latest.subscriptionPlanId !== subscriptionPlanId) {
      await tx.subscriptionPlanHistory.create({
        data: { userId, subscriptionPlanId },
      })
    }
  })
}

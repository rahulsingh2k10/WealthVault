import { prisma } from '@/lib/prisma'

// Logs a new subscription_plan_history row only when the user's plan differs
// from the one their most recent row recorded — never updates existing rows.
// The very first login for a user (no rows yet) always logs one.
export async function logSubscriptionPlanHistoryIfChanged(userId: string, subscriptionPlanId: string): Promise<void> {
  const latest = await prisma.subscriptionPlanHistory.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })

  if (!latest || latest.subscriptionPlanId !== subscriptionPlanId) {
    await prisma.subscriptionPlanHistory.create({
      data: { userId, subscriptionPlanId },
    })
  }
}

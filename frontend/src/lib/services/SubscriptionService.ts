import { prisma } from "@/lib/prisma";
import { logSubscriptionPeriodIfChanged } from "@/lib/services/SubscriptionPeriodService";
import type { Subscription } from "@prisma/client";

export function totalCountFor(p: { termMonths: number | null; intervalMonths: number | null }): number {
  if (!p.termMonths || !p.intervalMonths) throw new Error("plan is missing termMonths/intervalMonths");
  return Math.round(p.termMonths / p.intervalMonths);
}

const GRANTS_UNCONDITIONALLY = new Set(["active", "authenticated", "pending"]);
const GRANTS_UNTIL_END = new Set(["cancelled", "completed"]);

function grants(row: Subscription, now: Date): boolean {
  if (row.startAt && now < row.startAt) return false; // scheduled (plan-change) row hasn't started yet
  if (GRANTS_UNCONDITIONALLY.has(row.status)) return true;
  if (GRANTS_UNTIL_END.has(row.status)) return !!row.currentEnd && now < row.currentEnd;
  return false;
}

export interface EffectivePlan {
  tier: string;
  subscriptionPlanId: string;
  currentEnd: Date | null;
  paymentRetrying: boolean;
}

export async function getEffectivePlan(userId: string): Promise<EffectivePlan> {
  const now = new Date();
  const [rows, freePlan, user] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { subscriptionPlan: true },
    }),
    prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { subscriptionPlanId: true } }),
  ]);

  const granting = rows.filter((r) => grants(r, now));
  // prefer the one whose access extends furthest (or an always-granting row)
  const chosen =
    granting.sort((a, b) => {
      const ae = a.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(a.status) ? Infinity : 0);
      const be = b.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(b.status) ? Infinity : 0);
      return be - ae;
    })[0] ?? null;

  const effective: EffectivePlan = chosen
    ? {
        tier: chosen.subscriptionPlan.tier,
        subscriptionPlanId: chosen.subscriptionPlanId,
        currentEnd: chosen.currentEnd,
        paymentRetrying: granting.some((r) => r.status === "pending"),
      }
    : { tier: "FREE", subscriptionPlanId: freePlan.id, currentEnd: null, paymentRetrying: false };

  // lazy reconciliation of the denormalised User.subscriptionPlanId cache
  if (user && user.subscriptionPlanId !== effective.subscriptionPlanId) {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionPlanId: effective.subscriptionPlanId } });
    await logSubscriptionPeriodIfChanged(userId, effective.subscriptionPlanId);
  }

  return effective;
}

import { prisma } from "@/lib/prisma";
import { logSubscriptionPeriodIfChanged } from "@/lib/services/SubscriptionPeriodService";
import type { Subscription } from "@prisma/client";

export function totalCountFor(p: { termMonths: number | null; intervalMonths: number | null }): number {
  if (!p.termMonths || !p.intervalMonths) throw new Error("plan is missing termMonths/intervalMonths");
  return Math.round(p.termMonths / p.intervalMonths);
}

const GRANTS_ALWAYS = new Set(["active", "authenticated"]);
const GRANTS_UNTIL_END = new Set(["cancelled", "completed"]);

function grants(row: Subscription, now: Date): boolean {
  if (GRANTS_ALWAYS.has(row.status)) return true;
  if (row.status === "pending") return true;
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
  const [rows, freePlan] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { subscriptionPlan: true },
    }),
    prisma.subscriptionPlan.findFirstOrThrow({ where: { tier: "FREE" } }),
  ]);

  const granting = rows.filter((r) => grants(r, now));
  // prefer the one whose access extends furthest (or an always-granting row)
  const chosen =
    granting.sort((a, b) => {
      const ae = a.currentEnd?.getTime() ?? (GRANTS_ALWAYS.has(a.status) ? Infinity : 0);
      const be = b.currentEnd?.getTime() ?? (GRANTS_ALWAYS.has(b.status) ? Infinity : 0);
      return be - ae;
    })[0] ?? null;

  const effective: EffectivePlan = chosen
    ? {
        tier: chosen.subscriptionPlan.tier,
        subscriptionPlanId: chosen.subscriptionPlanId,
        currentEnd: chosen.currentEnd,
        paymentRetrying: rows.some((r) => r.status === "pending"),
      }
    : { tier: "FREE", subscriptionPlanId: freePlan.id, currentEnd: null, paymentRetrying: false };

  // lazy reconciliation of the denormalised User.subscriptionPlanId cache
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { subscriptionPlanId: true } });
  if (user && user.subscriptionPlanId !== effective.subscriptionPlanId) {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionPlanId: effective.subscriptionPlanId } });
    await logSubscriptionPeriodIfChanged(userId, effective.subscriptionPlanId);
  }

  return effective;
}

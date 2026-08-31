import { prisma } from "@/lib/prisma";
import { logSubscriptionPeriodIfChanged } from "@/lib/services/SubscriptionPeriodService";
import { formatMoney } from "@/lib/utils";
import type { Subscription } from "@prisma/client";
import type { NormalizedWebhookEvent } from "@/lib/payments/types";

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

function chooseGrantingRow<T extends Subscription>(rows: T[], now: Date): T | null {
  const granting = rows.filter((r) => grants(r, now));
  return (
    granting.sort((a, b) => {
      const ae = a.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(a.status) ? Infinity : 0);
      const be = b.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(b.status) ? Infinity : 0);
      return be - ae;
    })[0] ?? null
  );
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
  const chosen = chooseGrantingRow(rows, now);

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

const TERMINAL = new Set(["halted", "completed", "expired"]);

export async function applySubscriptionEvent(evt: NormalizedWebhookEvent): Promise<void> {
  if (evt.kind === "ignored") return;

  const row = await prisma.subscription.findUnique({ where: { providerSubscriptionId: evt.providerSubscriptionId } });
  if (!row) {
    console.warn("[subscription] webhook for unknown subscription", evt.providerSubscriptionId);
    return;
  }

  // A subscription that has already reached a terminal state (halted/completed/
  // expired, with endedAt set) must not be resurrected by a late or out-of-order
  // non-terminal event.
  if (TERMINAL.has(row.status) && row.endedAt && !TERMINAL.has(evt.status)) {
    console.warn("[subscription] ignoring non-terminal webhook for an ended subscription", evt.providerSubscriptionId, evt.status);
    return;
  }

  await prisma.subscription.update({
    where: { id: row.id },
    data: {
      status: evt.status || row.status,
      paidCount: evt.paidCount ?? row.paidCount,
      currentStart: evt.currentStart ?? row.currentStart,
      currentEnd: evt.currentEnd ?? row.currentEnd,
      chargeAt: evt.chargeAt ?? row.chargeAt,
      cancelAtCycleEnd: evt.cancelAtCycleEnd ?? row.cancelAtCycleEnd,
      endedAt: TERMINAL.has(evt.status) ? new Date() : row.endedAt,
    },
  });

  // recompute + reconcile the user's effective tier across ALL their rows
  await getEffectivePlan(row.userId);
}

export async function buildManageView(userId: string) {
  const eff = await getEffectivePlan(userId);
  const rows = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { subscriptionPlan: true },
  });
  const active = chooseGrantingRow(rows, new Date());

  if (!active) return { tier: "FREE" as const };

  const now = new Date();
  const scheduled = rows.find(
    (r) =>
      r.supersedesId === active.id &&
      !!r.startAt && r.startAt > now &&
      ["created", "authenticated", "active"].includes(r.status),
  );

  const p = active.subscriptionPlan;
  const intervalLabel = p.intervalMonths === 1 ? "month" : p.intervalMonths === 3 ? "quarter" : "year";
  const lockedThrough = new Date(active.createdAt);
  if (p.termMonths) lockedThrough.setMonth(lockedThrough.getMonth() + p.termMonths);

  return {
    tier: p.tier,
    planName: { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }[p.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL"],
    status: active.status,
    amountPerCycle: formatMoney(Math.round(active.amount / 100), active.currency),
    intervalLabel,
    nextChargeAt: active.chargeAt?.toISOString() ?? null,
    currentEnd: active.currentEnd?.toISOString() ?? null,
    priceLockedThrough: lockedThrough.toISOString(),
    cancelAtCycleEnd: active.cancelAtCycleEnd,
    paymentRetrying: eff.paymentRetrying,
    retryUrl: eff.paymentRetrying ? (active.providerData as { shortUrl?: string } | null)?.shortUrl ?? null : null,
    scheduledChange: scheduled
      ? {
          planName: { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }[
            scheduled.subscriptionPlan.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL"
          ],
          startsAt: scheduled.startAt!.toISOString(),
          amountPerCycle: formatMoney(Math.round(scheduled.amount / 100), scheduled.currency),
        }
      : null,
  };
}

const PLAN_NAME: Record<string, string> = { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" };

export interface PaidPlanOption {
  tier: string;
  name: string;
  perMonth: string;
  perCycle: string;
}

/** Paid plans for the "Change plan" picker on the Manage Subscription screen. */
export async function listPaidPlansForChange(): Promise<PaidPlanOption[]> {
  const rows = await prisma.subscriptionPlan.findMany({
    where: { isActive: true, tier: { not: "FREE" } },
    orderBy: { tier: "asc" },
  });

  return rows.map((p) => {
    const amount = Number(p.offerPrice ?? p.price);
    return {
      tier: p.tier,
      name: PLAN_NAME[p.tier] ?? p.tier,
      perMonth: formatMoney(Math.round(amount / (p.intervalMonths ?? 1)), p.currency),
      perCycle: formatMoney(amount, p.currency),
    };
  });
}

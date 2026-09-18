import { prisma } from "@/lib/prisma";
import { logSubscriptionPlanHistoryIfChanged } from "@/lib/services/SubscriptionPlanHistoryService";
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
  // Cancelled-at-cycle-end (Razorpay subscription is paused): grant only through
  // the cycle the user already paid for, then drop to FREE.
  if (row.cancelAtCycleEnd) return !!row.currentEnd && now < row.currentEnd;
  if (GRANTS_UNCONDITIONALLY.has(row.status)) return true;
  if (GRANTS_UNTIL_END.has(row.status)) return !!row.currentEnd && now < row.currentEnd;
  return false;
}

// A cancel-at-cycle-end subscription is only *paused* on the provider at
// cancel time (see /api/subscription/cancel) — access already stops once
// currentEnd passes (grants() below), but the provider-side object would
// otherwise sit paused forever. Once the paid-through window has actually
// elapsed, finish the job: fully cancel it on the provider too.
async function finalizeExpiredCancellationRows(rows: Subscription[], now: Date): Promise<void> {
  const expired = rows.filter((r) => r.cancelAtCycleEnd && !r.endedAt && r.currentEnd && now >= r.currentEnd);
  for (const row of expired) {
    try {
      const { getProvider } = await import("@/lib/payments");
      await getProvider().cancelNow(row.providerSubscriptionId);
    } catch (e) {
      // Don't mark this cancelled locally without confirming it on Razorpay —
      // that would leave our DB claiming a state Razorpay never actually
      // reached. Leave the row exactly as it is; it still matches this
      // function's own filter (cancelAtCycleEnd, no endedAt, past currentEnd),
      // so the next call — next login, or the daily cron — retries it.
      console.error("[subscription] failed to finalize an expired cancellation — left open for retry", row.providerSubscriptionId, e);
      continue;
    }
    await prisma.subscription.update({
      where: { id: row.id },
      data: { status: "cancelled", endedAt: now },
    });
  }
}

/**
 * Global sweep for the daily cron (see /api/cron/finalize-cancellations):
 * finalizes every cancel-at-cycle-end subscription across all users whose
 * paid-through window has elapsed, then reconciles each affected user's
 * cached tier — so neither step waits for that user's next request.
 */
export async function finalizeExpiredCancellations(): Promise<{ finalized: number }> {
  const now = new Date();
  const rows = await prisma.subscription.findMany({
    where: { cancelAtCycleEnd: true, endedAt: null, currentEnd: { lte: now } },
  });
  await finalizeExpiredCancellationRows(rows, now);

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  for (const userId of userIds) {
    await getEffectivePlan(userId);
  }

  return { finalized: rows.length };
}

// Claims a row atomically before acting on it — the login-triggered check and
// the midnight cron can both reach the same overdue row within the same
// second. Whichever caller's updateMany actually flips endedAt (count === 1)
// is the only one that goes on to call Razorpay; the other sees count === 0
// and does nothing. This is what makes the two triggers safe to run concurrently.
async function claimRow(id: string, status: string): Promise<boolean> {
  const claim = await prisma.subscription.updateMany({
    where: { id, endedAt: null },
    data: { status, endedAt: new Date() },
  });
  return claim.count === 1;
}

/**
 * Resolves every superseding (plan-change) subscription whose startAt has
 * arrived — called from /api/auth/unlock (userId scoped, on login) and the
 * daily cron (global sweep, see /api/cron/finalize-cancellations). A row
 * still `authenticated` or `pending` past its startAt may still resolve on
 * a later Razorpay retry, so it's left alone rather than guessed at.
 */
export async function reconcileSupersedingSubscriptions(
  opts: { userId?: string } = {},
): Promise<{ upgraded: number; rolledBack: number }> {
  const now = new Date();
  const provider = await getProviderLazy();

  // Not `endedAt: null` — applySubscriptionEvent sets endedAt on ANY row the
  // instant a terminal webhook (halted/completed/expired) arrives, before
  // reconciliation ever runs. Filtering on endedAt here would silently hide
  // exactly the halted rows the rollback branch below exists to catch.
  // Excluding the fully-resolved statuses instead keeps this query bounded
  // without depending on a field a webhook can set first.
  const due = await prisma.subscription.findMany({
    where: {
      ...(opts.userId ? { userId: opts.userId } : {}),
      supersedesId: { not: null },
      status: { in: ["active", "created", "authenticated", "pending", "halted"] },
      startAt: { lte: now },
    },
  });

  let upgraded = 0;
  let rolledBack = 0;
  const affectedUserIds = new Set<string>();

  for (const row of due) {
    if (row.status === "active") {
      const superseded = await prisma.subscription.findUnique({ where: { id: row.supersedesId! } });
      if (!superseded || superseded.endedAt) continue;
      if (!(await claimRow(superseded.id, "cancelled"))) continue;
      try {
        await provider.cancelNow(superseded.providerSubscriptionId);
      } catch (e) {
        console.error("[subscription] reconcile: failed to cancel superseded", superseded.providerSubscriptionId, e);
      }
      upgraded++;
      affectedUserIds.add(row.userId);
    } else if (row.status === "created" || row.status === "halted") {
      // A halted row may already have endedAt set by applySubscriptionEvent
      // itself — claim on status instead, which is still exactly-once (this
      // update's own WHERE excludes it the moment status flips to "cancelled").
      const claim = await prisma.subscription.updateMany({
        where: { id: row.id, status: { in: ["created", "halted"] } },
        data: { status: "cancelled", endedAt: new Date() },
      });
      if (claim.count !== 1) continue;
      try {
        await provider.cancelNow(row.providerSubscriptionId);
      } catch (e) {
        console.error("[subscription] reconcile: failed to cancel dead superseding row", row.providerSubscriptionId, e);
      }
      const superseded = await prisma.subscription.findUnique({ where: { id: row.supersedesId! } });
      if (superseded && !superseded.endedAt) {
        try {
          await provider.resumeSubscription(superseded.providerSubscriptionId);
        } catch (e) {
          console.error("[subscription] reconcile: failed to resume superseded", superseded.providerSubscriptionId, e);
        }
      }
      rolledBack++;
      affectedUserIds.add(row.userId);
    }
    // "authenticated" / "pending" — still live, Razorpay may yet resolve it. Skip.
  }

  for (const userId of Array.from(affectedUserIds)) {
    await getEffectivePlan(userId);
  }

  return { upgraded, rolledBack };
}

async function getProviderLazy() {
  const { getProvider } = await import("@/lib/payments");
  return getProvider();
}

/**
 * Cancels a still-"created" subscription the caller owns, right when they
 * walk away from checkout (dismiss the Razorpay modal) — instead of waiting
 * for the next cron sweep or login. If it was superseding an existing plan
 * (change-plan pauses that plan up front, see change-plan/route.ts), resumes
 * it so billing isn't left paused until reconciliation would otherwise catch
 * this. A row not owned by the caller, or already past "created", is a
 * silent no-op — the caller can't tell the difference from a race it lost.
 */
export async function abandonCreatedSubscription(opts: {
  userId: string;
  providerSubscriptionId: string;
}): Promise<{ cancelled: boolean }> {
  const claim = await prisma.subscription.updateMany({
    where: { userId: opts.userId, providerSubscriptionId: opts.providerSubscriptionId, status: "created" },
    data: { status: "cancelled", endedAt: new Date() },
  });
  if (claim.count !== 1) return { cancelled: false };

  const provider = await getProviderLazy();
  try {
    await provider.cancelNow(opts.providerSubscriptionId);
  } catch (e) {
    console.error("[subscription] abandon: failed to cancel on provider", opts.providerSubscriptionId, e);
  }

  const row = await prisma.subscription.findFirst({
    where: { userId: opts.userId, providerSubscriptionId: opts.providerSubscriptionId },
  });
  if (row?.supersedesId) {
    const superseded = await prisma.subscription.findUnique({ where: { id: row.supersedesId } });
    if (superseded && !superseded.endedAt) {
      try {
        await provider.resumeSubscription(superseded.providerSubscriptionId);
      } catch (e) {
        console.error("[subscription] abandon: failed to resume superseded", superseded.providerSubscriptionId, e);
      }
    }
  }

  return { cancelled: true };
}

/**
 * A user can have several unpaid first-time ("created", supersedesId: null)
 * checkouts sitting around at once — one per plan they've clicked without
 * paying, kept around so retrying the same plan reuses it (see
 * /api/subscription/create). Once one of them actually activates, the rest
 * are moot — cancel them here rather than on a timer, so a slow-to-complete
 * checkout is never at risk of being cancelled out from under the user.
 */
async function cancelSiblingFirstTimeSubscriptions(userId: string, exceptId: string): Promise<void> {
  const siblings = await prisma.subscription.findMany({
    where: { userId, status: "created", supersedesId: null, id: { not: exceptId } },
  });
  for (const sibling of siblings) {
    await abandonCreatedSubscription({ userId, providerSubscriptionId: sibling.providerSubscriptionId });
  }
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

/**
 * The row actually granting access right now, same selection logic as
 * getEffectivePlan (grants() excludes a superseding row until its startAt
 * arrives) — so callers can't accidentally treat a pending plan-change row
 * as "current" just because it's the most recently created one.
 */
export async function getGrantingSubscription(userId: string) {
  const rows = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { subscriptionPlan: true },
  });
  return chooseGrantingRow(rows, new Date());
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

  await finalizeExpiredCancellationRows(rows, now);

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
    await logSubscriptionPlanHistoryIfChanged(userId, effective.subscriptionPlanId);
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
      // Razorpay's webhook payload is always the full current entity, not a
      // diff — currentStart/currentEnd/chargeAt are authoritative on every
      // event and legitimately null (e.g. chargeAt once paused/halted/
      // cancelled). unixToDate() returns null for "absent" too, so a `??
      // row.X` fallback here can't tell "Razorpay didn't say" apart from
      // "Razorpay explicitly says none" — it silently keeps stale values
      // instead of clearing them. paidCount/cancelAtCycleEnd don't have this
      // problem: their normalizers return undefined (not null) when unset.
      currentStart: evt.currentStart,
      currentEnd: evt.currentEnd,
      chargeAt: evt.chargeAt,
      cancelAtCycleEnd: evt.cancelAtCycleEnd ?? row.cancelAtCycleEnd,
      endedAt: TERMINAL.has(evt.status) ? new Date() : row.endedAt,
    },
  });

  // A first-time ("created", no supersedesId) checkout just started granting
  // access — "authenticated" (e-mandate set up) grants exactly like "active"
  // does (see GRANTS_UNCONDITIONALLY/grants() above), so this has to fire on
  // either, not just "active": a subscription can sit "authenticated" for a
  // while before its first charge webhook arrives. The user may have clicked
  // more than one plan before paying (see /api/subscription/create); those
  // other pending choices are moot now.
  if (GRANTS_UNCONDITIONALLY.has(evt.status) && !GRANTS_UNCONDITIONALLY.has(row.status) && !row.supersedesId) {
    await cancelSiblingFirstTimeSubscriptions(row.userId, row.id);
  }

  // The user cancelled (local flag) but never resumed, and Razorpay charged the
  // next cycle anyway — commit the cancellation on Razorpay now and end access
  // at the cycle the user last paid for (row.currentEnd, pre-charge).
  if (row.cancelAtCycleEnd && !row.endedAt && evt.kind === "charged") {
    try {
      const { getProvider } = await import("@/lib/payments");
      await getProvider().cancelNow(row.providerSubscriptionId);
    } catch (e) {
      // Couldn't confirm the cancellation on Razorpay — don't mark it
      // cancelled locally on the strength of a failed call. Leave the row as
      // the generic update above already wrote it (the charge genuinely
      // happened, so status/currentEnd/paidCount reflect that honestly);
      // cancelAtCycleEnd is still true, so finalizeExpiredCancellationRows
      // will retry the cancellation once that (now later) currentEnd passes.
      console.error("[subscription] failed to cancel a cancel-at-cycle-end subscription after an unexpected renewal charge", row.providerSubscriptionId, e);
      await getEffectivePlan(row.userId);
      return;
    }
    await prisma.subscription.update({
      where: { id: row.id },
      data: { status: "cancelled", endedAt: new Date(), currentEnd: row.currentEnd },
    });
    await getEffectivePlan(row.userId);
    return;
  }

  // A superseding row going active does NOT retire the plan it replaces here —
  // that's reconcileSupersedingSubscriptions' job (called from /api/auth/unlock
  // and the daily cron), not this webhook. Cancelling eagerly the instant the
  // webhook happens to arrive is exactly the ad-hoc, non-reconciled path that
  // made the old subscription's own pending renewal a double-charge risk.

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
  // Only "authenticated"/"active" means the customer actually completed
  // Razorpay's checkout and a real mandate exists — that's a genuine
  // scheduled switch. change-plan writes a "created" row *before* checkout
  // even opens (see /api/subscription/change-plan), so a row still stuck at
  // "created" here means the payment failed or was abandoned: nothing will
  // happen at startAt, and it must not be shown as upcoming.
  const scheduled = rows.find(
    (r) =>
      r.supersedesId === active.id &&
      !!r.startAt && r.startAt > now &&
      ["authenticated", "active"].includes(r.status),
  );
  // Not `!r.endedAt` — applySubscriptionEvent sets endedAt the instant a
  // halted webhook arrives, before reconciliation ever runs, which would hide
  // the retry card exactly when it's most needed. Once reconciliation *has*
  // resolved it, status moves to "cancelled" and this already excludes it.
  const failedChange = !scheduled
    ? rows.find((r) => r.supersedesId === active.id && ["created", "halted"].includes(r.status))
    : undefined;

  const p = active.subscriptionPlan;
  const intervalLabel = p.intervalMonths === 1 ? "month" : p.intervalMonths === 3 ? "quarter" : "year";
  // termMonths is a day count (daily-billing plans, interval 7/9/12) — add
  // days, not calendar months.
  const lockedThrough = new Date(active.createdAt);
  if (p.termMonths) lockedThrough.setDate(lockedThrough.getDate() + p.termMonths);

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
          tier: scheduled.subscriptionPlan.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL",
          planName: { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }[
            scheduled.subscriptionPlan.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL"
          ],
          startsAt: scheduled.startAt!.toISOString(),
          amountPerCycle: formatMoney(Math.round(scheduled.amount / 100), scheduled.currency),
        }
      : null,
    failedChange: failedChange
      ? {
          tier: failedChange.subscriptionPlan.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL",
          planName: { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }[
            failedChange.subscriptionPlan.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL"
          ],
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
      // intervalMonths is a day count now — normalize to a 30-day month-equivalent.
      perMonth: formatMoney(Math.round((amount / (p.intervalMonths ?? 1)) * 30), p.currency),
      perCycle: formatMoney(amount, p.currency),
    };
  });
}

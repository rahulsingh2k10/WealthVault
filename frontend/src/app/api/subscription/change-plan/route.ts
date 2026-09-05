import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { totalCountFor, getGrantingSubscription } from "@/lib/services/SubscriptionService";

const PAID_TIERS = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tier } = await req.json();
    if (!PAID_TIERS.includes(tier)) return NextResponse.json({ error: "invalid tier" }, { status: 400 });

    const cur = await getGrantingSubscription(session.userId);
    if (!cur) return NextResponse.json({ error: "no active subscription" }, { status: 404 });
    if (cur.subscriptionPlan.tier === tier) return NextResponse.json({ error: "already on this plan" }, { status: 400 });
    if (!cur.currentEnd) return NextResponse.json({ error: "subscription not yet active enough to schedule a plan change" }, { status: 409 });

    // A superseding row still authenticating or mid-retry (Razorpay status
    // "pending") has a live mandate that might still resolve — only one may
    // exist at a time. A row that never got a mandate ("created") or that
    // Razorpay gave up on ("halted") is dead; retiring it here means a direct
    // API call gets the same guarantee the UI's disabled state gives a click.
    // Not `endedAt: null` — applySubscriptionEvent sets endedAt on ANY row the
    // instant a terminal webhook (halted/completed/expired) arrives, which
    // would hide an already-halted pending change from this guard entirely.
    // The status filter alone is still exactly-once: once cleaned up below (or
    // resolved by reconcileSupersedingSubscriptions), status leaves this set.
    const pendingChange = await prisma.subscription.findFirst({
      where: { supersedesId: cur.id, status: { in: ["created", "authenticated", "pending", "halted"] } },
      orderBy: { createdAt: "desc" },
    });
    if (pendingChange) {
      if (pendingChange.status === "authenticated" || pendingChange.status === "pending") {
        return NextResponse.json({ error: "a plan change is already in progress — cancel it before starting another" }, { status: 409 });
      }
      try {
        await getProvider().cancelNow(pendingChange.providerSubscriptionId);
      } catch (e) {
        console.error("[subscription] failed to cancel a dead pending change", pendingChange.providerSubscriptionId, e);
      }
      await prisma.subscription.delete({ where: { id: pendingChange.id } });
    }

    const [user, plan] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
      prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier } }),
    ]);
    if (!plan.razorpayPlanId || !plan.intervalMonths || !plan.termMonths) {
      return NextResponse.json({ error: "plan not configured for payments" }, { status: 500 });
    }

    const provider = getProvider();
    const email = user.username.includes("@") ? user.username : null;
    const providerCustomerId = await provider.ensureCustomer({ id: user.id, fullName: user.fullName, email, razorpayCustomerId: user.razorpayCustomerId });
    if (providerCustomerId !== user.razorpayCustomerId) {
      await prisma.user.update({ where: { id: user.id }, data: { razorpayCustomerId: providerCustomerId } });
    }

    const totalCount = totalCountFor(plan);
    const amountPaise = Number(plan.offerPrice ?? plan.price) * 100;

    const created = await provider.createSubscription({
      userId: user.id,
      plan: { tier, providerPlanId: plan.razorpayPlanId, totalCount, amountPaise, currency: plan.currency },
      providerCustomerId,
      startAt: Math.floor(cur.currentEnd.getTime() / 1000),
      notes: { userId: user.id, tier },
    });

    await prisma.subscription.create({
      data: {
        userId: user.id,
        subscriptionPlanId: plan.id,
        provider: provider.name,
        providerSubscriptionId: created.providerSubscriptionId,
        providerPlanId: plan.razorpayPlanId,
        providerCustomerId,
        providerData: created.shortUrl ? { shortUrl: created.shortUrl } : undefined,
        status: "created",
        totalCount,
        amount: amountPaise,
        currency: plan.currency,
        supersedesId: cur.id,
        startAt: cur.currentEnd,
      },
    });

    // The new subscription's first charge and the old one's next renewal both
    // fall on cur.currentEnd — pause the old one on Razorpay now so it can't
    // auto-renew and double-charge before reconcileSupersedingSubscriptions
    // (called from /api/auth/unlock and the daily cron) retires it once the
    // new plan activates. Reversed by /api/subscription/cancel-scheduled-change
    // (explicit) or reconcileSupersedingSubscriptions itself (if the new plan
    // never activates — see change-plan's own auto-cleanup guard above too).
    await provider.pauseSubscription(cur.providerSubscriptionId);

    return NextResponse.json({
      checkout: {
        provider: "razorpay",
        razorpay: { keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, subscriptionId: created.providerSubscriptionId, name: "WealthVault" },
      },
    });
  } catch (error) {
    console.error("[subscription] change-plan failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

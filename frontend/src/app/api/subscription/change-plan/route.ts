import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { totalCountFor } from "@/lib/services/SubscriptionService";

const PAID_TIERS = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { tier } = await req.json();
    if (!PAID_TIERS.includes(tier)) return NextResponse.json({ error: "invalid tier" }, { status: 400 });

    const cur = await prisma.subscription.findFirst({
      where: { userId: session.userId, status: { in: ["active", "authenticated", "pending"] } },
      orderBy: { createdAt: "desc" },
      include: { subscriptionPlan: true },
    });
    if (!cur) return NextResponse.json({ error: "no active subscription" }, { status: 404 });
    if (cur.subscriptionPlan.tier === tier) return NextResponse.json({ error: "already on this plan" }, { status: 400 });
    if (!cur.currentEnd) return NextResponse.json({ error: "subscription not yet active enough to schedule a plan change" }, { status: 409 });

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

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const row = await prisma.subscription.findFirst({
      where: { userId: session.userId, status: { in: ["active", "authenticated", "pending"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Local flag only — don't commit the cancellation to Razorpay yet, so the
    // user can resume before the cycle ends with nothing to reverse. The
    // subscription is actually cancelled on Razorpay by applySubscriptionEvent
    // if a renewal charge lands while this flag is still set.
    await prisma.subscription.update({ where: { id: row.id }, data: { cancelAtCycleEnd: true } });

    return NextResponse.json({ ok: true, accessUntil: row.currentEnd });
  } catch (error) {
    console.error("[subscription] cancel failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const row = await prisma.subscription.findFirst({
      where: { userId: session.userId, status: { in: ["active", "authenticated", "pending"] } },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Pause billing on Razorpay (reversible via /resume) so the pending renewal
    // never charges, and flag the row locally — grants() then serves access only
    // through the cycle the user already paid for (row.currentEnd).
    await getProvider().pauseSubscription(row.providerSubscriptionId);
    await prisma.subscription.update({ where: { id: row.id }, data: { cancelAtCycleEnd: true } });

    return NextResponse.json({ ok: true, accessUntil: row.currentEnd });
  } catch (error) {
    console.error("[subscription] cancel failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

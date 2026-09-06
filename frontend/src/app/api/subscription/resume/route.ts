import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const row = await prisma.subscription.findFirst({
      where: {
        userId: session.userId,
        // "paused" included: cancelling now pauses billing on Razorpay
        // immediately (see /api/subscription/cancel), so a cancelled-but-
        // still-within-cycle row is commonly "paused" by the time the user
        // clicks Resume, not "active".
        status: { in: ["active", "authenticated", "pending", "paused"] },
        cancelAtCycleEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return NextResponse.json({ error: "nothing to resume" }, { status: 404 });

    // Only reversible while the paid cycle is still running. Once it has ended
    // the user is on FREE and must start a fresh subscription.
    if (!row.currentEnd || row.currentEnd <= new Date()) {
      return NextResponse.json({ error: "subscription has ended — subscribe again" }, { status: 409 });
    }

    await getProvider().resumeSubscription(row.providerSubscriptionId);
    await prisma.subscription.update({
      where: { id: row.id },
      data: {
        cancelAtCycleEnd: false,
        // grants() falls through to checking `status` once cancelAtCycleEnd
        // is false — a row we just resumed from "paused" would otherwise sit
        // as (cancelAtCycleEnd: false, status: "paused") until the
        // subscription.resumed webhook eventually arrives to fix status,
        // and "paused" doesn't grant. Set it here so access is correct the
        // instant this request completes, not whenever the webhook lands.
        ...(row.status === "paused" ? { status: "active" } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[subscription] resume failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

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
        status: { in: ["active", "authenticated", "pending"] },
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
    await prisma.subscription.update({ where: { id: row.id }, data: { cancelAtCycleEnd: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[subscription] resume failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

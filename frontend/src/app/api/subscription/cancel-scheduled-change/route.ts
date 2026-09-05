import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const pending = await prisma.subscription.findFirst({
      where: {
        userId: session.userId,
        supersedesId: { not: null },
        status: { in: ["created", "authenticated"] },
        startAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });
    if (!pending) return NextResponse.json({ error: "no scheduled change" }, { status: 404 });

    const superseded = pending.supersedesId
      ? await prisma.subscription.findUnique({ where: { id: pending.supersedesId } })
      : null;

    await getProvider().cancelNow(pending.providerSubscriptionId);
    // change-plan paused the old subscription on Razorpay to avoid a double
    // charge at the shared cycle boundary — undo that so it keeps renewing.
    if (superseded && !superseded.endedAt) {
      await getProvider().resumeSubscription(superseded.providerSubscriptionId);
    }
    await prisma.subscription.delete({ where: { id: pending.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[subscription] cancel-scheduled-change failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

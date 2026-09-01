import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // The current cycle hasn't ended (row still granting) and it's flagged to
    // cancel — undo the flag. Nothing to reverse on Razorpay: /cancel only set
    // the local flag, it never told Razorpay.
    const row = await prisma.subscription.findFirst({
      where: {
        userId: session.userId,
        status: { in: ["active", "authenticated", "pending"] },
        cancelAtCycleEnd: true,
      },
      orderBy: { createdAt: "desc" },
    });
    if (!row) return NextResponse.json({ error: "nothing to resume" }, { status: 404 });

    await prisma.subscription.update({ where: { id: row.id }, data: { cancelAtCycleEnd: false } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[subscription] resume failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

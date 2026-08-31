import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      return NextResponse.json({ error: "missing fields" }, { status: 400 });
    }

    const provider = getProvider();
    if (!provider.verifyCheckoutSignature({ paymentId: razorpay_payment_id, subscriptionId: razorpay_subscription_id, signature: razorpay_signature })) {
      return NextResponse.json({ error: "bad signature" }, { status: 400 });
    }

    const row = await prisma.subscription.findFirst({
      where: { providerSubscriptionId: razorpay_subscription_id, userId: session.userId },
    });
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

    // Only advance a still-fresh row. Webhooks are server-to-server and usually
    // land before this client-driven call, so by now the status may already be
    // "active"/"pending"/etc. — never regress it back to "authenticated".
    if (row.status === "created") {
      await prisma.subscription.update({ where: { id: row.id }, data: { status: "authenticated" } });
    }

    // plan change: this row supersedes another → now cancel the old one
    if (row.supersedesId) {
      const old = await prisma.subscription.findUnique({ where: { id: row.supersedesId } });
      if (old && !old.cancelAtCycleEnd) {
        await provider.cancelAtCycleEnd(old.providerSubscriptionId);
        await prisma.subscription.update({ where: { id: old.id }, data: { cancelAtCycleEnd: true } });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[subscription] verify failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

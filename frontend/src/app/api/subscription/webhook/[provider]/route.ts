import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { applySubscriptionEvent } from "@/lib/services/SubscriptionService";

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  if (params.provider !== "razorpay") {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  const raw = await req.text();
  const provider = getProvider("razorpay");

  if (!provider.verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const evt = provider.normalizeWebhookEvent(raw);

  // idempotency
  try {
    await prisma.processedWebhookEvent.create({ data: { provider: "razorpay", eventId: evt.eventId } });
  } catch {
    return NextResponse.json({ ok: true, duplicate: true }); // already processed
  }

  try {
    await applySubscriptionEvent(evt);
  } catch (e) {
    console.error("[subscription] webhook processing failed", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

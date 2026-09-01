import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { applySubscriptionEvent } from "@/lib/services/SubscriptionService";

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  if (params.provider !== "razorpay") {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }

  if (!process.env.RAZORPAY_WEBHOOK_SECRET && process.env.PAYMENTS_PROVIDER !== "fake") {
    console.error("[subscription] RAZORPAY_WEBHOOK_SECRET is not set — refusing to process webhooks with a guessable fallback secret");
    return NextResponse.json({ error: "webhook not configured" }, { status: 500 });
  }

  const raw = await req.text();
  const provider = getProvider("razorpay");

  if (!provider.verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const evt = provider.normalizeWebhookEvent(raw, req.headers.get("x-razorpay-event-id"));

  // Idempotency: create the row up front. On a real duplicate (unique
  // constraint), only skip reprocessing if a PRIOR attempt actually finished
  // ("done") — a row stuck at "processing" means a prior attempt crashed
  // before completing, and it's safe (and necessary) to retry, because
  // applySubscriptionEvent writes absolute values, never deltas.
  let alreadyDone = false;
  try {
    await prisma.processedWebhookEvent.create({ data: { provider: "razorpay", eventId: evt.eventId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { provider_eventId: { provider: "razorpay", eventId: evt.eventId } },
      });
      alreadyDone = existing?.status === "done";
    } else {
      console.error("[subscription] webhook idempotency check failed", e);
      return NextResponse.json({ error: "idempotency check failed" }, { status: 500 });
    }
  }

  if (alreadyDone) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await applySubscriptionEvent(evt);
  } catch (e) {
    console.error("[subscription] webhook processing failed", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  await prisma.processedWebhookEvent.updateMany({
    where: { provider: "razorpay", eventId: evt.eventId },
    data: { status: "done" },
  });

  return NextResponse.json({ ok: true });
}

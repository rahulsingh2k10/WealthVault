import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { abandonCreatedSubscription } from "@/lib/services/SubscriptionService";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { providerSubscriptionId } = await req.json();
    if (typeof providerSubscriptionId !== "string" || !providerSubscriptionId) {
      return NextResponse.json({ error: "providerSubscriptionId required" }, { status: 400 });
    }

    const result = await abandonCreatedSubscription({ userId: session.userId, providerSubscriptionId });
    return NextResponse.json(result);
  } catch (error) {
    console.error("[subscription] abandon failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

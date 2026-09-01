import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { buildManageView } from "@/lib/services/SubscriptionService";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await buildManageView(session.userId));
  } catch (error) {
    console.error("[subscription] get failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { finalizeExpiredCancellations, reconcileSupersedingSubscriptions } from "@/lib/services/SubscriptionService";

// Runs daily via Vercel Cron (see vercel.json). Vercel signs the request with
// `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set on the project —
// reject anything else so this endpoint can't be triggered by a random caller.
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [cancellations, supersedes] = await Promise.all([
      finalizeExpiredCancellations(),
      reconcileSupersedingSubscriptions(),
    ]);
    return NextResponse.json({ ...cancellations, ...supersedes });
  } catch (error) {
    console.error("[cron] finalize-cancellations failed", error);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

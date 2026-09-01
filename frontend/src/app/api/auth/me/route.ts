import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getEffectivePlan } from "@/lib/services/SubscriptionService";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ user: null });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { authPlatform: true, subscriptionPlan: true },
  });
  if (!dbUser) {
    return NextResponse.json({ user: null });
  }

  // If the DB row has no avatar yet but the session captured one at login time
  // (e.g. user logged in before the avatar column was added), back-fill it now.
  let avatar = dbUser.avatar ?? "";
  if (!avatar && session.userAvatar) {
    avatar = session.userAvatar;
    await prisma.user.update({
      where: { id: session.userId },
      data: { avatar },
    });
  }

  // A subscription-computation hiccup must not 500 this route — it's the app's
  // core identity fetch. Fall back to the denormalised User.subscriptionPlan cache.
  let subscription: string = dbUser.subscriptionPlan.tier;
  let paymentRetrying = false;
  let subscriptionEndsAt: string | null = null;
  try {
    const eff = await getEffectivePlan(session.userId);
    subscription = eff.tier;
    paymentRetrying = eff.paymentRetrying;
    subscriptionEndsAt = eff.currentEnd?.toISOString() ?? null;
  } catch (e) {
    console.error("[auth/me] getEffectivePlan failed — using the cached tier", e);
  }

  return NextResponse.json({
    user: {
      id: dbUser.id,
      name: dbUser.fullName,
      email: dbUser.username,
      avatar,
      platform: dbUser.authPlatform.platform,
      subscription,
      paymentRetrying,
      subscriptionEndsAt,
    },
  });
}

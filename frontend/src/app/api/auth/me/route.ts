import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ user: null });
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { subscriptionPlan: true, authPlatform: true },
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

  return NextResponse.json({
    user: {
      id: dbUser.id,
      name: dbUser.fullName,
      email: dbUser.username,
      avatar,
      platform: dbUser.authPlatform.platform,
      subscription: dbUser.subscriptionPlan.tier,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// PATCH /api/auth/avatar
// Body: { avatar: "data:image/jpeg;base64,..." }
// Saves the base64 data URL to the users table and updates the session.
export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { avatar } = body as { avatar?: string };

  if (!avatar || !avatar.startsWith("data:image/")) {
    return NextResponse.json({ error: "Invalid avatar data" }, { status: 400 });
  }

  // Rough size guard: base64 of a 300KB image is ~400KB string
  if (avatar.length > 500_000) {
    return NextResponse.json({ error: "Image too large (max ~350 KB)" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { avatar },
  });

  // Keep session in sync
  session.userAvatar = avatar;
  await session.save();

  return NextResponse.json({ success: true });
}

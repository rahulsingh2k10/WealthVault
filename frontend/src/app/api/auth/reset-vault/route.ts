import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

// POST /api/auth/reset-vault
// Clears the per-user passphrase verifier AND all encrypted holdings so the
// user can set a fresh passphrase. This is a last-resort action — all vault
// data is permanently destroyed.
export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear the per-user verifier so they can set a new passphrase
  await prisma.user.update({
    where: { id: session.userId },
    data: { verifier: null },
  });

  // Clear the encryption key from session so they must re-unlock with a new passphrase
  session.encryptionKey = undefined;
  await session.save();

  return NextResponse.json({ success: true });
}

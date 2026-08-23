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

  await Promise.all([
    // Clear the per-user verifier so they can set a new passphrase
    prisma.user.update({
      where: { id: session.userId },
      data: { verifier: null },
    }),
    // Wipe all encrypted holdings (they are unrecoverable without the old passphrase)
    prisma.equityHolding.deleteMany({ where: { userId: session.userId } }),
    prisma.mutualFund.deleteMany({ where: { userId: session.userId } }),
    prisma.npsHolding.deleteMany({ where: { userId: session.userId } }),
    prisma.cryptoHolding.deleteMany({ where: { userId: session.userId } }),
    prisma.postOfficeScheme.deleteMany({ where: { userId: session.userId } }),
    prisma.fixedDeposit.deleteMany({ where: { userId: session.userId } }),
    prisma.foreignHolding.deleteMany({ where: { userId: session.userId } }),
    prisma.otherInvestment.deleteMany({ where: { userId: session.userId } }),
    prisma.bankAccount.deleteMany({ where: { userId: session.userId } }),
  ]);

  // Clear the encryption key from session so they must re-unlock with a new passphrase
  session.encryptionKey = undefined;
  await session.save();

  return NextResponse.json({ success: true });
}

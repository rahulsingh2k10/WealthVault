import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Lock: only clears the encryption key — user stays logged in via Google
export async function POST() {
  const session = await getSession();
  session.encryptionKey = undefined;
  await session.save();
  return NextResponse.json({ success: true });
}

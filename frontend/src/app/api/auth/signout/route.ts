import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Full sign-out: clears all session data (user identity + encryption key)
export async function POST() {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ success: true });
}

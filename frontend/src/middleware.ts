import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { unsealData } from "iron-session";
import type { SessionData } from "@/lib/session";

const COOKIE_NAME = "portfolio_session";
const SESSION_PASSWORD = process.env.SESSION_SECRET!;

async function getSessionData(request: NextRequest): Promise<SessionData | null> {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  if (!cookieValue) return null;
  try {
    return await unsealData<SessionData>(cookieValue, { password: SESSION_PASSWORD });
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always public ──────────────────────────────────────────────────────
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth/google") ||
    pathname.startsWith("/api/auth/x") ||
    pathname.startsWith("/api/auth/linkedin") ||
    pathname.startsWith("/api/auth/apple") ||
    pathname === "/api/auth/unlock" ||
    pathname === "/api/auth/reset-vault" ||
    pathname === "/api/auth/lock" ||
    pathname === "/api/auth/me" ||
    pathname === "/api/auth/avatar" ||
    pathname === "/api/auth/signout" ||
    pathname.startsWith("/api/subscription/webhook") ||
    pathname === "/api-docs.html" ||
    pathname.startsWith("/api-docs/")
  ) {
    return NextResponse.next();
  }

  const session = await getSessionData(request);

  // ── /unlock: needs Google login ────────────────────────────────────────
  if (pathname.startsWith("/unlock")) {
    if (!session?.userId) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // ── All other protected routes ─────────────────────────────────────────
  if (!session?.userId) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (!session.encryptionKey) {
    if (pathname === "/api/preferences") return NextResponse.next();
    if (pathname === "/api/nav") return NextResponse.next();
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Portfolio locked" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/unlock", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.jpg$|.*\\.jpeg$|.*\\.gif$|.*\\.svg$|.*\\.ico$|.*\\.webp$).*)"],
};

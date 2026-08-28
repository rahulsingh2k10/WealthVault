import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  error?: string;
}

interface GoogleUserInfo {
  sub: string;         // Google unique user ID
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  email_verified: boolean;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Top-level catch — ensures Next.js never sees an unhandled exception from this route
  try {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle user denial
  if (error) {
    console.log("[oauth] user denied or google error:", error);
    return NextResponse.redirect(new URL(`/?error=${error}`, appUrl));
  }

  if (!code || !state) {
    console.log("[oauth] missing code or state params");
    return NextResponse.redirect(new URL("/?error=missing_params", appUrl));
  }

  // Verify CSRF state token
  const storedState = request.cookies.get("oauth_state")?.value;
  if (!storedState || storedState !== state) {
    console.log("[oauth] state mismatch — stored:", storedState, "received:", state);
    return NextResponse.redirect(new URL("/?error=invalid_state", appUrl));
  }

  try {
    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${appUrl}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    const tokens: GoogleTokenResponse = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      console.error("Google token error:", tokens.error);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", appUrl));
    }

    // Fetch user info from Google
    const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo: GoogleUserInfo = await userInfoRes.json();

    if (!userInfo.email || !userInfo.sub) {
      return NextResponse.redirect(new URL("/?error=invalid_user_info", appUrl));
    }

    const fullName = [
      userInfo.given_name  ?? userInfo.name.split(" ")[0],
      userInfo.family_name ?? userInfo.name.split(" ").slice(1).join(" "),
    ].filter(Boolean).join(" ");

    // New sign-ups start on the FREE plan — looked up by tier since ids aren't stable
    const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });
    const googlePlatform = await prisma.authPlatform.findUniqueOrThrow({ where: { platform: "GOOGLE" } });

    // username = actual Google email (globally unique)
    const user = await prisma.user.upsert({
      where: { username: userInfo.email },
      update: { fullName, auth_platformId: googlePlatform.id, avatar: userInfo.picture || undefined },
      create: { username: userInfo.email, fullName, auth_platformId: googlePlatform.id, avatar: userInfo.picture || undefined, subscriptionPlanId: freePlan.id },
    });

    console.log("[google-oauth] saving session for user:", user.username);
    const session = await getSession();
    session.userId    = user.id;
    session.userName  = user.fullName;
    session.userEmail = user.username;
    session.userAvatar = userInfo.picture;
    await session.save();

    // Clear the oauth state cookie using the same cookies() mechanism as session.save()
    // so both Set-Cookie headers travel in the same pipeline and neither is dropped.
    cookies().delete("oauth_state");
    console.log("[oauth] success — redirecting to /unlock");
    return NextResponse.redirect(new URL("/unlock", appUrl));
  } catch (err) {
    console.error("[oauth] inner error:", err);
    return NextResponse.redirect(new URL("/?error=server_error", appUrl));
  }

  } catch (outerErr) {
    // Safety net — should never reach here, but prevents Next.js crash
    console.error("[oauth] unhandled top-level error:", outerErr);
    return NextResponse.redirect(new URL("http://localhost:3000/?error=server_error"));
  }
}

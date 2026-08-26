import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface LinkedInTokenResponse {
  access_token: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

// LinkedIn OIDC userinfo endpoint shape
interface LinkedInUserInfo {
  sub: string;          // LinkedIn member ID
  name: string;
  given_name: string;
  family_name: string;
  email: string;
  email_verified?: boolean;
  picture?: string;
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.log("[linkedin-oauth] user denied or LinkedIn error:", error);
      return NextResponse.redirect(new URL(`/?error=${error}`, appUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", appUrl));
    }

    const storedState = request.cookies.get("oauth_state")?.value;
    if (!storedState || storedState !== state) {
      console.log("[linkedin-oauth] state mismatch");
      return NextResponse.redirect(new URL("/?error=invalid_state", appUrl));
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${appUrl}/api/auth/linkedin/callback`,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
      }),
    });

    const tokens: LinkedInTokenResponse = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      console.error("[linkedin-oauth] token error:", tokens.error, tokens.error_description);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", appUrl));
    }

    // Fetch user profile via OIDC userinfo endpoint
    const userInfoRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo: LinkedInUserInfo = await userInfoRes.json();

    if (!userInfo.sub || !userInfo.email) {
      console.error("[linkedin-oauth] invalid user info:", userInfo);
      return NextResponse.redirect(new URL("/?error=invalid_user_info", appUrl));
    }

    const fullName = [
      userInfo.given_name  ?? userInfo.name.split(" ")[0],
      userInfo.family_name ?? userInfo.name.split(" ").slice(1).join(" "),
    ].filter(Boolean).join(" ");

    // New sign-ups start on the FREE plan — looked up by tier since ids aren't stable
    const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });

    // username = actual LinkedIn email (globally unique)
    const user = await prisma.user.upsert({
      where: { username: userInfo.email },
      update: { fullName, platform: "LinkedIn", avatar: userInfo.picture || undefined },
      create: { username: userInfo.email, fullName, platform: "LinkedIn", avatar: userInfo.picture || undefined, subscriptionPlanId: freePlan.id },
    });

    const session = await getSession();
    session.userId    = user.id;
    session.userName  = user.fullName;
    session.userEmail = user.username;
    session.userAvatar = userInfo.picture ?? "";
    await session.save();

    cookies().delete("oauth_state");
    console.log("[linkedin-oauth] success — redirecting to /unlock");
    return NextResponse.redirect(new URL("/unlock", appUrl));
  } catch (err) {
    console.error("[linkedin-oauth] error:", err);
    return NextResponse.redirect(new URL("/?error=server_error", appUrl));
  }
}

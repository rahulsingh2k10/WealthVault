import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface XTokenResponse {
  access_token: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface XUserResponse {
  data?: {
    id: string;
    name: string;
    username: string;
    profile_image_url?: string;
  };
}

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.log("[x-oauth] user denied or X error:", error);
      return NextResponse.redirect(new URL(`/?error=${error}`, appUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", appUrl));
    }

    const storedState = request.cookies.get("oauth_state")?.value;
    const codeVerifier = request.cookies.get("x_code_verifier")?.value;

    if (!storedState || storedState !== state || !codeVerifier) {
      console.log("[x-oauth] state mismatch or missing code_verifier");
      return NextResponse.redirect(new URL("/?error=invalid_state", appUrl));
    }

    // Exchange code for tokens
    const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        // X requires Basic auth with client_id:client_secret
        Authorization: `Basic ${Buffer.from(
          `${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`
        ).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: `${appUrl}/api/auth/x/callback`,
        code_verifier: codeVerifier,
      }),
    });

    const tokens: XTokenResponse = await tokenRes.json();
    if (tokens.error || !tokens.access_token) {
      console.error("[x-oauth] token error:", tokens.error, tokens.error_description);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", appUrl));
    }

    // Fetch user profile
    const userRes = await fetch(
      "https://api.twitter.com/2/users/me?user.fields=name,username,profile_image_url",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } }
    );
    const userInfo: XUserResponse = await userRes.json();

    if (!userInfo.data?.id) {
      console.error("[x-oauth] invalid user info:", userInfo);
      return NextResponse.redirect(new URL("/?error=invalid_user_info", appUrl));
    }

    const { name, username: handle, profile_image_url } = userInfo.data;

    // username = X handle only — no domain suffix.
    // Emails always contain @, handles never do, so no clash is possible.
    const xAvatar = profile_image_url?.replace("_normal", "") ?? `https://unavatar.io/twitter/${handle}`;

    // New sign-ups start on the FREE plan — looked up by tier since ids aren't stable
    const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });

    const user = await prisma.user.upsert({
      where: { username: handle },
      update: { fullName: name, platform: "X", avatar: xAvatar },
      create: { username: handle, fullName: name, platform: "X", avatar: xAvatar, subscriptionPlanId: freePlan.id },
    });

    const session = await getSession();
    session.userId    = user.id;
    session.userName  = user.fullName;
    session.userEmail = user.username;
    session.userAvatar = user.avatar ?? "";
    // handle used above for avatar fallback
    await session.save();

    // Clear PKCE / state cookies via the same cookies() pipeline as session.save()
    const cookieStore = cookies();
    cookieStore.delete("oauth_state");
    cookieStore.delete("x_code_verifier");
    console.log("[x-oauth] success — redirecting to /unlock");
    return NextResponse.redirect(new URL("/unlock", appUrl));
  } catch (err) {
    console.error("[x-oauth] error:", err);
    return NextResponse.redirect(new URL("/?error=server_error", appUrl));
  }
}

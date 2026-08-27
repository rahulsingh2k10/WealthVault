import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SignJWT, importPKCS8, decodeJwt } from "jose";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

interface AppleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
  error?: string;
}

// Apple requires a short-lived JWT as the client_secret, signed with your .p8 private key
async function generateClientSecret(): Promise<string> {
  // .env stores the PEM with literal \n — convert back to real newlines
  const pem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const privateKey = await importPKCS8(pem, "ES256");

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuedAt()
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setAudience("https://appleid.apple.com")
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setExpirationTime("1h")
    .sign(privateKey);
}

// Apple sends the callback as a POST with application/x-www-form-urlencoded body
export async function POST(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const body = await request.formData();
    const code    = body.get("code")    as string | null;
    const state   = body.get("state")   as string | null;
    const error   = body.get("error")   as string | null;
    // "user" JSON is only present on the very first authorization
    const userJson = body.get("user")   as string | null;

    if (error) {
      console.log("[apple-oauth] user denied or Apple error:", error);
      return NextResponse.redirect(new URL(`/?error=${error}`, appUrl));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", appUrl));
    }

    const storedState = request.cookies.get("oauth_state")?.value;
    if (!storedState || storedState !== state) {
      console.log("[apple-oauth] state mismatch");
      return NextResponse.redirect(new URL("/?error=invalid_state", appUrl));
    }

    // Exchange code for tokens
    const clientSecret = await generateClientSecret();
    const tokenRes = await fetch("https://appleid.apple.com/auth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.APPLE_CLIENT_ID!,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${appUrl}/api/auth/apple/callback`,
      }),
    });

    const tokens: AppleTokenResponse = await tokenRes.json();
    if (tokens.error || !tokens.id_token) {
      console.error("[apple-oauth] token error:", tokens.error);
      return NextResponse.redirect(new URL("/?error=token_exchange_failed", appUrl));
    }

    // Decode id_token — sub is always present; email present on first login (and usually on return)
    const claims = decodeJwt(tokens.id_token);
    const appleId = claims.sub as string; // used only in synthetic fallback username
    const emailFromToken = claims.email as string | undefined;

    // Name is only in the "user" form field on first authorization
    let firstName = "";
    let lastName  = "";
    if (userJson) {
      try {
        const parsed = JSON.parse(userJson);
        firstName = parsed?.name?.firstName ?? "";
        lastName  = parsed?.name?.lastName  ?? "";
      } catch { /* ignore malformed JSON */ }
    }

    // username = Apple email (real or relay address — always distinct by domain).
    // Falls back to apple_{sub}@apple.com if email is somehow absent.
    const appleUsername = emailFromToken ?? `apple_${appleId}@apple.com`;
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Apple User";

    // New sign-ups start on the FREE plan — looked up by tier since ids aren't stable
    const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });
    const applePlatform = await prisma.authPlatform.findUniqueOrThrow({ where: { platform: "APPLE" } });

    const user = await prisma.user.upsert({
      where: { username: appleUsername },
      update: { platformId: applePlatform.id, ...(fullName && { fullName }) },
      create: { username: appleUsername, fullName, platformId: applePlatform.id, subscriptionPlanId: freePlan.id },
    });

    const session = await getSession();
    session.userId    = user.id;
    session.userName  = user.fullName;
    session.userEmail = user.username;
    session.userAvatar = "";
    await session.save();

    cookies().delete("oauth_state");
    console.log("[apple-oauth] success — redirecting to /unlock");
    return NextResponse.redirect(new URL("/unlock", appUrl));
  } catch (err) {
    console.error("[apple-oauth] error:", err);
    return NextResponse.redirect(new URL("/?error=server_error", appUrl));
  }
}

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

export async function GET() {
  const clientId = process.env.X_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "X OAuth not configured" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const redirectUri = `${appUrl}/api/auth/x/callback`;

  const state = randomBytes(32).toString("hex");
  // PKCE: generate code_verifier and derive code_challenge
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "tweet.read users.read",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const xUrl = `https://twitter.com/i/oauth2/authorize?${params}`;

  const response = NextResponse.redirect(xUrl);

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 10,
    path: "/",
    sameSite: "lax" as const,
  };

  response.cookies.set("oauth_state", state, cookieOpts);
  response.cookies.set("x_code_verifier", codeVerifier, cookieOpts);

  return response;
}

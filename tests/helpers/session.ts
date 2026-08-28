import { sealData } from "iron-session";
import { loadFrontendEnv } from "./loadEnv";

loadFrontendEnv();

// Must match frontend/src/lib/session.ts (cookie name + password). Duplicated
// here rather than imported because that file pulls in next/headers, which
// only resolves inside a running Next.js request context.
export const SESSION_COOKIE_NAME = "portfolio_session";

export interface SealedSessionData {
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
  encryptionKey?: string;
}

export async function sealSessionCookie(data: SealedSessionData): Promise<string> {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not set in frontend/.env");
  }
  return sealData(data, { password: process.env.SESSION_SECRET });
}

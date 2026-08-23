import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import type { SessionOptions } from "iron-session";

export interface SessionData {
  // Portfolio unlock key (AES-256-GCM derived from passphrase)
  encryptionKey?: string;
  // Google OAuth user identity
  userId?: string;
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "portfolio_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 60 * 8, // 8 hours
  },
};

export async function getSession() {
  return getIronSession<SessionData>(cookies(), sessionOptions);
}

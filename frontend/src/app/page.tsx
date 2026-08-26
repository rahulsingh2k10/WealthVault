"use client";

import { Lock, Globe, BarChart3, Shield, RefreshCw, Sparkles } from "lucide-react";
import { WarmBackground } from "@/components/layout/WarmBackground";
import FeatureCarousel from "@/components/landing/FeatureCarousel";


/* ── Feature list ────────────────────────────────────────────────── */
const features = [
  {
    icon: Lock,
    title: "End-to-End Encryption",
    desc: "Encrypted before it leaves your device. Secured with AES-256-GCM. Decrypted only on your device. Accessible only to you.",
  },
  {
    icon: BarChart3,
    title: "A Unified View of Your Wealth",
    desc: "Stocks, funds, crypto, deposits, and more. All in one place.",
  },
  {
    icon: Globe,
    title: "Global Currency Support",
    desc: "View your wealth in any currency. Instantly. Effortlessly.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Performance Tracking",
    desc: "Every asset. Precise valuations. Cost basis, tracked effortlessly.",
  },
  {
    icon: Shield,
    title: "Private by Design",
    desc: "No analytics. No data sharing. Your data remains yours. Always.",
  },
];

/* ── Google SVG ───────────────────────────────────────────────────── */
function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.39.07 2.36.74 3.18.76 1.22-.23 2.39-1 3.69-.97 1.58.05 2.77.68 3.55 1.84-3.27 1.98-2.64 6.03.64 7.31-.47 1.08-.99 2.14-3.06 3.94zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  /* ── Same shared tokens the unlock screen uses — dark/light only ── */
  const textPri    = "var(--ui-text-pri)";
  const textSec    = "var(--ui-text-sec)";
  const textMuted  = "var(--ui-text-muted)";
  const accent     = "var(--ui-accent)";
  const accentWarm = "var(--ui-accent-warm)";
  const cardBg     = "var(--ui-card-bg)";
  const cardBorder = "var(--ui-card-border)";
  const divider    = "var(--ui-card-border)";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden pt-14"
      style={{ background: "var(--warm-page-bg)", fontFamily: "Georgia, 'Times New Roman', serif" }}
    >

      {/* ── Background ambient orbs — same component used elsewhere in the app ── */}
      <WarmBackground />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-16 pt-10 text-center lg:pt-16">

        {/* Eyebrow badge */}
        <div
          className="relative mb-5 inline-flex items-center gap-1.5 overflow-hidden rounded-full px-4 py-2 text-xs font-bold tracking-wide"
          style={{
            background: `linear-gradient(90deg, color-mix(in srgb, ${accent} 38%, transparent), color-mix(in srgb, ${accentWarm} 38%, transparent))`,
            border: `1px solid color-mix(in srgb, ${accent} 70%, transparent)`,
            boxShadow: `0 0 24px color-mix(in srgb, ${accent} 45%, transparent)`,
            color: textPri,
          }}
        >
          <Sparkles className="h-3.5 w-3.5 animate-pulse" style={{ color: accent }} />
          Truly One of a Kind
          {/* Shimmer sweep */}
          <span
            aria-hidden
            className="animate-badge-shimmer pointer-events-none absolute inset-y-0 w-1/3"
            style={{ background: "linear-gradient(100deg, transparent, rgba(255,255,255,0.55), transparent)" }}
          />
        </div>

        {/* Headline — fixed size, never scales with viewport */}
        <h1
          className="mb-5 font-extrabold leading-tight tracking-tight"
          style={{ color: textPri, fontSize: "clamp(1.6rem, 5.5vw, 2.5rem)" }}
        >
          Your Wealth.{" "}
          <span style={{ color: accent }}>Privacy By Design.</span>{" "}
          <span style={{ color: accentWarm }}>Visible Only to You.</span>
        </h1>

        {/* Subheadline */}
        <div className="mx-auto mb-10 max-w-xl text-base sm:text-lg" style={{ color: textSec }}>
          <p>Your Entire WEALTH. One Complete VIEW. Zero COMPROMISE.</p>
          <p>Only you hold the PASSPHRASE. ENCRYPTED before it reaches us. SEEN only by you.</p>
        </div>

        {/* ── Sign-in card ─────────────────────────────────────── */}
        <div
          className="mx-auto max-w-sm w-full rounded-2xl overflow-hidden text-left"
          style={{
            background: cardBg,
            border: `1px solid ${cardBorder}`,
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            boxShadow: "var(--ui-signin-shadow)",
          }}
        >
          {/* Gradient header strip */}
          <div
            style={{
              height: "4px",
              background: `linear-gradient(90deg, ${accent}, ${accentWarm})`,
            }}
          />

          <div className="p-6">
            <h3 className="text-xl font-bold mb-1" style={{ color: textPri }}>
              Unlock Your Vault
            </h3>
            <p className="text-sm mb-5" style={{ color: textSec }}>
              Sign in to securely access your wealth.
            </p>

            {/* Google — primary CTA */}
            <a
              href="/api/auth/google"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white px-4 py-3.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 hover:shadow-md active:scale-[0.98] mb-2.5"
              style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
              <GoogleIcon />
              Continue with Google
            </a>

            {/* Apple */}
            <a
              href="/api/auth/apple"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-[0.98] mb-3"
              style={{ background: "#000000" }}
            >
              <AppleIcon />
              Continue with Apple
            </a>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px" style={{ background: divider }} />
              <span className="text-[15px]" style={{ color: textMuted }}>OR</span>
              <div className="flex-1 h-px" style={{ background: divider }} />
            </div>

            {/* X + LinkedIn — side by side */}
            <div className="flex gap-2 mb-4">
              <a
                href="/api/auth/x"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#0f1419" }}
              >
                <XIcon />
              </a>
              <a
                href="/api/auth/linkedin"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#0A66C2" }}
              >
                <LinkedInIcon />
                LinkedIn
              </a>
            </div>

          </div>
        </div>
      </section>

      {/* ── Feature grid ────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-[2200px] px-5 pb-28">
        <div className="mb-12 text-center">
          <h2 className="text-xl font-bold sm:text-2xl" style={{ color: textPri }}>
            Everything You Own. In One Place.
          </h2>
          <p className="mt-2 text-sm" style={{ color: textSec }}>
            Track it all. See it clearly. Keep it private.
          </p>
        </div>

        <FeatureCarousel
          features={features}
          cardBg={cardBg}
          cardBorder={cardBorder}
          textPri={textPri}
          textSec={textSec}
          accent={accent}
        />
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="relative z-10 px-5 py-6"
        style={{ borderTop: `1px solid ${divider}` }}
      >
        <p className="text-center text-xs font-semibold" style={{ color: textPri }}>
          © {new Date().getFullYear()} · Designed For Privacy. Built For You.
        </p>
      </footer>
    </div>
  );
}

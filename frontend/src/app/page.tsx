"use client";

import { Lock, Globe, BarChart3, Shield, RefreshCw } from "lucide-react";


/* ── Feature list ────────────────────────────────────────────────── */
const features = [
  {
    icon: Lock,
    title: "End-to-End Encrypted",
    desc: "Your data is encrypted before it leaves your device—accessible only to you, secured with AES-256-GCM encryption.",
  },
  {
    icon: BarChart3,
    title: "A Unified View of Your Wealth",
    desc: "All your assets—stocks, funds, crypto, deposits, and more—in one place.",
  },
  {
    icon: Globe,
    title: "Global Currency Support",
    desc: "View your wealth in any currency—instantly and effortlessly.",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Performance Tracking",
    desc: "Across every asset—with precise valuations and cost-basis tracking, effortlessly.",
  },
  {
    icon: Shield,
    title: "Private by Design",
    desc: "No analytics. No data sharing. Your data remains yours—always.",
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
  /* ── All colour tokens are CSS variables — no JS needed ── */
  const textPri    = "var(--ui-text-pri)";
  const textSec    = "var(--ui-text-sec)";
  const textMuted  = "var(--ui-text-muted)";
  const accent     = "var(--ui-accent)";
  const cardBg     = "var(--ui-card-bg)";
  const cardBorder = "var(--ui-card-border)";
  const iconBg     = "var(--ui-icon-bg)";
  const divider    = "var(--ui-card-border)";

  return (
    <div
      className="relative min-h-screen overflow-x-hidden"
      style={{ background: "var(--warm-page-bg)" }}
    >

      {/* ── Background ambient orbs ───────────────────────────── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full animate-float-slow"
          style={{
            top: "-15%", right: "-10%",
            height: "700px", width: "700px",
            background: "radial-gradient(circle, var(--warm-orb-1) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full animate-float-medium"
          style={{
            bottom: "-15%", left: "-10%",
            height: "700px", width: "700px",
            background: "radial-gradient(circle, var(--warm-orb-2) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full animate-float-fast"
          style={{
            top: "30%", left: "35%",
            height: "400px", width: "400px",
            background: "radial-gradient(circle, var(--warm-orb-3) 0%, transparent 70%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative z-10 mx-auto max-w-4xl px-5 pb-16 pt-10 text-center lg:pt-16">

        {/* Headline — fixed size, never scales with viewport */}
        <h1
          className="mb-5 font-extrabold leading-tight tracking-tight"
          style={{ color: textPri, fontSize: "clamp(1.6rem, 5.5vw, 2.5rem)" }}
        >
          Your Wealth.{" "}
          <span style={{ color: "var(--ui-accent)" }}>Safeguarded Here.</span>{" "}
          <span style={{ color: "var(--ui-accent-warm)" }}>Under Your Sole Control.</span>
        </h1>

        {/* Subheadline */}
        <div className="mx-auto mb-10 max-w-xl text-base sm:text-lg" style={{ color: textSec }}>
          <p>Zero compromise. Your entire wealth—brought together as one.</p>
          <p>Secured by a passphrase only you hold. Visible only to you.</p>
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
              background: "linear-gradient(90deg, var(--ui-accent), var(--ui-accent-warm))",
            }}
          />

          <div className="p-6">
            <h3 className="text-lg font-bold mb-1" style={{ color: textPri }}>
              Unlock Your Vault
            </h3>
            <p className="text-xs mb-5" style={{ color: textSec }}>
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
              <div className="flex-1 h-px" style={{ background: "var(--ui-card-border)" }} />
              <span className="text-[10px]" style={{ color: textMuted }}>or</span>
              <div className="flex-1 h-px" style={{ background: "var(--ui-card-border)" }} />
            </div>

            {/* X + LinkedIn — side by side */}
            <div className="flex gap-2 mb-4">
              <a
                href="/api/auth/x"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: "#0f1419" }}
              >
                <XIcon />
                X
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
      <section className="relative z-10 mx-auto max-w-5xl px-5 pb-28">
        <div className="mb-12 text-center">
          <h2
            className="text-xl font-bold sm:text-2xl"
            style={{ color: textPri }}
          >
            Designed for Absolute Privacy
          </h2>
          <p className="mt-2 text-sm" style={{ color: textSec }}>
            Accessible only to you. Never to us.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-xl p-7 transition hover:scale-[1.02]"
              style={{
                background: cardBg,
                border: `1px solid ${cardBorder}`,
                backdropFilter: "blur(14px)",
                WebkitBackdropFilter: "blur(14px)",
              }}
            >
              <div
                className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: iconBg }}
              >
                <Icon className="h-4 w-4" style={{ color: accent }} />
              </div>
              <h3 className="mb-1.5 text-sm font-semibold" style={{ color: textPri }}>
                {title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: textSec }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Security callout ────────────────────────────────────── */}
      <section
        className="relative z-10 px-5 py-12"
        style={{
          background: "var(--ui-section-bg)",
          borderTop: `1px solid ${divider}`,
          borderBottom: `1px solid ${divider}`,
          backdropFilter: "blur(8px)",
        }}
      >
        <div className="mx-auto max-w-3xl text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: iconBg }}
          >
            <Lock className="h-5 w-5" style={{ color: accent }} />
          </div>
          <h3 className="mb-2 text-lg font-bold" style={{ color: textPri }}>
            Zero-Knowledge Architecture
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: textSec }}>
            Your data is encrypted on your device using AES-256-GCM, with a key derived from
            your passphrase. The key exists only during your active session and fades with
            inactivity—never stored or retained. Even with full system access, your data
            remains unreadable to us.
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer
        className="relative z-10 px-5 py-6"
        style={{ borderTop: `1px solid ${divider}` }}
      >
        <p className="text-center text-xs font-semibold" style={{ color: textPri }}>
          © {new Date().getFullYear()} · Designed for privacy. Built for you.
        </p>
      </footer>
    </div>
  );
}

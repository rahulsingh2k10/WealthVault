"use client";

import { useState, useEffect, useRef, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useLocale } from "@/context/LocaleContext";
import { savePreference } from "@/lib/savePreference";
import type { Locale } from "@/i18n/translations";
import {
  Lock, Eye, EyeOff, LogOut, Camera,
  AlertTriangle, KeyRound, ShieldOff, Fingerprint,
  Copy, Check, ShieldCheck, CheckCircle2, Circle,
} from "lucide-react";


interface CurrentUser {
  id: string;
  name: string;
  email: string;
  avatar: string;
  platform: string;
}

function resizeImage(file: File, maxPx = 256, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load")); };
    img.src = url;
  });
}

const INFO_POINTS = [
  {
    icon: KeyRound,
    label: "Your only key",
    text: "Without it, your data is permanently inaccessible — no exceptions.",
  },
  {
    icon: ShieldOff,
    label: "Never stored",
    text: "It is never transmitted or held by us — not on our servers, not anywhere.",
  },
  {
    icon: AlertTriangle,
    label: "No recovery",
    text: "If you forget it, there is no reset, no support ticket. It is simply gone.",
  },
  {
    icon: Fingerprint,
    label: "Treat it like a safe combination",
    text: "Memorable to you, unknowable to everyone else.",
  },
];

const MIN_PASS = 12;
const MAX_PASS = 256;

export default function UnlockPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { locale, country, setLocale, setCountry } = useLocale();

  const textPri     = "var(--ui-text-pri)";
  const textSec     = "var(--ui-text-sec)";
  const textMuted   = "var(--ui-text-muted)";
  const cardBorder  = "var(--ui-card-border)";
  const inputBg     = "var(--ui-input-bg)";
  const inputBorder = "var(--ui-input-border)";
  const accent      = "var(--ui-accent)";
  const accentWarm  = "var(--ui-accent-warm)";

  /* Left panel has a stronger tint to differentiate from the right */
  const leftBg  = "var(--unlock-left-bg)";
  const rightBg = "var(--unlock-right-bg)";

  const [user, setUser] = useState<CurrentUser | null>(null);
  const [passphrase, setPassphrase] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'unlocking' | 'syncing' | 'done'>('unlocking');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState("");
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showSaveAlert, setShowSaveAlert] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live passphrase strength checks
  const checks = {
    minLength:       passphrase.length >= MIN_PASS,
    hasAlphanumeric: /[a-zA-Z]/.test(passphrase) && /\d/.test(passphrase),
    hasUpper:        (passphrase.match(/[A-Z]/g) ?? []).length >= 2,
    hasSpecial:      (passphrase.match(/[^a-zA-Z0-9]/g) ?? []).length >= 2,
    underMax:        passphrase.length <= MAX_PASS,
  };
  const allValid = Object.values(checks).every(Boolean);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setUser(d.user);
        } else {
          // Middleware let us through (userId in cookie) but the user row is gone —
          // stale session after a DB wipe or account deletion. Sign out and go home.
          fetch("/api/auth/signout", { method: "POST" })
            .catch(() => {})
            .finally(() => { window.location.href = "/"; });
        }
      })
      .catch(() => {});
  }, []);

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError("");
    setAvatarUploading(true);
    try {
      const dataUrl = await resizeImage(file);
      const res = await fetch("/api/auth/avatar", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar: dataUrl }),
      });
      if (!res.ok) { const d = await res.json(); setAvatarError(d.error ?? "Upload failed"); return; }
      setUser((prev) => prev ? { ...prev, avatar: dataUrl } : prev);
    } catch {
      setAvatarError("Could not process image.");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    setLoading(true);
    setLoadingStep('unlocking');
    setError("");
    try {
      // Step 1: verify passphrase
      const res = await fetch("/api/auth/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Invalid passphrase"); return; }

      setLoadingStep('syncing');

      if (data.firstTime) {
        // New user: save IP-detected country + locale + theme to DB
        await Promise.all([
          savePreference('country', country),
          savePreference('locale', locale),
          savePreference('theme', theme ?? 'dark'),
        ]);
        setShowSaveAlert(true);
      } else {
        // Existing user: load their saved prefs and apply
        const prefsRes = await fetch("/api/preferences");
        if (prefsRes.ok) {
          const prefs = await prefsRes.json();
          if (prefs.locale)  setLocale(prefs.locale as Locale);
          if (prefs.country) setCountry(prefs.country);
          if (prefs.theme)   setTheme(prefs.theme);
        }
        setLoadingStep('done');
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPassphrase = async () => {
    try {
      await navigator.clipboard.writeText(passphrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard without interaction
      const el = document.createElement("textarea");
      el.value = passphrase;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenVault = () => {
    router.push("/dashboard");
    router.refresh();
  };

  const handleResetVault = async () => {
    setResetting(true);
    try {
      await fetch("/api/auth/reset-vault", { method: "POST" });
      setPassphrase("");
      setError("");
      setShowReset(false);
    } finally {
      setResetting(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    // Full page reload — clears Next.js client cache and all React state.
    // router.push() + router.refresh() can race; window.location is reliable.
    window.location.href = "/";
  };

  const initials = user?.name
    ?.split(" ").filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("") ?? "?";

  return (
    <div
      className="mt-14 flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-4 sm:p-8"
      style={{ background: "var(--warm-page-bg)" }}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute rounded-full"
          style={{
            top: "-15%", right: "-10%",
            height: "700px", width: "700px",
            background: "radial-gradient(circle, var(--warm-orb-1) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: "-15%", left: "-10%",
            height: "700px", width: "700px",
            background: "radial-gradient(circle, var(--warm-orb-2) 0%, transparent 65%)",
            filter: "blur(60px)",
          }}
        />
      </div>

      {/* ── Main card — two panels side by side ─────────────────────── */}
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-2xl flex flex-col lg:flex-row"
        style={{
          border: `1px solid ${cardBorder}`,
          backdropFilter: "blur(32px)",
          WebkitBackdropFilter: "blur(32px)",
          boxShadow: "var(--ui-card-shadow)",
        }}
      >
        {/* Gradient accent strip — full width top */}
        <div
          className="absolute top-0 left-0 right-0 z-10"
          style={{ height: "3px", background: `linear-gradient(90deg, ${accent}, ${accentWarm})` }}
        />

        {/* ── LEFT PANEL — profile + info ─────────────────────────────── */}
        <div
          className="lg:w-2/5 flex flex-col px-8 pt-10 pb-8 lg:border-r"
          style={{
            background: leftBg,
            borderColor: cardBorder,
          }}
        >
          {/* Avatar */}
          <div className="flex flex-col items-center gap-3 mb-6">
            <div className="relative group">
              <div
                className="h-24 w-24 rounded-full overflow-hidden flex items-center justify-center text-3xl font-bold"
                style={{
                  background: user?.avatar ? "transparent" : "var(--ui-accent-avatar)",
                  border: "2.5px solid var(--ui-avatar-border)",
                  color: "var(--ui-accent)",
                  boxShadow: "0 0 0 4px var(--ui-accent-ring)",
                }}
              >
                {user?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user?.name} className="h-full w-full object-cover" />
                ) : (
                  <span>{initials}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                style={{ background: "rgba(0,0,0,0.45)" }}
                title="Change photo"
              >
                {avatarUploading
                  ? <div className="h-5 w-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  : <Camera className="h-5 w-5 text-white" />
                }
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>

            {!user?.avatar && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-medium transition-opacity hover:opacity-70"
                style={{ color: accent }}
              >
                + Add profile photo
              </button>
            )}
            {avatarError && <p className="text-xs text-red-400 text-center">{avatarError}</p>}

            {/* Name & tagline */}
            {user ? (
              <div className="text-center">
                <p className="text-lg font-bold" style={{ color: textPri }}>
                  Welcome, {user.name}
                </p>
                <p className="mt-1 text-xs leading-relaxed" style={{ color: textSec }}>
                  Your Vault. Securely Held Here. Yours to Control.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="h-5 w-36 rounded-md animate-pulse mx-auto" style={{ background: "rgba(255,255,255,0.10)" }} />
                <div className="h-3 w-28 rounded-md animate-pulse mx-auto" style={{ background: "rgba(255,255,255,0.07)" }} />
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="mb-5 h-px" style={{ background: "var(--ui-card-border)" }} />

          {/* Passphrase criticality info */}
          <div className="flex-1 space-y-1 mb-6">
            <div className="flex items-center gap-1.5 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
              <p className="text-xs font-extrabold uppercase tracking-wide text-red-500">
                Your passphrase is critical — read this
              </p>
            </div>
            {INFO_POINTS.map(({ icon: Icon, label, text }) => (
              <div key={label} className="flex items-start gap-2.5 py-2 rounded-xl px-2.5"
                   style={{ background: "var(--ui-subtle-bg)" }}>
                <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: "var(--ui-accent-icon)" }} />
                <div>
                  <p className="text-xs font-medium leading-tight" style={{ color: textPri }}>{label}</p>
                  <p className="text-xs leading-snug mt-0.5" style={{ color: textSec }}>{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs font-bold self-start transition-opacity hover:opacity-70 text-red-500"
          >
            <LogOut className="h-3 w-3" />
            Sign out
          </button>
        </div>

        {/* ── RIGHT PANEL — passphrase form ───────────────────────────── */}
        <div
          className="lg:w-3/5 flex flex-col justify-between px-8 pt-10 pb-8"
          style={{ background: rightBg }}
        >
          <div>
            {/* Lock icon + heading */}
            <div className="mb-8">
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl mb-5"
                style={{ background: "var(--ui-accent-bg)" }}
              >
                <Lock className="h-5 w-5" style={{ color: "var(--ui-accent)" }} />
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: textPri }}>
                Enter Your Passphrase
              </h2>
              <p className="text-sm" style={{ color: textSec }}>
                Access your vault—secured and available only to you.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value.slice(0, MAX_PASS))}
                    placeholder="Enter your passphrase"
                    autoFocus
                    maxLength={MAX_PASS}
                    className="w-full rounded-xl px-4 py-3.5 pr-12 text-sm outline-none transition"
                    style={{
                      background: inputBg,
                      border: `1px solid ${
                        passphrase.length > 0 && !allValid
                          ? "rgba(239,68,68,0.55)"
                          : allValid
                          ? "rgba(34,197,94,0.55)"
                          : inputBorder
                      }`,
                      color: textPri,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-70"
                    style={{ color: textSec }}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Validation checklist + char counter */}
                <div className="mt-2.5 space-y-1.5">
                  {([
                    { key: "minLength",       label: "At least 12 characters"              },
                    { key: "hasAlphanumeric", label: "Contains a letter and a number"      },
                    { key: "hasUpper",        label: "At least two uppercase letters"      },
                    { key: "hasSpecial",      label: "At least two special characters"     },
                    { key: "underMax",        label: "Under 256 characters"                },
                  ] as { key: keyof typeof checks; label: string }[]).map(({ key, label }) => {
                    const active = passphrase.length > 0;
                    const met    = active && checks[key];
                    const unmet  = active && !checks[key];
                    return (
                      <div key={key} className="flex items-center gap-2">
                        {met
                          ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "rgba(34,197,94,0.90)" }} />
                          : <Circle       className="h-3.5 w-3.5 shrink-0" style={{ color: unmet ? "rgba(239,68,68,0.55)" : textMuted }} />
                        }
                        <span className="text-xs font-bold" style={{
                          color: met ? "rgba(34,197,94,0.90)" : unmet ? "rgba(239,68,68,0.70)" : textMuted,
                        }}>
                          {label}
                        </span>
                      </div>
                    );
                  })}

                  {/* Char counter — always legible */}
                  <p className="text-xs font-medium tabular-nums text-right pt-0.5" style={{
                    color: passphrase.length >= MAX_PASS - 20
                      ? "rgba(239,68,68,0.90)"
                      : passphrase.length > 0
                      ? textSec
                      : textMuted,
                  }}>
                    {passphrase.length} / {MAX_PASS}
                  </p>
                </div>
              </div>

              {error && (
                <div>
                  <p className="rounded-xl px-4 py-2.5 text-xs text-red-400"
                     style={{ background: "rgba(239,68,68,0.10)" }}>
                    {error}
                  </p>

                  {/* Reset vault option — only surfaces on wrong-passphrase errors */}
                  {error === "Invalid passphrase" && !showReset && (
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="mt-2 text-xs transition-opacity hover:opacity-70"
                      style={{ color: textMuted }}
                    >
                      Forgot your passphrase? Reset vault →
                    </button>
                  )}

                  {showReset && (
                    <div
                      className="mt-3 rounded-xl p-4 space-y-3"
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.20)",
                      }}
                    >
                      <p className="text-xs font-semibold text-red-400">
                        ⚠ This will permanently delete all vault data
                      </p>
                      <p className="text-xs" style={{ color: textSec }}>
                        Your passphrase cannot be recovered. Resetting will erase all your holdings and let you set a new passphrase. This cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={handleResetVault}
                          disabled={resetting}
                          className="flex-1 rounded-lg py-2 text-xs font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
                          style={{ background: "rgba(239,68,68,0.75)" }}
                        >
                          {resetting ? "Resetting…" : "Yes, delete everything"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowReset(false)}
                          className="flex-1 rounded-lg py-2 text-xs font-medium transition hover:opacity-70"
                          style={{ color: textSec, background: "rgba(255,255,255,0.06)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !allValid}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center gap-2.5"
                style={{ background: `linear-gradient(90deg, ${accent}, ${accentWarm})` }}
              >
                {loading && (
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin shrink-0" />
                )}
                {loading
                  ? loadingStep === 'unlocking'
                    ? "Verifying passphrase…"
                    : loadingStep === 'syncing'
                    ? "Loading your settings…"
                    : "Opening vault…"
                  : "Unlock Vault"
                }
              </button>
            </form>
          </div>

          {/* Footer hint */}
          <div className="mt-8 pt-5" style={{ borderTop: `1px solid ${cardBorder}` }}>
            <p className="flex items-center gap-1.5 text-sm font-bold mb-1" style={{ color: accent }}>
              <Lock className="h-3.5 w-3.5 shrink-0" />
              First time here?
            </p>
            <p className="text-sm leading-relaxed" style={{ color: accent }}>
              Your passphrase becomes your key—only you can access your vault.
            </p>
          </div>
        </div>
      </div>

      {/* ── First-time passphrase save confirmation ──────────────────── */}
      {showSaveAlert && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        >
          <div
            className="relative w-full max-w-md rounded-2xl overflow-hidden"
            style={{
              background: "var(--ui-modal-bg)",
              border: "1px solid var(--ui-accent-border)",
              boxShadow: "var(--ui-modal-shadow)",
            }}
          >
            {/* Top accent strip */}
            <div style={{ height: "3px", background: `linear-gradient(90deg, ${accent}, ${accentWarm})` }} />

            <div className="px-7 pt-7 pb-6">
              {/* Icon */}
              <div
                className="flex h-12 w-12 items-center justify-center rounded-2xl mb-5"
                style={{ background: "var(--ui-accent-bg)" }}
              >
                <ShieldCheck className="h-5 w-5" style={{ color: "var(--ui-accent)" }} />
              </div>

              {/* Heading */}
              <h2 className="text-lg font-bold mb-1" style={{ color: textPri }}>
                Secure Your Passphrase to Continue
              </h2>
              <div
                className="rounded-xl px-4 py-3 mb-5"
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.30)",
                }}
              >
                <p className="text-sm font-bold uppercase tracking-wide mb-1.5" style={{ color: "rgba(239,68,68,0.90)" }}>
                  ⚠ Read this before you continue
                </p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(239,68,68,0.85)" }}>
                  This passphrase is your <strong style={{ color: "rgba(239,68,68,1)" }}>ONLY KEY</strong>. It is shown <strong style={{ color: "rgba(239,68,68,1)" }}>ONLY ONCE</strong> and is <strong style={{ color: "rgba(239,68,68,1)" }}>NEVER STORED</strong> by us or on your device.
                  <br />
                  If it is <strong style={{ color: "rgba(239,68,68,1)" }}>LOST</strong>, your vault <strong style={{ color: "rgba(239,68,68,1)" }}>CANNOT</strong> be <strong style={{ color: "rgba(239,68,68,1)" }}>ACCESSED</strong>—there is no recovery.
                </p>
              </div>

              {/* Passphrase display box */}
              <div
                className="rounded-xl px-4 py-3 mb-3 flex items-center justify-between gap-3"
                style={{
                  background: "var(--ui-input-bg)",
                  border: "1px solid var(--ui-input-border)",
                }}
              >
                <span
                  className="text-sm font-mono truncate flex-1 select-all min-w-0"
                  style={{ color: textPri, letterSpacing: "0.04em" }}
                >
                  {passphrase}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPassphrase}
                  className="shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80 active:scale-95"
                  style={{
                    background: copied ? "rgba(34,197,94,0.18)" : "var(--ui-accent-bg-copy)",
                    color: copied ? "#22c55e" : "var(--ui-accent)",
                    border: `1px solid ${copied ? "rgba(34,197,94,0.30)" : "var(--ui-accent-border)"}`,
                  }}
                >
                  {copied
                    ? <><Check className="h-3.5 w-3.5" /> Copied</>
                    : <><Copy className="h-3.5 w-3.5" /> Copy</>
                  }
                </button>
              </div>

              {/* Hint */}
              <p className="text-xs mb-6" style={{ color: textMuted }}>
                Keep it safe—in a password manager, a secure note, or somewhere only you can access.
              </p>

              {/* CTA */}
              <button
                type="button"
                onClick={handleOpenVault}
                className="w-full rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${accent}, ${accentWarm})` }}
              >
                I&apos;ve saved it — Open Vault
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

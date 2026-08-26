"use client";

import { usePathname } from "next/navigation";
import { ProfileBadge } from "./ProfileBadge";
import { ThemeTogglePill } from "./ThemeTogglePill";

export function AppBar() {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";
  const showThemeToggle = pathname === "/unlock" || isLandingPage;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-14 shrink-0 items-center justify-between border-b border-black/5 bg-white/70 px-5 backdrop-blur-xl dark:border-white/5 dark:bg-black/30"
      style={isLandingPage ? { fontFamily: "Georgia, 'Times New Roman', serif" } : undefined}
    >
      {/* ── Left: Brand ── */}
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-icon-v2-sm.png"
          alt="Wealth Vault icon"
          width={32}
          height={32}
          className="hidden dark:block shrink-0"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-icon-v1-sm.png"
          alt="Wealth Vault icon"
          width={32}
          height={32}
          className="block dark:hidden shrink-0"
        />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
          Wealth Vault
        </span>
      </div>

      {/* ── Right: Theme toggle + Profile badge ── */}
      <div className="flex items-center gap-4">
        {showThemeToggle && <ThemeTogglePill />}
        <ProfileBadge />
      </div>
    </header>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { ProfileBadge } from "./ProfileBadge";
import { ThemeTogglePill } from "./ThemeTogglePill";

export function AppBar() {
  const pathname = usePathname();
  const showThemeToggle = pathname === "/" || pathname === "/unlock";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-black/[.08] bg-white px-5 z-50 dark:border-white/[.08] dark:bg-[#0B0F1A]">
      {/* ── Left: Brand ── */}
      <div className="flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-icon-v2-sm.png"
          alt="Secure Wealth Vault icon"
          width={32}
          height={32}
          className="hidden dark:block shrink-0"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/app-icon-v1-sm.png"
          alt="Secure Wealth Vault icon"
          width={32}
          height={32}
          className="block dark:hidden shrink-0"
        />
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-slate-100">
          Secure Wealth Vault
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

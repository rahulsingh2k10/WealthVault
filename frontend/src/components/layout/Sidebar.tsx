"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  ChevronRight,
  ChevronUp,
  LogOut,
  Lock,
  Settings,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/context/MobileNavContext";
import { useLocale } from "@/context/LocaleContext";
import { ICON_MAP, type NavItemDto } from "@/i18n/navConfig";

// Plan product names — brand names kept as-is across locales (matches the
// upgrade picker's PLAN_NAME), so no i18n lookup is needed here.
const PLAN_NAMES: Record<string, string> = {
  FREE:      "Free",
  MONTHLY:   "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL:    "Sovereign",
};

interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  subscription?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { setTheme } = useTheme();
  const { t, country } = useLocale();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();

  const [user, setUser]                     = useState<UserInfo | null>(null);
  const [navItems, setNavItems]             = useState<NavItemDto[]>([]);
  const [navLoading, setNavLoading]         = useState(true);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const sheetRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => { if (data.user) setUser(data.user); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setNavLoading(true);
    fetch(`/api/nav?country=${encodeURIComponent(country)}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: NavItemDto[]) => setNavItems(data))
      .catch(() => {})
      .finally(() => setNavLoading(false));
  }, [country]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname, setMobileOpen]);

  // Close entire sheet on outside click
  useEffect(() => {
    if (!sheetOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setSheetOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sheetOpen]);

  const handleLockScreen = () => {
    setSheetOpen(false);
    router.push("/unlock");
  };

  const handleSignOut = async () => {
    setSheetOpen(false);
    // Sign-out drops the user's saved theme; fall back to the OS setting.
    // The DB preference is untouched and restored by PreferencesSync on next sign-in.
    setTheme("system");
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const subscriptionLabel = PLAN_NAMES[user?.subscription ?? "FREE"] ?? PLAN_NAMES.FREE;

  const resolvedNavItems = navItems.map((item) => ({
    href:  item.href,
    label: t.nav[item.labelKey as keyof typeof t.nav] ?? item.labelKey,
    icon:  ICON_MAP[item.iconName] ?? (() => null),
  }));

  return (
    <>
      {/* Backdrop — mobile drawer only */}
      <div
        onClick={() => setMobileOpen(false)}
        className={cn(
          "fixed inset-0 z-30 bg-black/40 lg:hidden",
          mobileOpen ? "block" : "hidden"
        )}
      />
      <aside
        className={cn(
          "fixed left-0 top-14 bottom-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform duration-200 dark:border-slate-800 dark:bg-slate-950",
          "lg:static lg:top-auto lg:bottom-auto lg:h-full lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-0.5 px-3">
          {navLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-3 rounded-md px-3 py-2">
                  <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                  <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 animate-pulse flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
                </li>
              ))
            : resolvedNavItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href as any}
                      className={cn(
                        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                      )}
                    >
                      <Icon className={cn(
                        "h-4 w-4 shrink-0",
                        active
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300"
                      )} />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />}
                    </Link>
                  </li>
                );
              })
          }
        </ul>
      </nav>

      {/* Profile row + popover */}
      <div className="relative border-t border-slate-200 dark:border-slate-800" ref={sheetRef}>

        {/* ── Main sheet popover ── */}
        {sheetOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <ul>
              <SheetItem
                icon={Settings}
                label={t.sidebar.settings}
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/settings");
                }}
              />

              <SheetItem
                icon={CreditCard}
                label={t.sidebar.subscription}
                onClick={() => {
                  setSheetOpen(false);
                  router.push("/subscription");
                }}
              />
            </ul>

            <ul className="border-t border-slate-100 dark:border-slate-800">
              <SheetItem
                icon={Lock}
                label={t.sidebar.lockScreen}
                onClick={handleLockScreen}
              />
              <SheetItem
                icon={LogOut}
                label={`${t.sidebar.logout} ${user?.name ?? ""}`}
                onClick={handleSignOut}
                danger
              />
            </ul>
          </div>
        )}

        {/* Profile row button */}
        <button
          onClick={() => setSheetOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {user?.name ?? "Loading…"}
            </p>
            <p className="truncate text-xs text-slate-400 dark:text-slate-500">{subscriptionLabel}</p>
          </div>

          <ChevronUp className={cn(
            "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
            sheetOpen ? "rotate-0" : "rotate-180"
          )} />
        </button>
      </div>
      </aside>
    </>
  );
}

function SheetItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        onClick={onClick}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
          danger
            ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </button>
    </li>
  );
}

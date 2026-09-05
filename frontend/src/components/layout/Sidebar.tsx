"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { ThemeTogglePill } from "./ThemeTogglePill";
import {
  ChevronRight,
  ChevronUp,
  LogOut,
  Lock,
  Settings,
  Languages,
  MapPin,
  CreditCard,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileNav } from "@/context/MobileNavContext";
import { useLocale } from "@/context/LocaleContext";
import { LOCALES, type Locale } from "@/i18n/translations";
import { COUNTRIES, countryFlag } from "@/i18n/countries";
import { ICON_MAP, type NavItemDto } from "@/i18n/navConfig";

// Plan product names — brand names kept as-is across locales (matches the
// upgrade picker's PLAN_NAME), so no i18n lookup is needed here.
const PLAN_NAMES: Record<string, string> = {
  FREE:      "Free",
  MONTHLY:   "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL:    "Sovereign",
};

type ActivePopover = "lang" | "country" | null;

interface UserInfo {
  name: string;
  email: string;
  avatar?: string;
  subscription?: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const { t, locale, setLocale, country, setCountry } = useLocale();
  const { open: mobileOpen, setOpen: setMobileOpen } = useMobileNav();

  const [user, setUser]                     = useState<UserInfo | null>(null);
  const [navItems, setNavItems]             = useState<NavItemDto[]>([]);
  const [navLoading, setNavLoading]         = useState(true);
  const [sheetOpen, setSheetOpen]           = useState(false);
  const [activePopover, setActivePopover]   = useState<ActivePopover>(null);
  const sheetRef   = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        setActivePopover(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [sheetOpen]);

  // Hover helpers — 120 ms delay prevents flicker when crossing the gap
  const openPopover = (name: ActivePopover) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setActivePopover(name);
  };
  const scheduleClose = (name: ActivePopover) => {
    hoverTimer.current = setTimeout(() => {
      setActivePopover((cur) => (cur === name ? null : cur));
    }, 120);
  };

  const handleLockScreen = () => {
    setSheetOpen(false);
    setActivePopover(null);
    router.push("/unlock");
  };

  const handleSignOut = async () => {
    setSheetOpen(false);
    setActivePopover(null);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  const handleSelectLocale = (code: Locale) => {
    setLocale(code);
    setActivePopover(null);
    setSheetOpen(false);
  };

  const handleSelectCountry = (code: string) => {
    setCountry(code);
    setActivePopover(null);
    setSheetOpen(false);
    router.push('/dashboard');
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  const subscriptionLabel = PLAN_NAMES[user?.subscription ?? "FREE"] ?? PLAN_NAMES.FREE;

  const selectedCountry = COUNTRIES.find((c) => c.code === country);

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

      {/* Profile row + popovers */}
      <div className="relative border-t border-slate-200 dark:border-slate-800" ref={sheetRef}>

        {/* ── Main sheet popover ── */}
        {sheetOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-1 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <ThemeTogglePill />
            </div>

            <ul>
              <SheetItem
                icon={Settings}
                label={t.sidebar.settings}
                onClick={() => setSheetOpen(false)}
              />

              {/* Language — hover trigger */}
              <HoverItem
                icon={Languages}
                label={t.sidebar.language}
                active={activePopover === "lang"}
                onEnter={() => openPopover("lang")}
                onLeave={() => scheduleClose("lang")}
              />

              {/* Country — hover trigger, shows current flag + code */}
              <HoverItem
                icon={MapPin}
                label={t.sidebar.country}
                badge={selectedCountry ? `${countryFlag(selectedCountry.code)} ${selectedCountry.code}` : undefined}
                active={activePopover === "country"}
                onEnter={() => openPopover("country")}
                onLeave={() => scheduleClose("country")}
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

        {/* ── Language popover ── independent, to the right of sidebar */}
        {sheetOpen && activePopover === "lang" && (
          <div
            className="absolute bottom-full left-full z-50 mb-1 ml-1 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onMouseEnter={() => openPopover("lang")}
            onMouseLeave={() => scheduleClose("lang")}
          >
            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t.sidebar.language}
              </p>
            </div>
            <ul className="overflow-y-auto py-1" style={{ maxHeight: "320px" }}>
              {LOCALES.map(({ code, native }) => (
                <li key={code}>
                  <button
                    onClick={() => handleSelectLocale(code)}
                    className={cn(
                      "flex w-full items-center gap-2 px-4 py-2 text-sm transition-colors",
                      locale === code
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="flex-1 text-left">{native}</span>
                    {locale === code && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ── Country popover ── independent, to the right of sidebar */}
        {sheetOpen && activePopover === "country" && (
          <div
            className="absolute bottom-full left-full z-50 mb-1 ml-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onMouseEnter={() => openPopover("country")}
            onMouseLeave={() => scheduleClose("country")}
          >
            <div className="border-b border-slate-100 px-4 py-2.5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t.sidebar.country}
              </p>
            </div>
            <ul className="overflow-y-auto py-1" style={{ maxHeight: "360px" }}>
              {COUNTRIES.map(({ code, name }) => (
                <li key={code}>
                  <button
                    onClick={() => handleSelectCountry(code)}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-1.5 text-sm transition-colors",
                      country === code
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400"
                        : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                    )}
                  >
                    <span className="text-base leading-none">{countryFlag(code)}</span>
                    <span className="w-7 shrink-0 text-xs font-mono text-slate-400 dark:text-slate-500">{code}</span>
                    <span className="flex-1 truncate text-left">{name}</span>
                    {country === code && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-500" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Profile row button */}
        <button
          onClick={() => {
            setSheetOpen((v) => !v);
            if (sheetOpen) setActivePopover(null);
          }}
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

// Row that opens a sub-popover on hover
function HoverItem({
  icon: Icon,
  label,
  badge,
  active,
  onEnter,
  onLeave,
}: {
  icon: React.ElementType;
  label: string;
  badge?: string;
  active: boolean;
  onEnter: () => void;
  onLeave: () => void;
}) {
  return (
    <li>
      <button
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-2 text-sm transition-colors",
          active
            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{label}</span>
        {badge && (
          <span className="text-xs text-slate-400 dark:text-slate-500">{badge}</span>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
    </li>
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

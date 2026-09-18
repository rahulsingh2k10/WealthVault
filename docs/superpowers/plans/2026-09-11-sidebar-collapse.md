# Sidebar Collapse (Icons-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapse/expand toggle to the sidebar that shrinks it to icons-only (with hover tooltips), leaving nav click behavior and everything else unchanged.

**Architecture:** A single new `collapsed` boolean in `Sidebar`'s local state, not persisted. A floating chevron button toggles it. The `<aside>`'s width class and a few conditional renders (nav item label/tooltip, loading skeleton, profile row) respond to it. `AppShell`'s flex layout already resizes the content area automatically when the sidebar's width class changes — no other file is touched.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript 5 (strict), Tailwind v3.3, `lucide-react`.

**Spec:** `docs/superpowers/specs/2026-09-11-sidebar-collapse-design.md`

---

## Context for the implementer

- Single file: `frontend/src/components/layout/Sidebar.tsx`. No other file changes.
- **No test harness** covers Sidebar rendering in this repo. Verification is `tsc` + manual, signed-in browser checks.
- Type-check: `cd frontend && npx tsc --noEmit`. There is a large pre-existing unrelated error backlog (baseline: 83) — the bar is **no new errors**, and the count should stay at 83.
- The file already has a `pendingHref`/active-highlight mechanism (from a recent fix) and a `sheetOpen` profile popover — both stay exactly as they are; this plan only adds the collapse behavior around them.
- `lg:static` → `lg:relative` on the `<aside>` is **required for correctness**, not a style choice: the new toggle button is `position: absolute`, and `position: static` doesn't establish a containing block, so the button would mis-position on desktop. Don't skip or "simplify away" this part.

---

## Task 1: Add the collapse toggle to `Sidebar.tsx`

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

### Current file (for reference — this is the full file today)

```tsx
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
  // Set synchronously on click, before Next's navigation resolves, so the
  // highlight moves immediately instead of waiting for the new route to
  // finish loading. Cleared the moment any navigation actually commits
  // (usePathname updates), whether that's this click, a different one, or
  // back/forward — so it never goes stale.
  const [pendingHref, setPendingHref]       = useState<string | null>(null);
  const sheetRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
                const effectivePath = pendingHref ?? pathname;
                const active = effectivePath === href || (href !== "/dashboard" && effectivePath.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href as any}
                      onClick={() => setPendingHref(href)}
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
```

- [ ] **Step 1: Replace the entire file**

Write `frontend/src/components/layout/Sidebar.tsx` with exactly this content:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import {
  ChevronLeft,
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
  // Set synchronously on click, before Next's navigation resolves, so the
  // highlight moves immediately instead of waiting for the new route to
  // finish loading. Cleared the moment any navigation actually commits
  // (usePathname updates), whether that's this click, a different one, or
  // back/forward — so it never goes stale.
  const [pendingHref, setPendingHref]       = useState<string | null>(null);
  // Icons-only mode. Local, not persisted — always starts expanded on load.
  const [collapsed, setCollapsed]           = useState(false);
  const sheetRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

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
          "fixed left-0 top-14 bottom-0 z-40 flex flex-col border-r border-slate-200 bg-white transition-all duration-200 dark:border-slate-800 dark:bg-slate-950",
          "lg:relative lg:top-auto lg:bottom-auto lg:h-full lg:translate-x-0",
          collapsed ? "w-20" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
      {/* Collapse/expand toggle */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-5 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-200", collapsed && "rotate-180")} />
      </button>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 scrollbar-thin">
        <ul className="space-y-0.5 px-3">
          {navLoading
            ? Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className={cn("flex items-center gap-3 rounded-md py-2", collapsed ? "justify-center px-2" : "px-3")}>
                  <div className="h-4 w-4 rounded bg-slate-200 dark:bg-slate-700 animate-pulse shrink-0" />
                  {!collapsed && (
                    <div className="h-3.5 rounded bg-slate-200 dark:bg-slate-700 animate-pulse flex-1" style={{ width: `${60 + (i % 3) * 15}%` }} />
                  )}
                </li>
              ))
            : resolvedNavItems.map(({ href, label, icon: Icon }) => {
                const effectivePath = pendingHref ?? pathname;
                const active = effectivePath === href || (href !== "/dashboard" && effectivePath.startsWith(href));
                return (
                  <li key={href}>
                    <Link
                      href={href as any}
                      onClick={() => setPendingHref(href)}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors",
                        collapsed ? "justify-center px-2" : "px-3",
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
                      {!collapsed && <span className="flex-1">{label}</span>}
                      {!collapsed && active && <ChevronRight className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400" />}
                      {collapsed && (
                        <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-slate-700">
                          {label}
                        </span>
                      )}
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
          className={cn(
            "flex w-full items-center text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60",
            collapsed ? "flex-col gap-1 px-2 py-3" : "gap-3 px-4 py-3"
          )}
        >
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {initials}
            </div>
          )}

          {collapsed ? (
            <span className="max-w-full truncate text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {subscriptionLabel}
            </span>
          ) : (
            <>
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
            </>
          )}
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
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "layout/Sidebar\.tsx" || echo "no new errors in Sidebar.tsx"`
Expected: `no new errors in Sidebar.tsx`

- [ ] **Step 3: Full project type-check against baseline**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c 'error TS'`
Expected: `83` (the pre-existing baseline — this change must not add or remove any other error).

- [ ] **Step 4: Sanity-check the diff**

Run (from repo root): `git diff -- frontend/src/components/layout/Sidebar.tsx`
Confirm: exactly one file changed; `handleLockScreen`, `handleSignOut`, `initials`, `subscriptionLabel`, `resolvedNavItems`, the two `useEffect`s for `user`/`navItems`, the `pendingHref` effect, the mobile backdrop, the `sheetOpen` popover block and its `SheetItem`s, and the `SheetItem` component itself are all byte-for-byte unchanged. Only the `<aside>` className, the new toggle button, the nav item/skeleton rendering, and the profile row button changed, plus the new `collapsed` state and the `ChevronLeft` import.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "Add sidebar collapse toggle (icons-only mode)

Floating chevron on the sidebar's border toggles between the full
240px sidebar and an 80px icons-only one, at every breakpoint. Nav
item clicks are unchanged; collapsed items show a hover tooltip.
Profile row shows avatar + plan name only when collapsed. State is
local and not persisted — always starts expanded. lg:static -> lg:relative
on the aside so the new absolutely-positioned toggle button anchors
correctly on desktop."
```

---

## Task 2: Manual verification

No code changes. `cd frontend && npm run dev`, sign in, unlock.

- [ ] **Step 1: Desktop collapse/expand**

Click the chevron on the sidebar's right edge. Sidebar animates 240px → 80px; the content area expands to fill the space (no gap, no overlap). Nav items show icon only, centered. Click the chevron again — expands back, labels return.

- [ ] **Step 2: Tooltip**

While collapsed, hover a nav icon — a small dark tooltip with its label appears to the right, disappears on mouse-out. Try this for at least 2 different items.

- [ ] **Step 3: Click behavior unchanged**

While collapsed, click a nav icon — navigates to that page exactly as before; the icon's background highlight updates immediately (unaffected by the earlier `pendingHref` fix).

- [ ] **Step 4: Profile row collapsed**

While collapsed: profile row shows avatar + plan name (e.g. "Free") stacked vertically, no full name, no chevron indicator. Click it — the same Settings/Subscription/Lock screen/Log out popover opens (anchored to the narrow column, extending over the content area — expected).

- [ ] **Step 5: Mobile**

Narrow the window below the `lg` breakpoint (or use device mode). Open the drawer via the header's hamburger button. Click the chevron inside the open drawer — same collapse/expand behavior. Close the drawer (backdrop click) and reopen it — collapse state persists across open/close (only resets on a full page reload).

- [ ] **Step 6: Reload resets**

Reload the page while collapsed — sidebar comes back expanded.

- [ ] **Step 7: Dark mode**

Toggle to dark mode (via `/settings`). Repeat Step 1 — toggle button, tooltip, and collapsed profile row are all themed correctly, nothing invisible or stuck light.

- [ ] **Step 8: Report**

Note anything off. A broken layout (content overlap, mispositioned toggle button) blocks; minor cosmetic nits get listed, not blocked.

---

## Self-review notes

- **Spec coverage:** toggle placement/behavior → toggle button + `collapsed` state; not persisted → plain `useState`, no `localStorage`/effect; applies at every breakpoint → width/collapse classes have no `lg:`-only gating; nav items icon-only + tooltip → conditional `span`/`ChevronRight` + tooltip block; profile row avatar+plan-name → conditional profile button body; popover quirk accepted as-is → popover block untouched; `lg:static`→`lg:relative` correctness fix → included in the `<aside>` className.
- **Type consistency:** `collapsed`/`setCollapsed` used consistently everywhere it's referenced; no new props, no changes to `SheetItem`'s signature or any function signature.
- **No placeholders:** the complete file is given in full in Step 1; every verification step has an exact command or exact manual action.

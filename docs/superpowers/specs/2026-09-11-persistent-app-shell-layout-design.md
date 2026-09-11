# Persistent App Shell Layout — Design

**Date:** 2026-09-11

## Problem

Every authenticated page (`dashboard`, `stocks`, `settings`, …) individually renders
`<AppShell title="...">{content}</AppShell>` inside its own `page.tsx`. `app/layout.tsx`
(the only layout in the app) does not contain `AppShell` — it only holds `ThemeProvider`,
`LocaleProvider`, `CurrencyProvider`, `AppBar`, `PreferencesSync`.

In the Next.js App Router, a `layout.tsx` persists across navigation between its child
routes; a `page.tsx` is unmounted and a new one mounted. Because `AppShell` (which
contains `Sidebar`, `Header`, `InactivityLock`, `WarmBackground`, `RenewalBanner`,
`MobileNavProvider`) lives in the page, **every sidebar click unmounts and remounts the
entire shell**:

- `Sidebar`'s `navItems`/`navLoading`/`user` are `useState`, reset on every mount →
  5 skeleton rows render, then `GET /api/nav?country=` refetches, then items appear;
  the profile row shows "Loading…" until `GET /api/auth/me` resolves again.
- `RenewalBanner` also re-fetches `/api/auth/me`.
- `InactivityLock` re-attaches its 6 window listeners and restarts its timer.

This was invisible before the `/api/nav` fix (the route 500'd, so the sidebar was
permanently empty — nothing to visibly "reload"). Now that it returns data, the
remount-refetch-skeleton cycle on every click is visible, which is the bug being fixed
here.

## Goal

Make `Sidebar`/`Header`/`InactivityLock`/`WarmBackground`/`RenewalBanner` mount **once**
and persist across navigation between all 20 authenticated pages, by moving `AppShell`
into a shared route-group layout. Clicking a sidebar item should only swap the page
content; no skeleton, no "Loading…", no refetch.

**Non-goals:**

- Changing any URL. Route groups (`(app)`) are invisible in the URL — `/dashboard`,
  `/stocks`, etc. are unaffected. No `href` anywhere (Sidebar, `nav_config`, links)
  changes.
- Translating the 20 page titles/subtitles (9 of the 20 subtitles are already
  hardcoded English, not run through `t.*`) — they move verbatim, not converted to i18n.
- Changing `middleware.ts` — its matcher is path-based, unaffected by the route group.
- Changing what data each of the 3 server pages (`dashboard`, `settings`, `subscription`)
  fetches — only the redundant guard line is removed.
- Fixing the pre-existing `getUpgradePromptData(session.userId)` type looseness
  (`userId` is `string | undefined` in `SessionData`) — unchanged from today; middleware
  guarantees it's set by the time any of these pages render.

---

## 1. New file: `frontend/src/app/(app)/layout.tsx`

```tsx
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { AppShell } from '@/components/layout/AppShell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  return <AppShell>{children}</AppShell>
}
```

This is the guard `settings`/`subscription` already use today (the strictest of the
three variants in the codebase). `dashboard` previously checked only `encryptionKey` —
middleware already requires both `userId` and `encryptionKey` for every one of these 20
routes, so this is not a behavioral change, just consolidation. The other 17 pages had
**no page-level guard at all**, relying solely on middleware; they now get the same
defensive check as the other 3, uniformly.

## 2. `frontend/src/components/layout/AppShell.tsx`

Drop the `title`/`subtitle` props (no longer threaded through — `Header` self-derives
them, see §3).

```tsx
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { InactivityLock } from "./InactivityLock";
import { WarmBackground } from "./WarmBackground";
import { RenewalBanner } from "@/components/subscription/RenewalBanner";
import { MobileNavProvider } from "@/context/MobileNavContext";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative mt-14 flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden" style={{ background: "var(--warm-page-bg)" }}>
      <InactivityLock />
      <WarmBackground />

      <MobileNavProvider>
        <div className="relative z-10 flex flex-1 overflow-hidden">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <RenewalBanner />
            <Header />
            <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {children}
            </main>
          </div>
        </div>
      </MobileNavProvider>
    </div>
  );
}
```

Only the `AppShellProps` interface and the `<Header title={title} subtitle={subtitle} />`
call change (→ `interface AppShellProps { children: React.ReactNode }` and `<Header />`).
Everything else in the file is byte-identical.

## 3. `frontend/src/components/layout/Header.tsx`

`Header` currently takes `title`/`subtitle` as props. It becomes self-sufficient,
deriving them from the current path — it is already `'use client'`.

Add a `PAGE_META` map with all 20 current `{title, subtitle}` pairs, copied verbatim from
each page's current `<AppShell title="..." subtitle="...">`:

```tsx
const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":           { title: "Dashboard" },
  "/stocks":              { title: "Stocks" },
  "/mutual-funds":        { title: "Mutual Funds", subtitle: "Index funds and active funds via Coin by Zerodha" },
  "/gold-commodities":    { title: "Gold & Commodities" },
  "/real-estate":         { title: "Real Estate" },
  "/crypto":              { title: "Cryptocurrency", subtitle: "CoinSwitch and WazirX holdings" },
  "/insurance":           { title: "Insurance" },
  "/cash-banking":        { title: "Cash & Banking" },
  "/liabilities":         { title: "Liabilities" },
  "/fixed-income":        { title: "Fixed Income" },
  "/government-schemes":  { title: "Government Schemes" },
  "/settings":            { title: "Settings" },
  "/subscription":        { title: "Manage Subscription" },
  "/bank":                { title: "Bank Accounts", subtitle: "Savings and current account balances" },
  "/fd-rd-ppf":           { title: "FD / RD / PPF", subtitle: "Fixed deposits, recurring deposits, and PPF accounts" },
  "/foreign":             { title: "Foreign Holdings", subtitle: "US stocks via IndMoney and Vested" },
  "/holdings":            { title: "Holdings", subtitle: "Indian equity positions" },
  "/nps":                 { title: "NPS", subtitle: "National Pension System — SBI Pension Fund (CDSL)" },
  "/others":              { title: "Others (LIC & Insurance)", subtitle: "Life insurance and other long-term investments" },
  "/post-office":         { title: "Post Office", subtitle: "KVP, NSC, and other post office schemes" },
}
```

Full file:

```tsx
"use client";

import { RefreshCw, Lock, Menu } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMobileNav } from "@/context/MobileNavContext";

const PAGE_META: Record<string, { title: string; subtitle?: string }> = {
  "/dashboard":           { title: "Dashboard" },
  "/stocks":              { title: "Stocks" },
  "/mutual-funds":        { title: "Mutual Funds", subtitle: "Index funds and active funds via Coin by Zerodha" },
  "/gold-commodities":    { title: "Gold & Commodities" },
  "/real-estate":         { title: "Real Estate" },
  "/crypto":              { title: "Cryptocurrency", subtitle: "CoinSwitch and WazirX holdings" },
  "/insurance":           { title: "Insurance" },
  "/cash-banking":        { title: "Cash & Banking" },
  "/liabilities":         { title: "Liabilities" },
  "/fixed-income":        { title: "Fixed Income" },
  "/government-schemes":  { title: "Government Schemes" },
  "/settings":            { title: "Settings" },
  "/subscription":        { title: "Manage Subscription" },
  "/bank":                { title: "Bank Accounts", subtitle: "Savings and current account balances" },
  "/fd-rd-ppf":           { title: "FD / RD / PPF", subtitle: "Fixed deposits, recurring deposits, and PPF accounts" },
  "/foreign":             { title: "Foreign Holdings", subtitle: "US stocks via IndMoney and Vested" },
  "/holdings":            { title: "Holdings", subtitle: "Indian equity positions" },
  "/nps":                 { title: "NPS", subtitle: "National Pension System — SBI Pension Fund (CDSL)" },
  "/others":              { title: "Others (LIC & Insurance)", subtitle: "Life insurance and other long-term investments" },
  "/post-office":         { title: "Post Office", subtitle: "KVP, NSC, and other post office schemes" },
};

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { open, setOpen } = useMobileNav();
  const { title, subtitle } = PAGE_META[pathname] ?? { title: "" };

  const handleLock = async () => {
    await fetch("/api/auth/lock", { method: "POST" });
    router.push("/unlock");
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setOpen(!open)}
          aria-label="Toggle navigation"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-50 leading-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-colors"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>

        <button
          className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400 transition-colors"
          onClick={handleLock}
        >
          <Lock className="h-3.5 w-3.5" />
          Lock
        </button>
      </div>
    </header>
  );
}
```

`HeaderProps` interface is removed (no more props). Every route in `PAGE_META` is one of
the 20 pages being moved, so the `?? { title: "" }` fallback should never actually be hit
in practice — it's defensive only.

## 4. Move all 20 page directories into the route group

`git mv` each of these from `frontend/src/app/<x>/` to `frontend/src/app/(app)/<x>/`
(directory contents unchanged by the move itself — only the edits in §5 below change
file contents):

`bank`, `cash-banking`, `crypto`, `dashboard`, `fd-rd-ppf`, `fixed-income`, `foreign`,
`gold-commodities`, `government-schemes`, `holdings`, `insurance`, `liabilities`,
`mutual-funds`, `nps`, `others`, `post-office`, `real-estate`, `settings`, `stocks`,
`subscription` (20 directories — `settings` and `subscription` included).

`app/page.tsx` (landing, `/`) and `app/unlock/page.tsx` are **not** moved — they don't
use `AppShell` and stay outside the guarded group.

## 5. Edit each moved page

### 5a. The 3 server-component pages — remove the guard, keep data fetching

**`(app)/dashboard/page.tsx`** — from:
```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.encryptionKey) redirect('/unlock')

  const prompt = await getUpgradePromptData(session.userId)

  return (
    <AppShell title="Dashboard">
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </AppShell>
  )
}
```
to:
```tsx
import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'

export default async function DashboardPage() {
  const session = await getSession()
  const prompt = await getUpgradePromptData(session.userId)

  return (
    <>
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </>
  )
}
```

**`(app)/settings/page.tsx`** — from:
```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { SettingsPanel } from '@/components/settings/SettingsPanel'

export default async function SettingsPage() {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  return (
    <AppShell title="Settings">
      <SettingsPanel />
    </AppShell>
  )
}
```
to:
```tsx
import { SettingsPanel } from '@/components/settings/SettingsPanel'

export default function SettingsPage() {
  return <SettingsPanel />
}
```
(No `getSession()` call needed at all — the page used it only for the guard.)

**`(app)/subscription/page.tsx`** — from:
```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { getUpgradePromptData, listAllPlanCards } from '@/lib/services/UpgradePromptService'
import { buildManageView, listPaidPlansForChange } from '@/lib/services/SubscriptionService'
import { ManageSubscription } from '@/components/subscription/ManageSubscription'
import { FreeTierUpgradePanel } from '@/components/subscription/FreeTierUpgradePanel'

export default async function SubscriptionPage() {
  const session = await getSession()
  if (!session.encryptionKey || !session.userId) redirect('/unlock')

  const [view, prompt, planCards] = await Promise.all([
    buildManageView(session.userId),
    getUpgradePromptData(session.userId),
    listAllPlanCards(),
  ])

  return (
    <AppShell title="Manage Subscription">
      {view.tier === 'FREE' ? (
        prompt ? (
          <FreeTierUpgradePanel plans={prompt.plans} memberCount={prompt.memberCount} />
        ) : (
          <p className="text-sm text-[color:var(--ui-text-muted)]">
            We couldn&apos;t load upgrade plans right now. Please refresh the page.
          </p>
        )
      ) : (
        <ManageSubscription view={view} paidPlans={await listPaidPlansForChange()} planCards={planCards} />
      )}
    </AppShell>
  )
}
```
to (only the guard line removed, `<AppShell title="...">`/`</AppShell>` → `<>`/`</>`,
everything else byte-identical):
```tsx
import { getSession } from '@/lib/session'
import { getUpgradePromptData, listAllPlanCards } from '@/lib/services/UpgradePromptService'
import { buildManageView, listPaidPlansForChange } from '@/lib/services/SubscriptionService'
import { ManageSubscription } from '@/components/subscription/ManageSubscription'
import { FreeTierUpgradePanel } from '@/components/subscription/FreeTierUpgradePanel'

export default async function SubscriptionPage() {
  const session = await getSession()

  const [view, prompt, planCards] = await Promise.all([
    buildManageView(session.userId),
    getUpgradePromptData(session.userId),
    listAllPlanCards(),
  ])

  return (
    <>
      {view.tier === 'FREE' ? (
        prompt ? (
          <FreeTierUpgradePanel plans={prompt.plans} memberCount={prompt.memberCount} />
        ) : (
          <p className="text-sm text-[color:var(--ui-text-muted)]">
            We couldn&apos;t load upgrade plans right now. Please refresh the page.
          </p>
        )
      ) : (
        <ManageSubscription view={view} paidPlans={await listPaidPlansForChange()} planCards={planCards} />
      )}
    </>
  )
}
```

### 5b. The 17 client-component pages — mechanical unwrap only

`bank`, `cash-banking`, `crypto`, `fd-rd-ppf`, `fixed-income`, `foreign`,
`gold-commodities`, `government-schemes`, `holdings`, `insurance`, `liabilities`,
`mutual-funds`, `nps`, `others`, `post-office`, `real-estate`, `stocks`.

Each currently has the shape:
```tsx
'use client'

import { AppShell } from '@/components/layout/AppShell'
// ...other imports

export default function XPage() {
  // ...hooks/state, unchanged
  return (
    <AppShell title="..." subtitle="...">
      {/* one or more elements */}
    </AppShell>
  )
}
```

Transform, **and nothing else**:
1. Delete the `import { AppShell } from '@/components/layout/AppShell'` line.
2. Delete the opening `<AppShell title="..." ...>` tag and its matching closing
   `</AppShell>` tag.
3. If the JSX between them was more than one top-level element (it is, in every one of
   these 17 files — a banner/table/modal sequence), wrap what remains in a Fragment
   (`<>` / `</>`) so the component still returns a single root node. If it was already a
   single element, no fragment is needed.
4. Nothing else in the file changes — no hook, state, other import, or JSX inside the
   former `<AppShell>` body is touched.

---

## 6. Verification

No automated test covers page-level rendering/layout. Verification is `tsc` + manual:

1. `cd frontend && npx tsc --noEmit` — no new errors in any of the 20 pages,
   `AppShell.tsx`, `Header.tsx`, or the new `(app)/layout.tsx`. (Large pre-existing
   unrelated backlog — ignore it.)
2. `grep -rn "AppShell" frontend/src --include='*.tsx'` — the only matches left are the
   definition (`components/layout/AppShell.tsx`) and its one usage
   (`app/(app)/layout.tsx`).
3. Dev server: every one of the 20 routes still resolves at its original URL
   (`/dashboard`, `/stocks`, …) — route groups don't change routing. Unauthenticated →
   redirected to `/` or `/unlock` exactly as before (middleware unchanged).
4. **Manual, signed in:** click through several sidebar items in a row. The sidebar and
   header no longer flash a skeleton / "Loading…" on any click — only the content area
   changes. Header title/subtitle update correctly per page (compare against the table in
   §3). Lock/Refresh buttons in the header still work. The inactivity lock still fires
   after idling on any page.
5. Sign out from the sidebar while on a non-dashboard page — still works (session
   destroyed, redirected to `/`).

---

## Data flow (before / after)

```mermaid
flowchart LR
    subgraph before["Before — AppShell per page"]
      P1["dashboard/page.tsx\n<AppShell><Sidebar/></AppShell>"] -->|click| P2["stocks/page.tsx\n<AppShell><Sidebar/></AppShell>"]
      P2 -.unmount/remount.-> P1
    end
    subgraph after["After — AppShell in layout"]
      L["(app)/layout.tsx\n<AppShell><Sidebar/></AppShell>\n(mounts once)"] --> D["dashboard/page.tsx\n(content only)"]
      L --> S["stocks/page.tsx\n(content only)"]
      D -->|click, only {children} swaps| S
    end
```

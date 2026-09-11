# Persistent App Shell Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move `AppShell` (Sidebar/Header/InactivityLock/WarmBackground/RenewalBanner) out of each of the 20 authenticated pages and into a shared route-group layout, so it mounts once and persists across navigation instead of remounting (skeleton flash + refetch) on every sidebar click.

**Architecture:** A new `app/(app)/layout.tsx` does the session guard once and renders `<AppShell>{children}</AppShell>`. All 20 authenticated page directories move under `app/(app)/` (route groups are invisible in the URL — no route changes). Each page drops its own `<AppShell>` wrapper; the 3 server-component pages also drop their now-redundant guard. `Header` stops taking `title`/`subtitle` props and derives them itself from `usePathname()`.

**Tech Stack:** Next.js 14.1 App Router, React 18, TypeScript 5 (strict).

**Spec:** `docs/superpowers/specs/2026-09-11-persistent-app-shell-layout-design.md`

---

## Context for the implementer

- Work from `frontend/` unless noted.
- **20 authenticated pages today, all importing `AppShell`:** `bank`, `cash-banking`, `crypto`, `dashboard`, `fd-rd-ppf`, `fixed-income`, `foreign`, `gold-commodities`, `government-schemes`, `holdings`, `insurance`, `liabilities`, `mutual-funds`, `nps`, `others`, `post-office`, `real-estate`, `settings`, `stocks`, `subscription`. Of these, **3 are server components with their own session guard** (`dashboard`, `settings`, `subscription`) and **17 are `'use client'` with no guard** (rely on `middleware.ts` alone).
- `app/page.tsx` (landing) and `app/unlock/page.tsx` do **not** use `AppShell` — leave them exactly where they are, outside the route group.
- Route groups (`(app)`) never appear in the URL. `git mv src/app/stocks src/app/\(app\)/stocks` still serves `/stocks`. No `href` anywhere (Sidebar links, `nav_config` rows, `router.push` calls) needs to change.
- Type-check: `cd frontend && npx tsc --noEmit`. Large pre-existing unrelated backlog (~83 errors) — the bar is **no new errors** in files this plan touches.
- No automated test covers page-level layout/rendering. Verification is `tsc` + structural greps + a manual click-through (last task, needs a signed-in browser).
- Commit after each task. End every commit message with a blank line then exactly:
  `Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx`

---

## Task 1: New layout + `AppShell`/`Header` changes

**Files:**
- Create: `frontend/src/app/(app)/layout.tsx`
- Modify: `frontend/src/components/layout/AppShell.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`

- [ ] **Step 1: Create `frontend/src/app/(app)/layout.tsx`**

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

- [ ] **Step 2: Replace `frontend/src/components/layout/AppShell.tsx`**

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

- [ ] **Step 3: Replace `frontend/src/components/layout/Header.tsx`**

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

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "app/\(app\)/layout\.tsx|layout/AppShell\.tsx|layout/Header\.tsx"`
Expected: **errors will appear** at this point — every one of the 20 pages still does `<AppShell title="...">`, which no longer accepts a `title` prop, and `AppShell` isn't used anywhere yet from `(app)/layout.tsx` since the pages haven't moved. This is expected and resolved by Tasks 2–4. Confirm the errors are exactly "does not exist on type 'AppShellProps'"-style (prop mismatch), not a syntax error in the 3 files you just wrote.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)/layout.tsx" frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Header.tsx
git commit -m "$(printf 'Add (app) route-group layout; AppShell/Header stop taking title props\n\nHeader now derives title/subtitle from usePathname() via a PAGE_META map\n(all 20 current title/subtitle pairs, moved verbatim). AppShell drops the\ntitle/subtitle passthrough. The 20 pages still reference the old AppShell\nsignature until Tasks 2-4 move and update them -- expected transient\ntype errors until then.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 2: Move the 20 page directories into `(app)/`

**Files:** moves only, no content edits.

- [ ] **Step 1: Move each directory with `git mv`**

Run from `frontend/src/app/`:

```bash
cd frontend/src/app
mkdir -p "(app)"
for d in bank cash-banking crypto dashboard fd-rd-ppf fixed-income foreign gold-commodities government-schemes holdings insurance liabilities mutual-funds nps others post-office real-estate settings stocks subscription; do
  git mv "$d" "(app)/$d"
done
```

- [ ] **Step 2: Verify**

```bash
ls "frontend/src/app/(app)/" | wc -l   # expect 20
ls frontend/src/app | grep -vE '^\(app\)$|^page\.tsx$|^unlock$|^api$|^layout\.tsx$|^globals\.css$|^favicon|^settings\.ts$'
```
The second command should print nothing unexpected — only `(app)`, `page.tsx`, `unlock`, `api`, `layout.tsx`, and non-route files (e.g. `globals.css`) should remain directly under `src/app`.

- [ ] **Step 3: Commit the move by itself (no content changes)**

```bash
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/WealthVault/develop/WealthVault
git add -A
git status --short   # confirm every line is a rename (R), nothing else
git commit -m "$(printf 'Move the 20 authenticated pages into the (app) route group\n\nPure directory move -- route groups do not appear in the URL, so every\nroute (/dashboard, /stocks, ...) is unchanged. No file contents touched;\nAppShell wrapper removal happens in Tasks 3-4.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 3: Edit the 3 server-component pages

**Files:**
- Modify: `frontend/src/app/(app)/dashboard/page.tsx`
- Modify: `frontend/src/app/(app)/settings/page.tsx`
- Modify: `frontend/src/app/(app)/subscription/page.tsx`

- [ ] **Step 1: Replace `(app)/dashboard/page.tsx`**

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

- [ ] **Step 2: Replace `(app)/settings/page.tsx`**

```tsx
import { SettingsPanel } from '@/components/settings/SettingsPanel'

export default function SettingsPage() {
  return <SettingsPanel />
}
```

- [ ] **Step 3: Replace `(app)/subscription/page.tsx`**

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

- [ ] **Step 4: Type-check just these three**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "\(app\)/(dashboard|settings|subscription)/page\.tsx"`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)/dashboard/page.tsx" "frontend/src/app/(app)/settings/page.tsx" "frontend/src/app/(app)/subscription/page.tsx"
git commit -m "$(printf 'Drop AppShell wrapper + redundant guard from the 3 server pages\n\nThe (app) layout now guards and renders AppShell; these pages return\ntheir content directly. settings needs no session at all any more.\ndashboard/subscription keep getSession() only for session.userId.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 4: Edit the 17 client-component pages

**Files** (all under `frontend/src/app/(app)/`): `bank/page.tsx`, `cash-banking/page.tsx`,
`crypto/page.tsx`, `fd-rd-ppf/page.tsx`, `fixed-income/page.tsx`, `foreign/page.tsx`,
`gold-commodities/page.tsx`, `government-schemes/page.tsx`, `holdings/page.tsx`,
`insurance/page.tsx`, `liabilities/page.tsx`, `mutual-funds/page.tsx`, `nps/page.tsx`,
`others/page.tsx`, `post-office/page.tsx`, `real-estate/page.tsx`, `stocks/page.tsx`.

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

- [ ] **Step 1: For each of the 17 files, apply this exact transform and nothing else**

1. Delete the `import { AppShell } from '@/components/layout/AppShell'` line.
2. Delete the opening `<AppShell title="..." ...>` tag and its matching closing
   `</AppShell>` tag (the `title`/`subtitle` strings on that tag are discarded here —
   they already live in `Header.tsx`'s `PAGE_META` from Task 1).
3. The JSX that was between them has more than one top-level element in every one of
   these 17 files (a banner/table/modal sequence) — wrap what remains in a Fragment
   (`<>` / `</>`) so the component still returns a single root node.
4. Touch nothing else: no hook, state, other import, or JSX inside the former
   `<AppShell>` body changes.

Read each file before editing it (don't guess its current contents from another file —
they differ inside the body).

- [ ] **Step 2: Type-check all 17**

Run:
```
cd frontend && npx tsc --noEmit 2>&1 | grep -E '\(app\)/(bank|cash-banking|crypto|fd-rd-ppf|fixed-income|foreign|gold-commodities|government-schemes|holdings|insurance|liabilities|mutual-funds|nps|others|post-office|real-estate|stocks)/page\.tsx'
```
Expected: no output.

- [ ] **Step 3: Confirm no stray `AppShell` references remain anywhere**

Run: `grep -rn "AppShell" frontend/src --include='*.tsx'`
Expected exactly two matches: the definition in `components/layout/AppShell.tsx` and the
one usage in `app/(app)/layout.tsx`. If any page still mentions `AppShell`, Step 1 was
missed for that file — fix it before continuing.

- [ ] **Step 4: Full project type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c 'error TS'`
Expected: **at or below** the pre-existing baseline of 83 (no new errors introduced by
this whole plan, across all four tasks).

- [ ] **Step 5: Commit**

```bash
git add "frontend/src/app/(app)"
git commit -m "$(printf 'Drop the AppShell wrapper from the 17 client-component pages\n\nMechanical unwrap: remove the AppShell import and its opening/closing\ntags, wrap the remaining JSX in a Fragment. No hook, state, or other\nimport touched in any of the 17 files.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 5: Verification

- [ ] **Step 1: Dev server boots and every route still resolves**

```bash
cd frontend && npm run dev &
sleep 8
for p in / /unlock /dashboard /stocks /mutual-funds /gold-commodities /real-estate /crypto /insurance /cash-banking /liabilities /fixed-income /government-schemes /settings /subscription /bank /fd-rd-ppf /foreign /holdings /nps /others /post-office; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000$p")
  echo "$p -> $code"
done
```
Expected: `/` → 200. `/unlock` → 200 or a redirect (no session cookie in this curl, so
middleware may redirect it — same as before this plan). Every other path → a redirect
status (307) to `/` or `/unlock` (no session cookie) — **not** a 404 and **not** a 500.
A 404 on any of these means the route-group move broke that route. Stop the dev server
after (`kill %1` or find the process by port).

- [ ] **Step 2: Manual, signed in — the actual bug this plan fixes**

Sign in, unlock, land on `/dashboard`. Click through several different sidebar items in a
row (e.g. Stocks → Settings → Fixed Income → Dashboard). Confirm:
- The sidebar and its profile row **never** show a skeleton or "Loading…" after the first
  page load — only the `<main>` content area changes.
- The header title/subtitle update correctly per page (cross-check a few against the
  `PAGE_META` table in Task 1 Step 3).
- Refresh and Lock buttons in the header still work.
- The sidebar profile menu (Settings / Subscription / Lock screen / Log out) still opens
  and each item still navigates correctly.
- Idle on any page past the inactivity timeout — still redirects to `/unlock`.
- Sign out from a non-dashboard page — still works.

- [ ] **Step 3: Report**

Note anything off. A 404/500 on any route, or the skeleton still flashing, blocks —
don't close this out until both are clean.

---

## Self-review notes

- **Spec coverage:** new layout + guard consolidation → Task 1 Step 1; `AppShell`/`Header`
  changes → Task 1 Steps 2–3; directory move → Task 2; the 3 server pages → Task 3; the
  17 client pages → Task 4; verification (routes + the actual reported bug) → Task 5.
- **Count check (fixed during spec self-review, carried here):** 20 pages total = 3
  server (`dashboard`, `settings`, `subscription`) + 17 client. Both file lists (Task 4's
  header and Task 5's curl loop) enumerate all 20/17 by name — recount them against this
  line if anything is ever added or removed here.
- **Ordering:** Task 1 intentionally leaves the build in a transiently-broken type state
  (documented in its Step 4) until Tasks 2–4 land — this is a deliberate sequencing
  choice (plumbing first, mechanical moves after), not a mistake; do not "fix" it by
  reordering.
- **Known deviation from full-code-every-step:** Task 4 gives an algorithm instead of
  transcribing all 17 files' current content, because the files are heterogeneous
  page bodies (only their `AppShell` wrapper is identical) and this transform is
  mechanical and self-verifying (Steps 2–4 catch any miss via tsc + a repo-wide grep).
  The implementer must still *read* each file before editing it — the algorithm is not
  a license to guess.

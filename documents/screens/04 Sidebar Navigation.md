# Screen: Sidebar Navigation

Not a route of its own — this is the persistent left-hand navigation rendered around
every authenticated page (`/dashboard`, `/stocks`, `/settings`, … — the full list is in
`documents/database/nav-config.md`). Documented separately from those pages because it
carries its own state machine (collapse, active-item highlight, the profile popover) and
its own API call (`GET /api/nav`), independent of whatever page happens to be showing.

---

## 1. Overview

The sidebar has three regions, top to bottom: a **collapse toggle** floating on its right
border, the **nav list** (country-driven — see `documents/api/nav-api.md`), and a
**profile row** that opens a small popover menu (Settings, Subscription, Lock screen,
Log out). On screens narrower than the `lg` breakpoint it becomes an off-canvas drawer
instead of a static column.

It mounts **once** per session, not once per page. See §3 for why that matters.

---

## 2. File Map

| File | Role |
|------|------|
| `src/components/layout/Sidebar.tsx` | The whole component — nav list, collapse, profile popover, mobile drawer. `'use client'`. |
| `src/app/(app)/layout.tsx` | Renders `<AppShell>`, which renders `<Sidebar />`, once for the whole `(app)` route group — not per page. |
| `src/components/layout/AppShell.tsx` | Page chrome: `Sidebar` + `Header` + scrollable `<main>` on the warm background. |
| `src/components/layout/Header.tsx` | Top bar; its mobile hamburger button opens/closes the sidebar drawer via `MobileNavContext`. |
| `src/context/MobileNavContext.tsx` | `{ open, setOpen }` — whether the off-canvas drawer is open. Read by `Sidebar`, written by `Header`'s hamburger and by `Sidebar` itself (backdrop click, route change). |
| `src/context/LocaleContext.tsx` | Source of `country`, which the nav-fetch effect depends on. |
| `src/app/api/nav/route.ts` | `GET /api/nav?country=` — documented in `documents/api/nav-api.md`. |
| `src/i18n/navConfig.ts` | `ICON_MAP` (icon name → component) and the `NavItemDto` type. |
| `src/i18n/translations.ts` | `t.nav.*` (item labels, by language) and `t.sidebar.*` (profile-menu labels). |
| `src/app/api/auth/me/route.ts` | `GET /api/auth/me` — feeds the profile row's name/avatar/plan. |

---

## 3. Why it's documented separately from the pages

Before the `(app)` route-group layout existed, every page rendered its own `<AppShell>`,
so the sidebar **unmounted and remounted on every navigation** — every click re-fetched
`/api/nav` and `/api/auth/me` from empty state, showing a skeleton and "Loading…" each
time. That's fixed: `AppShell` now lives in `src/app/(app)/layout.tsx`, which the App
Router keeps mounted across navigation between its child routes — only the page content
inside `<main>` swaps. `Sidebar`'s `useState`/`useEffect` calls run once per session, not
once per click. (Full history: `docs/superpowers/specs/2026-09-11-persistent-app-shell-layout-design.md`.)

---

## 4. Component Hierarchy

```
(app)/layout.tsx                                   [server: session guard]
└── AppShell
    ├── Sidebar                                     ['use client', mounts once]
    │   ├── mobile backdrop  (div, lg:hidden)
    │   └── <aside>  (w-60 expanded / w-20 collapsed)
    │       ├── collapse toggle button (ChevronLeft, floats on the border)
    │       ├── <nav>
    │       │   └── nav item list  — OR 5 skeleton rows while navLoading
    │       └── profile row + popover
    │           ├── popover (sheetOpen)
    │           │    ├── SheetItem  Settings      → router.push('/settings')
    │           │    ├── SheetItem  Subscription  → router.push('/subscription')
    │           │    ├── SheetItem  Lock screen   → handleLockScreen
    │           │    └── SheetItem  Log out       → handleSignOut
    │           └── profile button (avatar, name/plan or just plan, chevron)
    ├── Header                                      [mobile hamburger toggles MobileNavContext]
    └── <main>{page content}</main>
```

---

## 5. State

| State | Type | Purpose |
|---|---|---|
| `user` | `UserInfo \| null` | From `GET /api/auth/me`, fetched once on mount |
| `navItems` | `NavItemDto[]` | From `GET /api/nav?country=`, refetched whenever `country` changes |
| `navLoading` | `boolean` | Drives the 5-row skeleton while the nav fetch is in flight |
| `sheetOpen` | `boolean` | Profile popover open/closed |
| `pendingHref` | `string \| null` | The just-clicked nav item's `href`, used to highlight it **immediately** — see §7 |
| `collapsed` | `boolean` | Icons-only mode. Local, **not persisted** — always starts expanded on load |
| `mobileOpen` / `setMobileOpen` | from `useMobileNav()` | Off-canvas drawer open/closed (shared with `Header`) |

---

## 6. Sub-flows

### 6.1 Load

```
Sidebar mounts (once, in the (app) layout)
  │
  ├── GET /api/auth/me → user
  │
  └── GET /api/nav?country=<LocaleContext.country> → navItems
        (re-runs whenever `country` changes, e.g. after a /settings change)
```

### 6.2 Click a nav item

```
User clicks a nav item's <Link>
  │
  ▼
onClick: setPendingHref(href)         ← synchronous, before Next's navigation resolves
  │
  ▼
Item highlights immediately (active = pendingHref ?? pathname)
  │
  ▼ (independently) Next.js navigates; usePathname() updates once it commits
  │
  ▼
useEffect([pathname]): setPendingHref(null)   ← clears once any navigation commits,
                                                 whether this click, a different one
                                                 clicked in the meantime, or back/forward
```

Without this, the highlight would only move once the new page finished loading — the
same instant the content itself changed — rather than responding to the click. Second
click before the first resolves: `pendingHref` just gets overwritten; Next's router
already aborts a superseded in-flight navigation on its own, no code needed for that
part.

### 6.3 Collapse / expand

```
User clicks the ChevronLeft toggle (floats on the sidebar's right border)
  │
  ▼
setCollapsed(v => !v)
  │
  ├── aside width: w-60 ↔ w-20 (animated)
  ├── nav items: label + active-chevron hidden; icon centered; hover shows a tooltip
  ├── loading skeleton: text bar hidden, icon-block only
  └── profile row: switches to a vertical stack — avatar + plan name only,
      full name and the popover chevron hidden
```

Applies at every breakpoint (desktop and inside the open mobile drawer alike) —
independent of `mobileOpen`, which only controls whether the drawer is on/off screen.
Not persisted: a reload always starts expanded.

### 6.4 Profile popover

```
User clicks the profile row → setSheetOpen(v => !v)
  │
  ▼
Popover opens (always full-width, 240px, even when the sidebar itself is collapsed —
  anchored to the narrow column, extending over the content area)
  │
  ├── Settings      → close popover, router.push('/settings')      — see 03 Settings.md
  ├── Subscription  → close popover, router.push('/subscription')
  ├── Lock screen   → close popover, router.push('/unlock')  (no /api/auth/lock call here —
  │                    that's Header's separate Lock button; this one just navigates)
  └── Log out       → close popover, setTheme('system'), POST /api/auth/signout,
                       router.push('/'), router.refresh()
```

Closes on outside click (`mousedown` listener while `sheetOpen`) and on any route change.
The Settings and Subscription entry points, and the sign-out theme reset, are the same
mechanisms documented in `documents/screens/03 Settings.md` and
`docs/superpowers/specs/2026-09-09-signout-theme-reset-design.md` — not repeated here.

### 6.5 Mobile drawer

```
< lg breakpoint:
  aside is position:fixed, off-screen (-translate-x-full) by default
  Header's hamburger → setMobileOpen(true) → aside slides in (translate-x-0),
    backdrop appears (bg-black/40, lg:hidden)
  Backdrop click, or any route change (useEffect([pathname])) → setMobileOpen(false)
```

`collapsed` (icons-only) and `mobileOpen` (drawer on/off screen) are independent booleans
— collapsing the drawer while it's open doesn't close it, and closing it doesn't reset
collapse.

---

## 7. Data flow

```mermaid
flowchart TD
    M["Sidebar mounts (once, in (app)/layout.tsx)"] -->|"GET /api/auth/me"| U[user]
    M -->|"GET /api/nav?country=X"| N[navItems]
    LC["LocaleContext.country changes\n(e.g. via /settings)"] -->|"GET /api/nav?country=X"| N

    N --> R["resolvedNavItems:\nhref, t.nav[labelKey], ICON_MAP[iconName]"]
    R --> UI[Rendered nav list]

    click["User clicks a nav Link"] --> PH["setPendingHref(href)\n(highlight moves now)"]
    click --> NAV["Next.js navigation"]
    NAV --> PATH["usePathname() updates on commit"]
    PATH --> CLR["pendingHref cleared"]
```

---

## 8. Theme pattern

Same as the rest of the app — the shared `--ui-*` / dark-class tokens, but note the
sidebar itself is styled with plain Tailwind `slate`/`indigo` utilities and `dark:`
variants (`bg-white dark:bg-slate-950`, `text-indigo-700 dark:text-indigo-400`, …) rather
than the `--ui-*` CSS custom properties used on `/settings`, `/subscription`, `/`, and
`/unlock`. This predates the `--ui-*` token system and hasn't been migrated.

---

## 9. Known issues / notes

- **The sidebar's "Lock screen" menu item doesn't actually lock the vault.** It only
  navigates to `/unlock` (`router.push`) — unlike `Header`'s separate **Lock** button,
  which first `POST`s `/api/auth/lock` to clear `session.encryptionKey`, then navigates.
  Since this popover item skips that call, `session.encryptionKey` stays valid: the user
  sees the passphrase screen, but any authenticated URL they visit directly (or navigate
  back to) still works without re-entering it — middleware only checks whether
  `encryptionKey` is present, not whether `/unlock` was shown. Pre-existing behavior, not
  introduced by this doc's changes.
- **Only India is configured.** `nav_config` has rows for `country = 'IN'` only; every
  other country falls back to India's list (see `documents/api/nav-api.md`). The
  `/settings` Country picker only offers India today, so this is currently unreachable
  in practice, not a bug.
- **Popover anchor at narrow width** is an accepted quirk, not a bug — see
  `docs/superpowers/specs/2026-09-11-sidebar-collapse-design.md` §6.
- **Collapse state is not persisted** — a deliberate choice (see the same spec), not an
  oversight.
- **Styling predates `--ui-*` tokens** (§8) — flagged for awareness, not scheduled for
  change here.

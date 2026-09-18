# Screen: Sidebar Navigation

Not a route of its own — this is the persistent left-hand navigation rendered around
every authenticated page (`/dashboard`, `/stocks`, `/settings`, … — the full list is in
`documents/database/nav-config.md`). Documented separately from those pages because it
carries its own state (nav list, hover/tap reveal, the signed-in user's identity) and its
own API calls (`GET /api/nav`, `GET /api/auth/me`), independent of whatever page happens
to be showing.

---

## 1. Overview

The sidebar is a **floating overlay**, not a column that reserves layout space: it sits on
top of the page content (`AppShell` renders it before `<main>`, both absolutely
positioned) rather than pushing it aside. It has two stacked groups of **pills** — small
pill-shaped buttons/links that sit mostly off-canvas at rest (only the icon peeks out past
the left edge) and slide fully into view on hover or tap:

- **Category pills** (top) — one per `nav_config` row for the user's country, in
  `sortOrder` — see `documents/api/nav-api.md`.
- **Account pills** (bottom, closest to the screen edge first) — **Log out**, then the
  **identity pill** (avatar + name, no action), then **Settings**, then **Subscription**.

There is no collapse toggle, no profile popover/menu, and no separate mobile drawer —
every pill behaves the same way at every viewport width: icon-only at rest, expanded on
hover (desktop) or first tap (touch).

It mounts **once** per session, not once per page. See §3 for why that matters.

---

## 2. File Map

| File | Role |
|------|------|
| `src/components/layout/Sidebar.tsx` | The whole component — `Pill`/`PillSkeleton`, nav-item fetch, hover/tap-reveal state, sign-out. `'use client'`. |
| `src/app/(app)/layout.tsx` | Renders `<AppShell>`, which renders `<Sidebar />`, once for the whole `(app)` route group — not per page. |
| `src/components/layout/AppShell.tsx` | Page chrome: floating `Sidebar` overlay + `Header` + scrollable `<main>` on the warm background. |
| `src/components/layout/Header.tsx` | Top bar (page title + Refresh/Lock buttons). No longer has any sidebar/mobile-nav toggle — the sidebar has no drawer to open. |
| `src/context/LocaleContext.tsx` | Source of `country`, which the nav-fetch effect depends on. |
| `src/app/api/nav/route.ts` | `GET /api/nav?country=` — documented in `documents/api/nav-api.md`. |
| `src/app/api/auth/me/route.ts` | `GET /api/auth/me` — feeds the identity pill's name/avatar/plan. |
| `src/i18n/navConfig.ts` | `ICON_MAP` (icon name → component) and the `NavItemDto` type. |
| `src/i18n/translations.ts` | `t.nav.*` (item labels, by language) and `t.sidebar.subscription`/`t.sidebar.settings`/`t.sidebar.logout` (the three labelled account pills). |

`src/context/MobileNavContext.tsx` was deleted along with the off-canvas drawer it drove —
there is no mobile-specific nav state left anywhere in the app. `t.sidebar.lockScreen` and
`t.sidebar.language`/`t.sidebar.country` remain in `translations.ts` but are no longer read
by `Sidebar.tsx` — the sidebar has no "Lock screen" item and never had
Country/Language pickers of its own; see §9.

---

## 3. Why it's documented separately from the pages

`AppShell` lives in `src/app/(app)/layout.tsx`, which the App Router keeps mounted across
navigation between its child routes — only the page content inside `<main>` swaps. This
means `Sidebar`'s `useState`/`useEffect` calls run once per session, not once per click:
the nav list and the signed-in user's identity are fetched once and simply persist as the
user moves between pages. (Design history:
`docs/superpowers/specs/2026-09-11-persistent-app-shell-layout-design.md`.)

---

## 4. Component Hierarchy

```
(app)/layout.tsx                                   [server: session guard]
└── AppShell
    ├── Sidebar                                     ['use client', mounts once, floats over content]
    │   └── fixed overlay column (w-[220px], pointer-events-none container)
    │       ├── category pills   (top, pointer-events-auto)  — OR 5 skeleton pills while navLoading
    │       ├── flexible gap     (grows to fill space, floors at 32px)
    │       └── account pills    (bottom → top: Log out, identity, Settings, Subscription)
    ├── Header                                      [page title + Refresh/Lock — no nav toggle]
    └── <main>{page content}</main>
```

Each pill (`Pill` in `Sidebar.tsx`) is one self-contained element — a `<Link>` when it
navigates, a `<button>` for sign-out/identity — not a shared list-item template with a
separate popover; there is no menu that opens on top of a pill.

---

## 5. State

| State | Type | Purpose |
|---|---|---|
| `user` | `UserInfo \| null` | From `GET /api/auth/me`, fetched once on mount |
| `navItems` | `NavItemDto[]` | From `GET /api/nav?country=`, refetched whenever `country` changes |
| `navLoading` | `boolean` | Drives the 5-pill skeleton while the nav fetch is in flight |
| `pendingHref` | `string \| null` | The just-clicked pill's `href`, used to highlight it **immediately** — see §6.2 |
| `revealedId` | `string \| null` | Which pill is currently tap-revealed (touch only) — see §6.3 |

There is no `collapsed`, `sheetOpen`, or `mobileOpen` state — those belonged to the
previous (collapsible column + drawer) design and no longer exist.

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

### 6.2 Click a category or Settings/Subscription pill

```
User clicks a pill's <Link>
  │
  ▼
onClick: setPendingHref(href), setRevealedId(null)   ← synchronous, before Next's navigation resolves
  │
  ▼
Pill's collapsed-sliver tint brightens immediately (active = pendingHref ?? pathname)
  │
  ▼ (independently) Next.js navigates; usePathname() updates once it commits
  │
  ▼
useEffect([pathname]): setPendingHref(null), setRevealedId(null)   ← clears once any
                                                 navigation commits
```

`active` only tints the collapsed sliver a touch brighter — it does **not** keep a pill
expanded. Every pill, current page included, returns to icon-only the instant it's no
longer hovered or tap-revealed.

### 6.3 Hover / tap reveal

```
Desktop (hover: capable pointer):
  CSS :hover / :focus-visible slides the pill fully into view; a normal click navigates
  immediately — no extra tap needed.

Touch (hover: none):
  First tap on a collapsed pill → e.preventDefault(), setRevealedId(id)   (reveals only)
  Second tap on the now-revealed pill → navigates / signs out / (identity: no-op)
  Tapping anywhere else while a pill is revealed → setRevealedId(null)    (pointerdown
    listener outside the revealed pill's data-pill-id)
```

The **identity pill** (avatar + name) has no `href` and no navigation target — tapping it
only ever toggles its own reveal; it exists to show who's signed in, not as a menu trigger.

### 6.4 Sign out

```
User activates the "Log out" pill (click, or second tap on touch)
  │
  ▼
setTheme('system')          ← drops the applied theme; the stored DB preference is
                               untouched and restored by PreferencesSync next sign-in
  │
  ▼
POST /api/auth/signout
  │
  ▼
router.push('/'), router.refresh()
```

Same mechanism as `docs/superpowers/specs/2026-09-09-signout-theme-reset-design.md` and
`documents/api/signout-api.md` — not repeated here.

### 6.5 No mobile drawer

The sidebar renders identically at every viewport width — the same fixed-position,
icon-peeking-then-reveal pills, no breakpoint-specific layout, no backdrop, no open/close
state. There is nothing analogous to the old off-canvas drawer to document.

---

## 7. Data flow

```mermaid
flowchart TD
    M["Sidebar mounts (once, in (app)/layout.tsx)"] -->|"GET /api/auth/me"| U[user]
    M -->|"GET /api/nav?country=X"| N[navItems]
    LC["LocaleContext.country changes\n(e.g. via /settings)"] -->|"GET /api/nav?country=X"| N

    N --> R["resolvedNavItems:\nhref, t.nav[labelKey], ICON_MAP[iconName]"]
    R --> UI[Rendered category pills]

    click["User clicks/taps a pill"] --> PH["setPendingHref(href)\n(active tint moves now)"]
    click --> NAV["Next.js navigation"]
    NAV --> PATH["usePathname() updates on commit"]
    PATH --> CLR["pendingHref cleared"]
```

---

## 8. Theme pattern

Mixed: the **brand**-toned category pills use the shared `--ui-*` design tokens
(`bg-gradient-to-br from-[var(--ui-accent)] to-[var(--ui-accent-warm)]`,
`text-[var(--ui-on-accent)]`), matching `/settings`, `/subscription`, `/`, and `/unlock`.
The **neutral**-toned Settings/Subscription pills and the **danger**-toned Log out pill
instead use plain Tailwind `slate`/`red` utilities with `dark:` variants, not the `--ui-*`
tokens. Both conventions coexist in the same component today.

---

## 9. Known issues / notes

- **No "Lock screen" entry point in the sidebar.** The previous design's profile popover
  had a "Lock screen" menu item; the current pill layout has no equivalent — locking the
  vault mid-session is only reachable via `Header`'s **Lock** button
  (`POST /api/auth/lock`, then `router.push('/unlock')`).
- **`t.sidebar.lockScreen`, `t.sidebar.language`, and `t.sidebar.country`** remain defined
  in `src/i18n/translations.ts` for every locale but are not read by `Sidebar.tsx` — dead
  translation keys left over from an earlier design, not a bug in the sidebar itself.
- **Only India is configured.** `nav_config` has rows for `country = 'IN'` only; every
  other country falls back to India's list (see `documents/api/nav-api.md`). The
  `/settings` Country picker only offers India today, so this is currently unreachable
  in practice, not a bug.
- **Hover/tap reveal state is not persisted** — a pill always starts icon-only on load or
  after any navigation; this is the intended interaction, not an oversight.

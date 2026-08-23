# Feature Architecture: User Preferences & Dynamic Nav

> Read `00-global-architecture.md` first — this doc assumes knowledge of the root layout, provider chain, and auth flow.

---

## Purpose

This feature does two related things:

1. **User Preferences** — persists `country`, `locale`, and `theme` per user in the database so they load correctly on any device after login. The app does not rely solely on cookies or `localStorage`; the DB is the authoritative source and cookies serve as the instant-first-render fallback.

2. **Dynamic Nav** — the sidebar navigation list is not hard-coded. It is driven by the `NavConfig` DB table, which maps nav items to `country` codes (`'ALL'` for universal, `'IN'` for India-only, etc.). When the user changes their country, the sidebar re-fetches nav items and the route `/dashboard` is opened to give a fresh context.

Both features are designed to be non-blocking: the app is fully functional using cookie defaults even if the DB calls are slow or fail.

---

## File Map

### New Files

| File | Role |
|------|------|
| `src/app/api/preferences/route.ts` | `GET` reads all preferences for the session user; `PATCH` upserts a single key |
| `src/app/api/nav/route.ts` | `GET` returns nav items filtered by country from `NavConfig` |
| `src/components/layout/PreferencesSync.tsx` | Client component (renders `null`) — loads DB prefs on mount, applies them to context |
| `src/lib/savePreference.ts` | Fire-and-forget `PATCH /api/preferences` helper called from every change site |
| `src/i18n/navConfig.ts` | `ICON_MAP` (string → Lucide component) and `NavItemDto` type used by Sidebar |
| `src/i18n/categoryInfo.ts` | Static config: per-category, per-country instrument examples powering the ℹ info popover |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `AppConfig` gains `userId` field; unique constraint changes from `key` to `[userId, key]`. `NavConfig` model added. |
| `prisma/seed.ts` | Seeds `NavConfig` rows (ALL + IN entries); seeds seed-user `AppConfig` verifier row |
| `src/app/layout.tsx` | `<PreferencesSync />` added inside provider chain |
| `src/context/LocaleContext.tsx` | `setLocale` and `setCountry` now call `savePreference` after writing the cookie |
| `src/components/layout/ThemeTogglePill.tsx` | `toggle()` calls `savePreference('theme', next)` after `setTheme` |
| `src/components/layout/Sidebar.tsx` | Nav items fetched from `/api/nav?country=...` on mount and on country change; `handleSelectCountry` navigates to `/dashboard` |
| `src/middleware.ts` | `/api/preferences` and `/api/nav` are exempted from the vault-lock check so they work with `userId` only (no `encryptionKey` required) |

---

## Database Schema

### `AppConfig` — per-user key-value preferences

```prisma
model AppConfig {
  id     Int    @id @default(autoincrement())
  userId String           // references users.id (no FK enforced — userId is a string)
  key    String
  value  String

  @@unique([userId, key]) // compound: one value per key per user
  @@map("app_config")
}
```

**Preference keys stored:**

| Key | Allowed values | Default |
|-----|----------------|---------|
| `country` | ISO 3166-1 alpha-2 (e.g. `"IN"`, `"US"`) | `"US"` |
| `locale` | IETF tag (e.g. `"en-US"`, `"hi-IN"`) | `"en-US"` |
| `theme` | `"dark"` \| `"light"` | `"dark"` |

The `verifier` key (written by the seed and by unlock) also lives in `AppConfig` but is **not** a user preference — it is excluded from the `ALLOWED` list in `/api/preferences/route.ts` and never read or written by the preferences flow.

### `NavConfig` — country-scoped navigation items

```prisma
model NavConfig {
  id        Int    @id @default(autoincrement())
  country   String // "ALL" = every country, "IN" = India only, etc.
  href      String // e.g. "/dashboard", "/nps"
  labelKey  String // translation key used in t.nav[labelKey]
  iconName  String // string key into ICON_MAP in src/i18n/navConfig.ts
  sortOrder Int    @default(0)

  @@map("nav_config")
}
```

All nav items use `country: 'ALL'` — the 8 categories are fixed regardless of the user's selected country. The `country` column is retained in the schema for future extensibility (e.g. adding locale-specific items later without a migration).

The Sidebar query: `WHERE country IN ('ALL', <userCountry>) ORDER BY sortOrder ASC`.

---

## Provider & Component Hierarchy

```
Root Layout (layout.tsx)   [Server Component]
└── <ThemeProvider>        [next-themes]
    └── <LocaleProvider>   [src/context/LocaleContext.tsx]
        └── <CurrencyProvider>
            ├── <PreferencesSync />   ← NEW — client, renders null, runs once on mount
            ├── <AppBar />
            └── {children}           ← page content
```

`PreferencesSync` is placed **inside** all three providers so it can call `setLocale`, `setCountry` (from `useLocale`) and `setTheme` (from `useTheme`) after its `GET /api/preferences` fetch resolves.

Placement before `AppBar` and `{children}` means the DB values are applied before any page-level component renders (though the cookie values are already applied synchronously by `LocaleProvider`).

---

## API Routes

### `GET /api/preferences`

- **Auth:** requires `session.userId` only (vault does not need to be open)
- **Returns:** `{ country: string, locale: string, theme: string }` — defaults merged for missing keys
- **Used by:** `PreferencesSync` on mount

```
GET /api/preferences
      │
      ▼
getSession()
  └── !userId → 401 {}
      │
      ▼
prisma.appConfig.findMany({ where: { userId, key: { in: ['country','locale','theme'] } } })
      │
      ▼
{ ...DEFAULTS, ...Object.fromEntries(rows) }   // DEFAULTS = { country:'US', locale:'en-US', theme:'dark' }
      │
      ▼
200 { country, locale, theme }
```

### `PATCH /api/preferences`

- **Auth:** requires `session.userId` only
- **Body:** `{ key: 'country' | 'locale' | 'theme', value: string }`
- **Action:** upserts one row via `prisma.appConfig.upsert({ where: { userId_key: { userId, key } } })`
- **Returns:** `{ success: true }`
- **Invalid keys:** 400 `{ error: 'Invalid key' }`

### `GET /api/nav`

- **Auth:** requires `session.userId` only
- **Query param:** `?country=IN` (defaults to `'US'` if absent)
- **Returns:** array of `NavItemDto` rows ordered by `sortOrder`

```
GET /api/nav?country=IN
      │
      ▼
getSession()
  └── !userId → 401 []
      │
      ▼
prisma.navConfig.findMany({
  where:   { country: { in: ['ALL', 'IN'] } },
  orderBy: { sortOrder: 'asc' },
})
      │
      ▼
200 [ { id, country, href, labelKey, iconName, sortOrder }, ... ]
```

---

## Middleware Exceptions

```typescript
// src/middleware.ts — inside the vault-lock branch
if (!session.encryptionKey) {
  if (pathname === '/api/preferences') return NextResponse.next()  // ← exempted
  if (pathname === '/api/nav')         return NextResponse.next()  // ← exempted
  if (pathname.startsWith('/api/'))    return NextResponse.json({ error: 'Portfolio locked' }, { status: 401 })
  return NextResponse.redirect(new URL('/unlock', request.url))
}
```

Both routes only need `userId` (not `encryptionKey`) because preferences and nav items are not sensitive financial data. Without these exceptions the Sidebar — rendered on `/unlock` — would fail to load nav items.

---

## Data Flow

### Flow 1 — Initial Page Load (Preferences Restoration)

```
User navigates to any page
        │
        ▼
LocaleProvider mounts → reads cookies synchronously
  ├── preferred-locale cookie → setLocaleState(savedLocale)
  └── preferred-country cookie → setCountryState(savedCountry)
      (or falls back to IP detection via ipapi.co if cookie absent)
        │
        ▼ (hydration complete)
PreferencesSync mounts → useEffect fires
        │
        ▼
GET /api/preferences
  ├── 401 (not logged in) → silent exit, cookie values stand
  └── 200 { country, locale, theme }
            │
            ├── setLocale(prefs.locale)   → updates LocaleContext + re-writes cookie
            ├── setCountry(prefs.country) → updates LocaleContext + re-writes cookie
            └── setTheme(prefs.theme)     → updates next-themes
```

**Race condition note:** `LocaleProvider` reads cookies synchronously before first render; `PreferencesSync` overrides with DB values after mount. When cookie and DB values match (normal case after first save), the override is invisible. On a new device the cookie is absent, so IP-detection runs in parallel and DB values win.

### Flow 2 — User Changes a Preference

**Locale change (via Sidebar language picker):**

```
User selects a new locale
        │
        ▼
Sidebar.handleSelectLocale(code)
  └── setLocale(code)               ← LocaleContext setter
        │
        ├── setLocaleState(code)    → React re-render
        ├── writeCookie(...)        → instant persistence for next load
        ├── document.documentElement.lang = code
        └── savePreference('locale', code)
                │
                ▼ (background, fire-and-forget)
            PATCH /api/preferences { key:'locale', value:code }
                └── prisma.appConfig.upsert(...)
```

**Country change (via Sidebar country picker):**

```
User selects a new country
        │
        ▼
Sidebar.handleSelectCountry(code)
  ├── setCountry(code)              ← LocaleContext setter → cookie + PATCH /api/preferences
  └── router.push('/dashboard')    ← navigates to fresh dashboard context
        │
        ▼
Sidebar useEffect([country]) fires  ← country state changed
  └── GET /api/nav?country=<code>
        └── setNavItems(data)       → sidebar re-renders with country-appropriate nav
```

**Theme toggle (via ThemeTogglePill):**

```
User clicks the pill
        │
        ▼
ThemeTogglePill.toggle()
  ├── setTheme(next)               ← next-themes (updates <html class>)
  └── savePreference('theme', next) ← background PATCH
```

### Flow 3 — Nav Loading on Sidebar Mount

```
Sidebar mounts (on any authenticated page)
        │
        ▼
useEffect([]) → fetch('/api/auth/me') → setUser(data.user)

useEffect([country]) fires with current country
        │
        ▼
setNavLoading(true)
GET /api/nav?country=IN
        │
        ├── Error / non-OK → setNavItems([])
        └── 200 [ NavItemDto... ]
                │
                ▼
            setNavItems(data) → setNavLoading(false)

Sidebar renders:
  navLoading=true  → 5 animated skeleton rows
  navLoading=false → resolvedNavItems.map(...)
                      item.labelKey → t.nav[labelKey]   (localised label)
                      item.iconName → ICON_MAP[iconName] (Lucide component)
```

---

## Component Details

### `PreferencesSync` (`src/components/layout/PreferencesSync.tsx`)

- `'use client'` — needs `useEffect`, `useLocale`, `useTheme`
- Renders `null` — zero DOM output
- Runs the DB fetch exactly once on mount (`useEffect(fn, [])`)
- 401 or network error → silent exit (cookie/default values stand)
- Calls `setLocale` / `setCountry` from `useLocale` and `setTheme` from `useTheme` — these in turn write cookies and fire background `PATCH` calls, but `PreferencesSync` does **not** double-save; the setters already handle persistence

### `savePreference` (`src/lib/savePreference.ts`)

```typescript
export async function savePreference(key: string, value: string): Promise<void> {
  await fetch('/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => {})   // errors are swallowed — preferences are low-stakes
}
```

Called from three sites:

| Call site | Key | Trigger |
|-----------|-----|---------|
| `LocaleContext.setLocale` | `locale` | User picks a language in Sidebar |
| `LocaleContext.setCountry` | `country` | User picks a country in Sidebar |
| `ThemeTogglePill.toggle` | `theme` | User clicks the dark/light pill |

### `ICON_MAP` (`src/i18n/navConfig.ts`)

Maps the string `iconName` stored in `NavConfig` rows to the actual Lucide component. The Sidebar resolves icons at render time via `ICON_MAP[item.iconName] ?? (() => null)`.

```typescript
export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,  // Dashboard
  TrendingUp,       // Equity
  BarChart3,        // Mutual Funds
  Gem,              // Gold & Commodities
  Home,             // Real Estate
  Bitcoin,          // Cryptocurrency
  Shield,           // Insurance
  Building2,        // Cash & Banking
  CreditCard,       // Liabilities
  PiggyBank,        // Fixed Income (IN)
  Landmark,         // Government Schemes (IN)
  GraduationCap,    // Education Savings (US)
  Briefcase,        // Business Ownership (US)
}
```

Any `NavConfig` row whose `iconName` is not in this map renders no icon (the `?? (() => null)` fallback).

### `Sidebar` — nav-related behaviour

| Behaviour | Implementation |
|-----------|---------------|
| Nav skeleton | `navLoading` state; 5 animated placeholder rows while fetch is in-flight |
| Nav fetch | `useEffect([country])` — re-fetches whenever the user changes country |
| Icon resolution | `ICON_MAP[item.iconName]` — string from DB → React component |
| Label resolution | `t.nav[item.labelKey]` — string from DB → localised translation |
| Active state | `pathname === href \|\| (href !== '/dashboard' && pathname.startsWith(href))` |
| Country change | `setCountry(code)` then `router.push('/dashboard')` — nav refetch follows automatically via `useEffect([country])` |

---

## Seed Data — NavConfig

`prisma/seed.ts` seeds `NavConfig` with 11 rows, all `country: 'ALL'` — Dashboard plus 10 universal asset categories shown identically to every user regardless of country:

| `sortOrder` | `href` | `labelKey` | `iconName` |
|-------------|--------|------------|------------|
| 1  | `/dashboard`          | `dashboard`         | `LayoutDashboard` |
| 2  | `/stocks`             | `stocks`            | `TrendingUp`      |
| 3  | `/mutual-funds`       | `mutualFunds`       | `BarChart3`       |
| 4  | `/gold-commodities`   | `goldCommodities`   | `Gem`             |
| 5  | `/real-estate`        | `realEstate`        | `Home`            |
| 6  | `/crypto`             | `cryptocurrency`    | `Bitcoin`         |
| 7  | `/insurance`          | `insurance`         | `Shield`          |
| 8  | `/cash-banking`       | `cashBanking`       | `Building2`       |
| 9  | `/liabilities`        | `liabilities`       | `CreditCard`      |
| 10 | `/fixed-income`       | `fixedIncome`       | `PiggyBank`       |
| 11 | `/government-schemes` | `governmentSchemes` | `Landmark`        |

**Why all universal:** Country-specific instruments (PPF, NPS, 529, CPF, etc.) are not separate nav destinations — they surface as instrument examples inside each category via the ℹ info popover (`categoryInfo.ts`). The nav is identical regardless of which country the user selects.

## Category Info — `src/i18n/categoryInfo.ts`

A static TypeScript config powering the ℹ info button on each sidebar nav item. Not stored in the DB — instrument types change rarely and benefit from type safety and git versioning.

**Structure:**

```typescript
CATEGORY_INFO[categorySlug][countryCode] = {
  description: string    // one-line description shown for this country
  instruments: string[]  // specific instrument / scheme names
}
```

Every category has an `ALL` key (universal). When the user's country matches a specific key (`IN`, `US`, `SG`, `JP`, `GB`), the `getCategoryInfo()` helper returns the country-specific `description` and merges `ALL` + country instruments into one list.

**Active countries:** `IN`, `US`, `SG`, `JP`, `GB`. All other countries in `countries.ts` are commented out pending instrumentation. When a user from a non-instrumented country opens the popover, the universal `ALL` description and instruments are shown.

**Coverage — all 10 categories × all 5 active countries are fully populated.**

The seed also writes a single `AppConfig` row for the seed user:

```typescript
{ userId: seedUserId, key: 'verifier', value: encrypt('PORTFOLIO_APP_V1', keyHex) }
```

This `verifier` key is **not** a user preference — it is the passphrase verifier blob read by the unlock route. It lives in `AppConfig` by convention (same key-value store), but is never touched by `/api/preferences`.

---

## What This Feature Does NOT Do

- Does not store preferences in the URL or in iron-session fields
- Does not block the first render while waiting for DB prefs — cookies serve the first paint immediately
- Does not surface errors to the user — failed `savePreference` calls are swallowed silently
- Does not enforce referential integrity between `AppConfig.userId` and `User.id` at the DB level — Prisma has no `@relation` here; the API routes rely on the session being valid
- Does not paginate or cache `NavConfig` — the table is small (< 50 rows) and queried on every country change
- Does not validate preference _values_ beyond the key allowlist — invalid locale strings or unknown country codes are stored and returned as-is; the UI falls back gracefully because `translations[locale]` falls back to the default
- `NavConfig` has no per-user rows and no country-specific rows — nav is identical for every user regardless of country. Country awareness lives entirely in `categoryInfo.ts`, not in `NavConfig`.
- `categoryInfo.ts` has no translations — instrument names are always in English regardless of the user's locale. Localising instrument names is a future concern.

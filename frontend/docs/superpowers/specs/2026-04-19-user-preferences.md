# User Preferences — Design

**Goal:** Persist country, locale, and theme per user in the database so they load on any device after login. Navigate to Dashboard automatically on country change.

**Architecture:** Extend `AppConfig` table to support per-user key-value preferences. A new `/api/preferences` route reads and writes them. A lightweight `PreferencesSync` client component (rendered once in the root layout) loads DB values on mount and applies them. Each setter (`setLocale`, `setCountry`, theme toggle) fires a background PATCH to save the change.

---

## Schema Change — `AppConfig`

**Current:**
```prisma
model AppConfig {
  id    Int    @id @default(autoincrement())
  key   String @unique
  value String
  @@map("app_config")
}
```

**After:**
```prisma
model AppConfig {
  id     Int    @id @default(autoincrement())
  userId String
  key    String
  value  String

  @@unique([userId, key])
  @@map("app_config")
}
```

Adding `userId` makes the table per-user. The unique constraint changes from global `key` to `[userId, key]`. `prisma db push` applies the change.

**Preference keys stored:**

| Key | Values | Default |
|-----|--------|---------|
| `country` | ISO 3166-1 alpha-2 (e.g. `"IN"`) | `"US"` |
| `locale` | IETF locale tag (e.g. `"en-US"`) | `"en-US"` |
| `theme` | `"dark"` \| `"light"` | `"dark"` |

---

## API Route — `/api/preferences`

### `GET /api/preferences`
- Requires: `userId` in session (not `encryptionKey` — prefs are not sensitive)
- Returns: `{ country: string, locale: string, theme: string }` — defaults applied for missing keys
- Used by `PreferencesSync` on mount

### `PATCH /api/preferences`
- Requires: `userId` in session
- Body: `{ key: 'country' | 'locale' | 'theme', value: string }`
- Upserts one preference via `prisma.appConfig.upsert({ where: { userId_key: { userId, key } } })`
- Returns: `{ success: true }`

Neither endpoint requires `encryptionKey` — preferences are plaintext, non-sensitive metadata.

---

## New Component — `PreferencesSync`

```
src/components/layout/PreferencesSync.tsx   ['use client']
```

A zero-render component (returns `null`) placed once in `layout.tsx` inside all three providers. On mount it:
1. Fetches `GET /api/preferences`
2. If 401/error → silently exits (unauthenticated user, use cookie/localStorage defaults)
3. If 200 → applies DB values:
   - `setLocale(prefs.locale)` from `useLocale()`
   - `setCountry(prefs.country)` from `useLocale()`
   - `setTheme(prefs.theme)` from `useTheme()` (next-themes)

`PreferencesSync` runs on every page — landing page gets 401 (silent), unlock page and dashboard pages get the user's saved prefs.

**Placement in `layout.tsx`:**
```tsx
<ThemeProvider>
  <LocaleProvider>
    <CurrencyProvider>
      <PreferencesSync />   ← new, renders null, has access to all three contexts
      <AppBar />
      {children}
    </CurrencyProvider>
  </LocaleProvider>
</ThemeProvider>
```

---

## Saving Preferences

Each change site fires a background PATCH. The local state updates immediately (cookies/localStorage/React state); the DB write is async and fire-and-forget.

A shared helper keeps save calls DRY:

```typescript
// src/lib/savePreference.ts
export async function savePreference(key: string, value: string): Promise<void> {
  await fetch('/api/preferences', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  }).catch(() => {})   // fire-and-forget, never throw
}
```

### Where each preference is saved

| Preference | Where saved | When |
|------------|-------------|------|
| `locale` | `LocaleContext.setLocale()` | After writing cookie, calls `savePreference('locale', code)` |
| `country` | `LocaleContext.setCountry()` | After writing cookie, calls `savePreference('country', code)` |
| `theme` | `ThemeTogglePill.toggle()` | After calling `setTheme()`, calls `savePreference('theme', value)` |

---

## Country Change → Dashboard Navigation

In `Sidebar.handleSelectCountry`, add `router.push('/dashboard')` after `setCountry(code)`. This is a UI concern, not a context concern — the context setter stays pure.

```typescript
const handleSelectCountry = (code: string) => {
  setCountry(code)            // saves to cookie + DB (via LocaleContext)
  setActivePopover(null)
  setSheetOpen(false)
  router.push('/dashboard')   // ← new
}
```

---

## File Map

### New files

| File | Purpose |
|------|---------|
| `src/app/api/preferences/route.ts` | GET + PATCH handlers |
| `src/components/layout/PreferencesSync.tsx` | Mount-time DB → local state sync |
| `src/lib/savePreference.ts` | Shared `savePreference(key, value)` helper |

### Modified files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `userId` to `AppConfig`, update unique constraint |
| `prisma/seed.ts` | Update `appConfig.create` to include `userId` (or remove if unused) |
| `src/app/layout.tsx` | Add `<PreferencesSync />` inside providers |
| `src/context/LocaleContext.tsx` | `setLocale` + `setCountry` call `savePreference` after writing cookie |
| `src/components/layout/ThemeTogglePill.tsx` | `toggle` calls `savePreference('theme', value)` after `setTheme` |
| `src/components/layout/Sidebar.tsx` | `handleSelectCountry` adds `router.push('/dashboard')` |

---

## LLD — `src/app/api/preferences/route.ts`

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const DEFAULTS = { country: 'US', locale: 'en-US', theme: 'dark' }

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const rows = await prisma.appConfig.findMany({ where: { userId: session.userId } })
  const prefs = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const { key, value } = await req.json()
  const ALLOWED = ['country', 'locale', 'theme']
  if (!ALLOWED.includes(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })

  await prisma.appConfig.upsert({
    where:  { userId_key: { userId: session.userId, key } },
    update: { value },
    create: { userId: session.userId, key, value },
  })
  return NextResponse.json({ success: true })
}
```

---

## LLD — `PreferencesSync.tsx`

```typescript
'use client'

import { useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useLocale } from '@/context/LocaleContext'
import type { Locale } from '@/i18n/translations'

export function PreferencesSync() {
  const { setLocale, setCountry } = useLocale()
  const { setTheme } = useTheme()

  useEffect(() => {
    fetch('/api/preferences')
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return
        if (prefs.locale)  setLocale(prefs.locale as Locale)
        if (prefs.country) setCountry(prefs.country)
        if (prefs.theme)   setTheme(prefs.theme)
      })
      .catch(() => {})
  }, [])   // runs once on mount

  return null
}
```

**Race condition note:** `PreferencesSync` runs once after mount. `LocaleProvider` already reads cookies synchronously before first render. The DB fetch overrides with the more authoritative values. The override is invisible to the user when the cookie and DB values match (which they will after the first save cycle).

---

## What This Does NOT Do

- Does not store preferences in the URL or a separate session field
- Does not cause loading spinners waiting for DB prefs (cookies/localStorage serve the first render)
- Does not prevent the app from working offline or when the DB is slow (cookie/localStorage fallback always present)
- `savePreference` errors are swallowed — a failed write won't surface to the user (preferences are low-stakes)

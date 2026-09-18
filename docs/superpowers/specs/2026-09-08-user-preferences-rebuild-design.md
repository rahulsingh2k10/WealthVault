# User Preferences — Rebuild & Settings Page — Design

**Date:** 2026-09-08

## Problem

The app already has a full per-user preferences UI (sidebar Language + Country
popovers, a Dark/Light theme pill) wired through `savePreference()` →
`PATCH /api/preferences`, with `PreferencesSync` restoring values via
`GET /api/preferences` on mount.

It is dead. The `AppConfig` Prisma model that `/api/preferences/route.ts` reads
and writes was deleted in commit `f589006` ("Remove all Prisma models except
User and SubscriptionPlan"). There is no backing table and no `appConfig`
delegate on the Prisma client, so every preference read/write throws — silently,
because `savePreference` and `PreferencesSync` both swallow errors with
`.catch(() => {})`.

Today: country/locale survive only in a cookie (per-device); theme survives only
in next-themes' `localStorage` (per-device). Nothing is DB-backed or
cross-device.

## Goal

1. Restore DB persistence of `country`, `locale`, `theme` per user, keyed by a
   new `user_preference` table.
2. Add a dedicated `/settings` page consolidating the three controls (they exist
   today only as sidebar popovers + a header pill).
3. Cover the API with a test suite and verify data actually lands in the table.

Non-goals: new preference keys (currency, date format, …); a "System" theme
option; reworking `PreferencesSync` / `LocaleContext` / `savePreference` (they
are already correct); migrating any existing data (there are no rows).

---

## 1. Database — restore the model as `UserPreference`

Add to `frontend/prisma/schema.prisma`:

```prisma
model UserPreference {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  key       String   // "country" | "locale" | "theme"
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, key])
  @@map("user_preference")
}
```

Add the back-relation to `User`:

```prisma
model User {
  // ...existing fields...
  userPreferences UserPreference[]
}
```

**Deviations from the pre-`f589006` `AppConfig` model** (which was
`id Int @default(autoincrement())`, `key String`, `value String`, no `User`
relation): this version follows the house style every other model in the file
uses today — `String @id @default(uuid())`, an FK relation to `User`, and
`createdAt`/`updatedAt` timestamps. The API route's compound-unique upsert
(`where: { userId_key: { userId, key } }`) works identically against this shape.

**Keys stored:**

| Key      | Values                              | Default   |
|----------|-------------------------------------|-----------|
| `country`| ISO 3166-1 alpha-2 (e.g. `"IN"`)    | `"US"`    |
| `locale` | IETF locale tag (e.g. `"en-US"`)    | `"en-US"` |
| `theme`  | `"dark"` \| `"light"`               | `"dark"`  |

**Apply:** `cd frontend && npx prisma generate && npx prisma db push`. The change
is purely additive — one new table, one new FK; nothing is dropped or altered.
In this environment `DATABASE_URL == TEST_DATABASE_URL`, so the single push
serves both the running app and the test suite.

---

## 2. API route — one delegate rename

`src/app/api/preferences/route.ts` is otherwise already correct (allowed keys
`country`/`locale`/`theme`, `DEFAULTS` merge, per-user upsert, 401 on no
`userId`, 400 on an unknown key). `src/middleware.ts` already whitelists
`/api/preferences` so it works before the vault is unlocked.

Only change: `prisma.appConfig` → `prisma.userPreference` at both call sites
(`findMany` in `GET`, `upsert` in `PATCH`). No change to the request/response
contract, so the UI, `savePreference`, and `PreferencesSync` are untouched.

---

## 3. Settings page — `/settings`

### `src/app/settings/page.tsx` (server component)

Mirrors `src/app/subscription/page.tsx`:

```tsx
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

Title uses the existing `t.sidebar.settings` string via the panel (client side)
if we want it translated in the `<Header>`; simplest is to pass the literal
`"Settings"` to `AppShell` and let the panel render translated section labels.
Decision: pass `"Settings"` literally to `AppShell` (matches how
`subscription/page.tsx` passes `"Manage Subscription"` literally).

### `src/components/settings/SettingsPanel.tsx` (`'use client'`)

One card, three rows, styled with the same Tailwind + `var(--ui-*)` /
`dark:` conventions used by the sidebar popovers and subscription components:

| Row      | Control                                             | Binding |
|----------|----------------------------------------------------|---------|
| Country  | `<select>` over `COUNTRIES` (`@/i18n/countries`)    | `useLocale().country` / `setCountry` |
| Language | `<select>` over `LOCALES` (`@/i18n/translations`)   | `useLocale().locale` / `setLocale` |
| Theme    | Dark / Light segmented buttons                      | `useTheme()` + `savePreference('theme', next)` |

- Country/Language: the `useLocale()` setters **already** call
  `savePreference(...)` internally, so binding the controls to them is the whole
  implementation — no extra save logic, no local state.
- Theme: replicate `ThemeTogglePill.toggle`'s two lines
  (`setTheme(next); savePreference('theme', next)`). A `mounted` guard (as in
  `ThemeTogglePill`) avoids the hydration mismatch on `theme`.
- Section labels: reuse `t.sidebar.country`, `t.sidebar.language`; theme
  button labels stay the literal `"Dark"` / `"Light"` exactly as
  `ThemeTogglePill` already hardcodes them. No new translation keys, no
  12-locale churn.

### Sidebar wiring — `src/components/layout/Sidebar.tsx`

The "Settings" `SheetItem` currently has `onClick={() => setSheetOpen(false)}`
and goes nowhere. Change to:

```tsx
onClick={() => { setSheetOpen(false); router.push('/settings') }}
```

(`router` is already in scope — the Subscription item uses it the same way.)

---

## 4. Tests

### `frontend`-side: none

`prisma generate` + `db push` is verified by the suites below hitting the real
route.

### New — `tests/api/preferences/preferences.test.ts`

Pattern copied from `tests/api/subscription/manage.test.ts`: real dev server
(`ensureDevServer`), real test DB, `describeOrSkip = hasTestDb() ? describe :
describe.skip`, `DATABASE_URL === TEST_DATABASE_URL` guard in `beforeAll`,
`createTestUser` / `deleteTestUser`, `sealSessionCookie` for auth.

Cases:

1. **PATCH persists** — `PATCH /api/preferences {key:'country', value:'IN'}`
   with a valid session → `200 {success:true}`; a row
   `{userId, key:'country', value:'IN'}` exists in `user_preference`.
2. **GET returns persisted value merged over defaults** — after case 1,
   `GET /api/preferences` → `{country:'IN', locale:'en-US', theme:'dark'}`.
3. **PATCH upsert** — a second `PATCH {key:'country', value:'US'}` updates the
   same row (still one row for that `userId`+`key`), `GET` reflects `US`.
4. **Unknown key rejected** — `PATCH {key:'bogus', value:'x'}` → `400`, no row
   written.
5. **Unauthenticated** — `GET` / `PATCH` with no cookie → `401`.

Cleanup: delete the test user's `user_preference` rows in `afterEach`/`finally`
(cascade is not configured, so delete explicitly before `deleteTestUser`).

### New — schema assertion in `tests/database/schema.test.ts`

Add one `test` in the same style as the existing per-table column-order checks:

```ts
test("user_preference column order matches the schema", async () => {
  const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'user_preference' ORDER BY ordinal_position`
  )
  expect(rows.map((r) => r.column_name)).toEqual([
    "id", "userId", "key", "value", "createdAt", "updatedAt",
  ])
})
```

(Order per Prisma's `db push` diff-engine behaviour — adjust to actual if it
differs; the existing `users` test documents that `db push` may reorder.)

### Suite registration

- `tests/run-tests.ts`: add `"preferences"` to the `Suite` type and
  `ALL_SUITES`; add a `case "preferences": return runJest("api/preferences")`.
- `run-tests.sh`: add `"Preferences API Tests:preferences"` to `API_SUITES`.

---

## File map

### New

| File | Purpose |
|------|---------|
| `frontend/src/app/settings/page.tsx` | Server page, unlock guard, `AppShell` + panel |
| `frontend/src/components/settings/SettingsPanel.tsx` | Client controls for country / language / theme |
| `tests/api/preferences/preferences.test.ts` | API suite |

### Modified

| File | Change |
|------|--------|
| `frontend/prisma/schema.prisma` | Add `UserPreference` model + `User.userPreferences` back-relation |
| `frontend/src/app/api/preferences/route.ts` | `prisma.appConfig` → `prisma.userPreference` (2 sites) |
| `frontend/src/components/layout/Sidebar.tsx` | "Settings" `SheetItem` → `router.push('/settings')` |
| `tests/database/schema.test.ts` | Add `user_preference` column-order assertion |
| `tests/run-tests.ts` | Register `preferences` suite |
| `run-tests.sh` | Register `preferences` suite in `API_SUITES` |

### Not modified

`frontend/prisma/seed.ts` — see note above.

`frontend/prisma/seed.ts` — **not touched.** It references `appConfig` (for a
`verifier` key) plus ~6 other models dropped in `f589006` (`navConfig`,
`bankAccount`, `foreignHolding`, …) and is already non-functional against the
current schema. Renaming the delegate leaves it exactly as broken as it is now;
repairing the seed is a separate effort out of this scope.

---

## Verification

1. `cd frontend && npx prisma generate && npx prisma db push` — `user_preference`
   table created.
2. `./run-tests.sh api` — new `preferences` suite green; `subscription`,
   `auth`, `unlock`, `dashboard`, `upgrade` still green.
3. `./run-tests.sh database` — schema suite green including the new assertion.
4. Full suite (`./run-tests.sh`) still at the 208/209 baseline (the one
   pre-existing failure is unrelated).
5. Manual: log in → unlock → `/settings` → change Country to India → reload the
   page → selection persists; confirm one row in `user_preference` via
   `npx prisma studio` or a `SELECT`.
6. Manual: sidebar "Settings" item navigates to `/settings`.

---

## Risks / notes

- **`DATABASE_URL == TEST_DATABASE_URL`** in this environment — a known go-live
  blocker tracked elsewhere. It means `db push` touches the same DB the tests
  use; acceptable and in fact required for the test suite to see the table.
- **Stale generated Prisma client** — the frontend carries pre-existing `tsc`
  errors from the earlier schema reduction; `next build` already fails
  independently of this change. Verify this work by test-suite green and
  `tsc` error-count delta (should decrease: the `appConfig` references in
  `route.ts` currently error), not by a clean `tsc`.
- **`PreferencesSync` override flicker** — on `/settings`, `LocaleContext` seeds
  from cookie synchronously, then `PreferencesSync` may overwrite from the DB a
  tick later. Invisible once cookie and DB agree (i.e. after the first save).
  Not addressed here — pre-existing behaviour, out of scope.

---

https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62

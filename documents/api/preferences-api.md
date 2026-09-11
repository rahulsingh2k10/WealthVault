# Preferences API

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Parameters →
> Responses → Schemas), in the same style as `avatar-api.md`, `unlock-api.md`, and
> `dashboard-api.md`.

**Base path:** `/api/preferences`
**Tags:** `Preferences`

---

## Scope note

One route, two methods, backs the app's three user-settable preferences — **country**,
**locale**, **theme** — persisting them per user in the `user_preference` table so they
follow the user across devices and browsers. See
`documents/database/user-preference.md` for the table.

Unlike every other `/api/*` route except `/api/nav`, this route does **not** require an
unlocked vault — `src/middleware.ts` explicitly lets `/api/preferences` through on
`userId` alone (`if (pathname === "/api/preferences") return NextResponse.next();` inside
the `!session.encryptionKey` branch). Preferences are non-sensitive metadata and are
loaded on every authenticated page, including `/unlock` before the passphrase is entered.

The route reads and writes nothing sensitive and performs no encryption.

---

## Paths

### `GET /api/preferences`

**Summary:** Return the current user's preferences, with defaults filled in
**Tags:** `Preferences`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie; must contain `userId`. `encryptionKey` is **not** required. |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | `Preferences` object (see **Schemas**) | Always, for a valid session — stored values merged over the defaults |
| `401` | `{ "error": "Unauthorized" }` | No valid session (`session.userId` missing) — returned by `middleware.ts` before the route runs |

The `200` body always contains all three keys. For each key with no row in
`user_preference`, the default is returned:

```
country: "US"   locale: "en-US"   theme: "dark"
```

Only rows whose `key` is one of `country`, `locale`, `theme` are read — any stray row
with another key is ignored.

---

### `PATCH /api/preferences`

**Summary:** Set one preference for the current user
**Tags:** `Preferences`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie; must contain `userId`. `encryptionKey` is **not** required. |

**Request body** — `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `key` | string | yes | One of `country`, `locale`, `theme`. Any other value → `400`. |
| `value` | string | yes | The value to store. Not validated against a format or enum — stored verbatim. |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | `{ "success": true }` | Preference upserted |
| `400` | `{ "error": "Invalid key" }` | `key` is not one of `country`, `locale`, `theme` |
| `401` | `{ "error": "Unauthorized" }` | No valid session (`session.userId` missing) — returned by `middleware.ts` before the route runs |

The write is an upsert keyed on `(userId, key)` — the first `PATCH` for a key inserts a
row, every subsequent `PATCH` for the same key updates that same row's `value` (and
`updatedAt`). There is no `DELETE`; a preference cannot be unset, only overwritten.

`value` is trusted as-is. Sending `{ "key": "theme", "value": "chartreuse" }` returns
`200` and stores it; the frontend simply won't match it to a known theme.

---

## Schemas

### `Preferences` schema (GET response)

```typescript
{
  country: string   // ISO 3166-1 alpha-2, e.g. "IN" — default "US"
  locale:  string   // IETF BCP 47 tag,       e.g. "hi-IN" — default "en-US"
  theme:   string   // "dark" | "light"       — default "dark"
}
```

Always exactly these three keys.

### `PatchResult` schema (PATCH success)

```typescript
{ success: true }
```

Always this exact shape on success.

---

## Database effect

Touches exactly one table: `user_preference`.

| Case | Write |
|---|---|
| `GET`, valid session | None — read only (`prisma.userPreference.findMany({ where: { userId, key: { in: ['country','locale','theme'] } } })`) |
| `PATCH`, valid key + session | `INSERT` on first set of that key, otherwise `UPDATE` of the existing `(userId, key)` row — via `prisma.userPreference.upsert` |
| `PATCH`, invalid key (400) | None — rejected before the upsert |
| No valid session (401) | None — rejected by middleware before the route runs |

No other table, and no column on `users`, is touched. Nothing is written back to the
session cookie.

---

## Consumers

| File | Role |
|---|---|
| `src/components/layout/PreferencesSync.tsx` | Calls `GET` once on mount (rendered in `layout.tsx`), applies the result to the locale context and `next-themes` |
| `src/lib/savePreference.ts` | `savePreference(key, value)` — the shared fire-and-forget `PATCH` helper |
| `src/context/LocaleContext.tsx` | `setLocale` / `setCountry` call `savePreference` after updating cookie + state |
| `src/components/layout/ThemeTogglePill.tsx` | Theme pill in `AppBar`, shown only on `/` and `/unlock` — calls `savePreference('theme', …)`. Only writes successfully from `/unlock`, where a session already exists; on `/` (fully signed out) the `PATCH` 401s and is silently swallowed. |
| `src/components/settings/SettingsPanel.tsx` | The `/settings` page controls for all three preferences — the only place Country/Language/Theme can be changed once signed in |

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/preferences/route.ts` | `GET` + `PATCH /api/preferences` |
| `src/middleware.ts` | Auth gate; whitelists `/api/preferences` so it works with a locked vault |
| `src/lib/session.ts` | `getSession()` — reads `userId` from the sealed cookie |
| `prisma/schema.prisma` | `UserPreference` model → `user_preference` table |

Test coverage: `tests/api/preferences/preferences.test.ts` (both methods, defaults,
upsert, invalid key, auth) and `tests/database/schema.test.ts` (table shape + unique
constraint).

# Navigation API

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Parameters →
> Responses → Schemas), in the same style as `avatar-api.md`, `unlock-api.md`,
> `dashboard-api.md`, and `preferences-api.md`.

**Base path:** `/api/nav`
**Tags:** `Navigation`

---

## Scope note

One route, one method — returns the ordered sidebar items for a country from the
`nav_config` table, so the sidebar's contents/order/icons can vary per country. See
`documents/database/nav-config.md` for the table. Only **India (`IN`)** has rows today;
`COUNTRIES` in `src/i18n/countries.ts` has only India uncommented, so it's the only
country the `/settings` picker can actually request.

Like `/api/preferences`, this route does **not** require an unlocked vault —
`src/middleware.ts` explicitly lets `/api/nav` through on `userId` alone
(`if (pathname === "/api/nav") return NextResponse.next();` inside the
`!session.encryptionKey` branch), same carve-out, same reason: the sidebar itself isn't
rendered until after unlock (it lives in the `(app)` route-group layout, which redirects
to `/unlock` first), but the carve-out keeps the route consistent with `/api/preferences`
and available to any future signed-in-but-locked surface.

The route reads and writes nothing sensitive.

---

## Paths

### `GET /api/nav`

**Summary:** Sidebar navigation items for a country
**Tags:** `Navigation`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie; must contain `userId`. `encryptionKey` is **not** required. |
| `country` | query | string | no | ISO 3166-1 alpha-2 code. Defaults to `"IN"` if omitted. |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | `NavItem[]` (see **Schemas**), ascending `sortOrder` | Always, for a valid session |
| `401` | `[]` — **an empty array, not an `Error` object** | No valid session (`session.userId` missing) |

The `401` shape is a deliberate difference from every other route in this spec
(`/api/preferences` included): the handler returns `NextResponse.json([], { status: 401
})`. The frontend (`Sidebar.tsx`) doesn't distinguish "unauthenticated" from "no rows for
this country" — both render as an empty nav list — so the body is shaped to match the
success case rather than the usual `{ error: "..." }`.

**Fallback behavior:** if `country` has no rows (any code other than `IN` today,
including an IP-detected one the user never explicitly chose), the route falls back to
India's rows instead of returning an empty list:

```typescript
let rows = await prisma.navConfig.findMany({ where: { country }, orderBy: { sortOrder: 'asc' } })
if (rows.length === 0 && country !== 'IN') {
  rows = await prisma.navConfig.findMany({ where: { country: 'IN' }, orderBy: { sortOrder: 'asc' } })
}
```

So the sidebar is never empty for a signed-in, unlocked user — only an actually
unauthenticated request (`401`) produces `[]`.

---

## Schemas

### `NavItem` schema (array element of the `200` response)

```typescript
{
  id:        string   // uuid
  country:   string   // e.g. "IN" — always "IN" today, even for a request that fell back
  href:      string   // e.g. "/stocks"
  labelKey:  string   // key into the client's t.nav.* translations, e.g. "stocks"
  iconName:  string   // key into the client's ICON_MAP, e.g. "CandlestickChart"
  sortOrder: number
}
```

`label` and `icon` are **not** resolved server-side — the client maps `labelKey` through
`t.nav[labelKey]` (so the label is translated by the user's *language*, independent of
`country`) and `iconName` through `ICON_MAP` (`src/i18n/navConfig.ts`). An unrecognized
`iconName` degrades to rendering nothing rather than throwing.

---

## Database effect

Read-only. Touches exactly one table: `nav_config`.

| Case | Read |
|---|---|
| Valid session, `country` has rows | One `findMany`, filtered by `country`, ordered by `sortOrder` |
| Valid session, `country` has no rows (≠ `IN`) | Two `findMany` calls — the empty first lookup, then the `IN` fallback |
| Valid session, `country` omitted | Defaults to `IN` — one `findMany` |
| No valid session (`401`) | None — rejected before any query runs |

No table is ever written to by this route.

---

## Consumers

| File | Role |
|---|---|
| `src/components/layout/Sidebar.tsx` | Calls `GET /api/nav?country=<country>` on mount and whenever `country` (from `LocaleContext`) changes; maps each `NavItem` to `{ href, label: t.nav[labelKey], icon: ICON_MAP[iconName] }` and renders the list. Empty response (either shape) renders as no nav items — the caller doesn't need to special-case `401`. |

No other file calls this route.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/nav/route.ts` | `GET /api/nav` |
| `src/middleware.ts` | Auth gate; whitelists `/api/nav` so it works with a locked vault |
| `src/lib/session.ts` | `getSession()` — reads `userId` from the sealed cookie |
| `prisma/schema.prisma` | `NavConfig` model → `nav_config` table |
| `prisma/seed-nav.ts` | Standalone, idempotent seed for India's 11 rows (`npm run db:seed-nav`) — separate from the broadly-broken `prisma/seed.ts` |
| `src/i18n/navConfig.ts` | `ICON_MAP` (must contain every `iconName` any row uses) and the `NavItemDto` type |

Test coverage: `tests/api/nav/nav.test.ts` (401 without session, 11 ordered `IN` rows, an
unconfigured country falls back to `IN`) and `tests/database/schema.test.ts` (`nav_config`
table shape + the `(country, href)` unique constraint).

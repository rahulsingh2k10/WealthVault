# Database: `nav_config` Table

> Source of truth: `prisma/schema.prisma` (frontend). `backend/prisma/schema.prisma` is
> kept byte-identical for this model — the backend service has no logic of its own that
> touches `nav_config`, it just needs a matching schema against the same database so a
> backend migration never generates a drop for it.

## Overview

- **Prisma model name:** `NavConfig`
- **Table name:** `nav_config` (via `@@map("nav_config")`)
- **Database:** PostgreSQL, hosted on Railway (`DATABASE_URL` in `frontend/.env`)
- **Migration strategy:** no `prisma/migrations` history exists for this project — schema
  changes are applied directly with `prisma db push`.
- One row per **sidebar navigation item per country**. Each row says *which* item
  (`href`), *where in the list* (`sortOrder`), *what it's called* (`labelKey`), and
  *which icon* (`iconName`). The set of rows for a country **is** that country's sidebar.

Today only **India (`IN`)** is configured — 11 rows. `COUNTRIES` in
`src/i18n/countries.ts` only has India uncommented, so it's the only country the settings
dropdown offers. When another country is launched, it gets its own `nav_config` rows.

This model was deleted from the schema in commit `f589006`, which left
`src/app/api/nav/route.ts` calling a non-existent `prisma.navConfig` — every request 500'd
and the sidebar rendered empty for every user until this table was restored.

---

## Column reference

| Column      | Type     | Nullable | Default  | Notes                                          |
|-------------|----------|----------|----------|------------------------------------------------|
| `id`        | `String` | No       | `uuid()` | Primary key. Not referenced by any other table |
| `country`   | `String` | No       | —        | ISO 3166-1 alpha-2, uppercase. `IN` today      |
| `href`      | `String` | No       | —        | Route the item links to, e.g. `/stocks`        |
| `labelKey`  | `String` | No       | —        | Key into the client `t.nav.*` translations     |
| `iconName`  | `String` | No       | —        | Key into `ICON_MAP` in `src/i18n/navConfig.ts` |
| `sortOrder` | `Int`    | No       | `0`      | Ascending position in the sidebar              |

### Column details

- **`labelKey`** — the label is **not** stored as text. `Sidebar.tsx` resolves it through
  `t.nav[labelKey]`, so a nav item is translated by the user's *language* (11 locales),
  independent of country. A future country that wants different wording for an item adds a
  new key to `t.nav` and points its row at that key.
- **`iconName`** — a string that must exist as a key in `ICON_MAP`
  (`src/i18n/navConfig.ts`). An unknown name degrades to an empty icon
  (`ICON_MAP[iconName] ?? (() => null)`), it does not throw.
- **`sortOrder`** — the query orders by this ascending. Values are 1–11 for India but only
  the ordering matters, not the exact numbers.

### Full current model (for reference)

```prisma
model NavConfig {
  id        String @id @default(uuid())
  country   String
  href      String
  labelKey  String
  iconName  String
  sortOrder Int    @default(0)

  @@unique([country, href])
  @@index([country])
  @@map("nav_config")
}
```

---

## Current data — India (`country = 'IN'`)

| `sortOrder` | `href`                 | `labelKey`          | `iconName`         |
|-------------|------------------------|---------------------|-------------------|
| 1           | `/dashboard`           | `dashboard`         | `LayoutDashboard` |
| 2           | `/stocks`              | `stocks`            | `CandlestickChart`|
| 3           | `/mutual-funds`        | `mutualFunds`       | `BarChart3`       |
| 4           | `/gold-commodities`    | `goldCommodities`   | `Gem`             |
| 5           | `/real-estate`         | `realEstate`        | `Home`            |
| 6           | `/crypto`              | `cryptocurrency`    | `Bitcoin`         |
| 7           | `/insurance`           | `insurance`         | `Shield`          |
| 8           | `/cash-banking`        | `cashBanking`       | `Wallet`          |
| 9           | `/liabilities`         | `liabilities`       | `HandCoins`       |
| 10          | `/fixed-income`        | `fixedIncome`       | `Vault`           |
| 11          | `/government-schemes`  | `governmentSchemes` | `Landmark`        |

Seeded by **`frontend/prisma/seed-nav.ts`** (`npm run db:seed-nav`) — a standalone,
idempotent script (`deleteMany` where `country = 'IN'`, then `createMany`). It is **not**
part of `prisma/seed.ts`, which still references models deleted in `f589006` and does not
run. The same 11 rows are duplicated in `tests/helpers/seedNavData.ts` (`ensureNavData()`)
for the test suites — keep the two in lockstep.

---

## How it's read

`GET /api/nav?country=<code>` (`src/app/api/nav/route.ts`):

```typescript
let rows = await prisma.navConfig.findMany({
  where: { country },
  orderBy: { sortOrder: 'asc' },
})
// Only India is configured; any other country falls back to India's rows
if (rows.length === 0 && country !== 'IN') {
  rows = await prisma.navConfig.findMany({ where: { country: 'IN' }, orderBy: { sortOrder: 'asc' } })
}
```

- `country` comes from `LocaleContext` (`Sidebar.tsx` calls
  `fetch('/api/nav?country=' + country)`), which can be an IP-detected code the user never
  picked — the fallback keeps the sidebar populated regardless.
- `middleware.ts` requires a `userId` for `/api/nav` but lets it through with a **locked
  vault** (no `encryptionKey`), same carve-out as `/api/preferences`.
- `Sidebar.tsx` maps each row to
  `{ href, label: t.nav[labelKey], icon: ICON_MAP[iconName] }` and renders the list.

No other route or code path reads or writes this table.

---

## Constraints & indexes

- **Primary key:** `id` (`uuid()`, generated by Prisma). Postgres index `nav_config_pkey`.
- **Unique constraint:** `(country, href)` — `@@unique([country, href])`. Postgres index
  `nav_config_country_href_key`. One row per route per country; also what
  `seed-nav.ts` / `ensureNavData()` rely on being able to clear-and-reinsert safely.
- **Index:** `country` — `@@index([country])`. Postgres index `nav_config_country_idx`.
  The lookup query filters on `country`.
- No foreign keys — `nav_config` has no relation to any other model.

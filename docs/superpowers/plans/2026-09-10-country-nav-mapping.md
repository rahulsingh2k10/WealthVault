# Country → Sidebar Nav Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the `NavConfig` table, seed India's 11 sidebar rows (with 4 refreshed icons), fix `/api/nav`, so the sidebar navigation renders per-country (India today) instead of being empty.

**Architecture:** `nav_config` is a per-country table (`country, href, labelKey, iconName, sortOrder`). `/api/nav?country=` returns that country's ordered rows, falling back to India. `Sidebar.tsx` already consumes it — it just starts getting real data. Labels stay keyed (`t.nav[labelKey]`, translated by language); icons resolve through `ICON_MAP`.

**Tech Stack:** Next.js 14.1 App Router, Prisma 5 + PostgreSQL (Railway), TypeScript (strict), Jest + ts-jest, `lucide-react@0.344.0`.

**Spec:** `docs/superpowers/specs/2026-09-10-country-nav-mapping-design.md`

---

## Context for the implementer

- The Next app is in `frontend/`. Commands below `cd frontend` unless noted.
- **DB:** the repo uses `prisma db push` (no `migrations/` folder). `DATABASE_URL` is in `frontend/.env`; `backend/.env` has the same URL. Both `frontend/prisma/schema.prisma` and `backend/prisma/schema.prisma` point at the **same Railway database** — push once (from `frontend/`); the backend schema is mirrored for consistency/docs only, not pushed.
- **`db push` is destructive-capable.** `NavConfig` is a brand-new model with no relations — adding it only creates `nav_config`, touches nothing else. Still, run `npx prisma db push` and read its summary before confirming; it must report only the new table.
- **Type-check:** `cd frontend && npx tsc --noEmit`. Large pre-existing unrelated error backlog — the bar is **no new errors in the files this plan touches**. `/api/nav/route.ts` is currently one of those pre-existing errors (`prisma.navConfig` doesn't exist) — it will *clear* after Task 1.
- **Tests** live at repo root `tests/` (not under `frontend/`). They're gated `describeOrSkip = hasTestDb() ? describe : describe.skip` and use helpers in `tests/helpers/`. `TEST_DATABASE_URL` must equal `DATABASE_URL` for the suites to run. Run with `npm test` from `frontend/` (per `frontend/package.json`) — or however the other suites are run; check `tests/` for a runner if `npm test` from `frontend/` doesn't pick them up.
- Commit after each task. End every commit message with a blank line then exactly:
  `Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx`
- The 4 icon changes: `stocks` `TrendingUp`→`CandlestickChart`, `cash-banking` `Building2`→`Wallet`, `liabilities` `CreditCard`→`HandCoins`, `fixed-income` `PiggyBank`→`Vault`. The other 7 keep today's icons. All 4 new names exist in `lucide-react@0.344.0` (verified).

---

## Task 1: Restore the `NavConfig` model and create the table

**Files:**
- Modify: `frontend/prisma/schema.prisma`
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the model to `frontend/prisma/schema.prisma`**

The file currently ends with the `UserPreference` model:

```prisma
model UserPreference {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  key       String // "country" | "locale" | "theme"
  value     String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, key])
  @@map("user_preference")
}
```

Append, after that closing `}`:

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

- [ ] **Step 2: Add the identical model to `backend/prisma/schema.prisma`**

That file also ends with an identical `UserPreference` model. Append the exact same
`NavConfig` block after its closing `}`.

- [ ] **Step 3: Push the schema (frontend only) and inspect the summary**

Run: `cd frontend && npx prisma db push`
Expected: the summary reports adding the `nav_config` table (and its unique/index) and
**nothing else**. If it proposes dropping or altering any other table, STOP and report.

- [ ] **Step 4: Regenerate the client**

Run: `cd frontend && npx prisma generate`
Expected: "Generated Prisma Client".

- [ ] **Step 5: Verify the delegate exists**

Run:
```
cd frontend && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();console.log('navConfig delegate:', typeof p.navConfig);p.\$disconnect()"
```
Expected: `navConfig delegate: object`

- [ ] **Step 6: Type-check the route that referenced the missing model**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "api/nav/route\.ts" || echo "api/nav/route.ts clean"`
Expected: `api/nav/route.ts clean` (the `prisma.navConfig` error is now resolved).

- [ ] **Step 7: Commit**

```bash
git add frontend/prisma/schema.prisma backend/prisma/schema.prisma
git commit -m "$(printf 'Restore NavConfig model + nav_config table\n\nSame shape as before f589006 but uuid id, plus @@unique([country, href])\nand @@index([country]). Mirrored into the backend schema. db push creates\nonly the new table.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 2: Seed India's 11 nav rows

**Files:**
- Create: `frontend/prisma/seed-nav.ts`
- Modify: `frontend/package.json`

- [ ] **Step 1: Create `frontend/prisma/seed-nav.ts`**

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** India's sidebar. Order = sortOrder. labelKey → t.nav[key] (translated by
 *  language). iconName → ICON_MAP in src/i18n/navConfig.ts. */
export const IN_NAV = [
  { href: "/dashboard",          labelKey: "dashboard",         iconName: "LayoutDashboard",  sortOrder: 1  },
  { href: "/stocks",             labelKey: "stocks",            iconName: "CandlestickChart", sortOrder: 2  },
  { href: "/mutual-funds",       labelKey: "mutualFunds",       iconName: "BarChart3",        sortOrder: 3  },
  { href: "/gold-commodities",   labelKey: "goldCommodities",   iconName: "Gem",              sortOrder: 4  },
  { href: "/real-estate",        labelKey: "realEstate",        iconName: "Home",             sortOrder: 5  },
  { href: "/crypto",             labelKey: "cryptocurrency",    iconName: "Bitcoin",          sortOrder: 6  },
  { href: "/insurance",          labelKey: "insurance",         iconName: "Shield",           sortOrder: 7  },
  { href: "/cash-banking",       labelKey: "cashBanking",       iconName: "Wallet",           sortOrder: 8  },
  { href: "/liabilities",        labelKey: "liabilities",       iconName: "HandCoins",        sortOrder: 9  },
  { href: "/fixed-income",       labelKey: "fixedIncome",       iconName: "Vault",            sortOrder: 10 },
  { href: "/government-schemes", labelKey: "governmentSchemes", iconName: "Landmark",         sortOrder: 11 },
] as const;

async function main() {
  await prisma.navConfig.deleteMany({ where: { country: "IN" } });
  await prisma.navConfig.createMany({
    data: IN_NAV.map((r) => ({ ...r, country: "IN" })),
  });
  console.log(`Seeded ${IN_NAV.length} nav_config rows for IN`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add the script to `frontend/package.json`**

In `"scripts"`, after the `"db:seed"` line, add:

```json
    "db:seed-nav": "npx tsx prisma/seed-nav.ts",
```

- [ ] **Step 3: Run it**

Run: `cd frontend && npm run db:seed-nav`
Expected: `Seeded 11 nav_config rows for IN`

- [ ] **Step 4: Verify the rows**

Run:
```
cd frontend && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.navConfig.findMany({where:{country:'IN'},orderBy:{sortOrder:'asc'}}).then(r=>{console.log(r.length,'rows'); console.log(r.map(x=>x.sortOrder+' '+x.href+' '+x.iconName).join('\n'));}).finally(()=>p.\$disconnect())"
```
Expected: `11 rows`, ascending `sortOrder`, hrefs and iconNames matching `IN_NAV` (Stocks=CandlestickChart, Cash & Banking=Wallet, Liabilities=HandCoins, Fixed Income=Vault).

- [ ] **Step 5: Commit**

```bash
git add frontend/prisma/seed-nav.ts frontend/package.json
git commit -m "$(printf 'Add seed-nav script: India sidebar (11 rows)\n\nStandalone + idempotent (deleteMany where country=IN, then createMany).\nSeparate from the broadly-broken prisma/seed.ts.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 3: Update `ICON_MAP` and `NavItemDto`

**Files:**
- Modify: `frontend/src/i18n/navConfig.ts`

Current file:

```ts
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  Gem,
  Home,
  Bitcoin,
  Shield,
  Building2,
  CreditCard,
  PiggyBank,
  Landmark,
} from 'lucide-react'
import type { ElementType } from 'react'

export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,  // Dashboard
  TrendingUp,       // Stocks
  BarChart3,        // Mutual Funds
  Gem,              // Gold & Commodities
  Home,             // Real Estate
  Bitcoin,          // Cryptocurrency
  Shield,           // Insurance
  Building2,        // Cash & Banking
  CreditCard,       // Liabilities
  PiggyBank,        // Fixed Income
  Landmark,         // Government Schemes
}

export interface NavItemDto {
  id:        number
  country:   string
  href:      string
  labelKey:  string
  iconName:  string
  sortOrder: number
}
```

- [ ] **Step 1: Replace the whole file with:**

```ts
import {
  LayoutDashboard,
  CandlestickChart,
  BarChart3,
  Gem,
  Home,
  Bitcoin,
  Shield,
  Wallet,
  HandCoins,
  Vault,
  Landmark,
} from 'lucide-react'
import type { ElementType } from 'react'

export const ICON_MAP: Record<string, ElementType> = {
  LayoutDashboard,   // Dashboard
  CandlestickChart,  // Stocks
  BarChart3,         // Mutual Funds
  Gem,               // Gold & Commodities
  Home,              // Real Estate
  Bitcoin,           // Cryptocurrency
  Shield,            // Insurance
  Wallet,            // Cash & Banking
  HandCoins,         // Liabilities
  Vault,             // Fixed Income
  Landmark,          // Government Schemes
}

export interface NavItemDto {
  id:        string
  country:   string
  href:      string
  labelKey:  string
  iconName:  string
  sortOrder: number
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "i18n/navConfig\.ts|layout/Sidebar\.tsx" || echo "clean"`
Expected: `clean` — `Sidebar.tsx` reads `item.id` only as a value (or not at all) so the `number`→`string` change is safe; if it surfaces an error there, report it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/i18n/navConfig.ts
git commit -m "$(printf 'navConfig: refresh 4 icons, NavItemDto.id -> string\n\nICON_MAP now holds exactly the 11 names the seed uses:\nStocks CandlestickChart, Cash & Banking Wallet, Liabilities HandCoins,\nFixed Income Vault. Drops TrendingUp/Building2/CreditCard/PiggyBank.\nid is a uuid string now.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 4: Update `/api/nav`

**Files:**
- Modify: `frontend/src/app/api/nav/route.ts`

Current file:

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'US'

  const rows = await prisma.navConfig.findMany({
    where: { country: { in: ['ALL', country] } },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json(rows)
}
```

- [ ] **Step 1: Replace the whole file with:**

```ts
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json([], { status: 401 })

  const { searchParams } = new URL(req.url)
  const country = searchParams.get('country') ?? 'IN'

  let rows = await prisma.navConfig.findMany({
    where: { country },
    orderBy: { sortOrder: 'asc' },
  })

  // Only India is configured today; anyone whose country was IP-detected as
  // something else still gets a usable sidebar.
  if (rows.length === 0 && country !== 'IN') {
    rows = await prisma.navConfig.findMany({
      where: { country: 'IN' },
      orderBy: { sortOrder: 'asc' },
    })
  }

  return NextResponse.json(rows)
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "api/nav/route\.ts" || echo "api/nav/route.ts clean"`
Expected: `api/nav/route.ts clean`

- [ ] **Step 3: Smoke test the route**

Run `cd frontend && npm run dev` (background). Then:
```
curl -s "http://localhost:3000/api/nav?country=IN" -o /dev/null -w "no-session -> %{http_code}\n"
```
Expected: `401` (middleware blocks it without a session — the route's own guard is a fallback). Check the dev log: **no `TypeError` / `findMany` error** on that request. Stop the dev server or leave it for Task 6.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/api/nav/route.ts
git commit -m "$(printf 'api/nav: query by country with India fallback\n\nModel exists again. Default IN, drop the dead ['\''ALL'\'', country] filter,\nfall back to IN rows for any country not configured yet.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 5: Tests

**Files:**
- Create: `tests/helpers/seedNavData.ts`
- Modify: `tests/database/schema.test.ts`
- Create: `tests/api/nav/nav.test.ts`

- [ ] **Step 1: `tests/helpers/seedNavData.ts`**

```ts
import { getTestPrisma } from "./testDb";

// Keep in lockstep with frontend/prisma/seed-nav.ts.
export const IN_NAV = [
  { href: "/dashboard",          labelKey: "dashboard",         iconName: "LayoutDashboard",  sortOrder: 1  },
  { href: "/stocks",             labelKey: "stocks",            iconName: "CandlestickChart", sortOrder: 2  },
  { href: "/mutual-funds",       labelKey: "mutualFunds",       iconName: "BarChart3",        sortOrder: 3  },
  { href: "/gold-commodities",   labelKey: "goldCommodities",   iconName: "Gem",              sortOrder: 4  },
  { href: "/real-estate",        labelKey: "realEstate",        iconName: "Home",             sortOrder: 5  },
  { href: "/crypto",             labelKey: "cryptocurrency",    iconName: "Bitcoin",          sortOrder: 6  },
  { href: "/insurance",          labelKey: "insurance",         iconName: "Shield",           sortOrder: 7  },
  { href: "/cash-banking",       labelKey: "cashBanking",       iconName: "Wallet",           sortOrder: 8  },
  { href: "/liabilities",        labelKey: "liabilities",       iconName: "HandCoins",        sortOrder: 9  },
  { href: "/fixed-income",       labelKey: "fixedIncome",       iconName: "Vault",            sortOrder: 10 },
  { href: "/government-schemes", labelKey: "governmentSchemes", iconName: "Landmark",         sortOrder: 11 },
] as const;

export async function ensureNavData(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.navConfig.deleteMany({ where: { country: "IN" } });
  await prisma.navConfig.createMany({ data: IN_NAV.map((r) => ({ ...r, country: "IN" })) });
}
```

- [ ] **Step 2: Add a `nav_config table` block to `tests/database/schema.test.ts`**

After the existing `describeOrSkip("user_preference table", ...)` block (before the file's
final lines), add:

```ts
describeOrSkip("nav_config table", () => {
  test("physical column order matches the documented sequence", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'nav_config' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      "id",
      "country",
      "href",
      "labelKey",
      "iconName",
      "sortOrder",
    ]);
  });

  test("(country, href) is a unique constraint", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'nav_config'`
    );
    expect(
      rows.some(
        (r) => /UNIQUE/i.test(r.indexdef) && /country/.test(r.indexdef) && /href/.test(r.indexdef)
      )
    ).toBe(true);
  });
});
```

(This mirrors the `user_preference` block exactly — column-order via
`information_schema.columns` and the unique via `pg_indexes`. `db push` appends columns
alphabetically after `id`; if the expected array fails, adjust it to the actual order
the query returns and note it, the way the `users` test comments do.)

- [ ] **Step 3: `tests/api/nav/nav.test.ts`**

```ts
import { hasTestDb, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { ensureNavData } from "../../helpers/seedNavData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { ensureDevServer, TEST_SERVER_URL } from "../../helpers/testServer";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../../helpers/session";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    await ensureReferenceData();
    await ensureNavData();
    await ensureDevServer();
  }
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

async function cookieFor(userId: string): Promise<string> {
  const sealed = await sealSessionCookie({ userId });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

function getNav(country?: string, cookie?: string) {
  const qs = country ? `?country=${encodeURIComponent(country)}` : "";
  return fetch(`${TEST_SERVER_URL}/api/nav${qs}`, { headers: cookie ? { cookie } : {} });
}

describeOrSkip("/api/nav", () => {
  test("GET without a session cookie → 401", async () => {
    const res = await getNav("IN");
    expect(res.status).toBe(401);
  });

  test("GET ?country=IN → 11 rows, sortOrder ascending", async () => {
    const user = await createTestUser();
    try {
      const res = await getNav("IN", await cookieFor(user.id));
      expect(res.status).toBe(200);
      const rows = (await res.json()) as { href: string; sortOrder: number; iconName: string }[];
      expect(rows).toHaveLength(11);
      expect(rows.map((r) => r.sortOrder)).toEqual([...rows.map((r) => r.sortOrder)].sort((a, b) => a - b));
      expect(rows[0].href).toBe("/dashboard");
      expect(rows.find((r) => r.href === "/fixed-income")?.iconName).toBe("Vault");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("GET ?country=ZZ (unconfigured) → India's 11 rows", async () => {
    const user = await createTestUser();
    try {
      const res = await getNav("ZZ", await cookieFor(user.id));
      expect(res.status).toBe(200);
      const rows = (await res.json()) as unknown[];
      expect(rows).toHaveLength(11);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
```

- [ ] **Step 4: Run the suites**

Run the DB + API test suites the same way the repo already runs them (from
`frontend/`: `npm test`; if that misses `tests/`, use the runner the other suites use —
check for a root `jest.config` or a `test` script that targets `tests/`).
Expected: the new `nav_config table` and `/api/nav` tests pass; **no previously-passing
test regresses**. If `hasTestDb()` is false in this environment the suites skip — note
that and rely on Task 6's manual check.

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/seedNavData.ts tests/database/schema.test.ts tests/api/nav/nav.test.ts
git commit -m "$(printf 'Tests: nav_config schema + /api/nav suite\n\nColumn shape + (country, href) unique, mirroring the user_preference\nblock. API suite: 401 without session, 11 ordered IN rows, ZZ falls\nback to IN. New ensureNavData() helper, lockstep with seed-nav.ts.\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 6: Docs

**Files:**
- Create: `documents/database/nav-config.md`
- Modify: `documents/api/openapi.yaml`
- Modify: `frontend/public/api-docs/openapi.yaml` (copy)

- [ ] **Step 1: `documents/database/nav-config.md`**

Write it in the style of `documents/database/user-preference.md` (read that first for
headings/tone). Cover:
- Purpose: per-country sidebar nav; India only today; a new country adds its own rows.
- Table `nav_config`: columns (`id` uuid, `country`, `href`, `labelKey`, `iconName`,
  `sortOrder`), `@@unique([country, href])`, `@@index([country])`.
- The 11 India rows (a table: sortOrder / href / labelKey / iconName).
- How it's used: `/api/nav?country=` → `Sidebar.tsx` → `t.nav[labelKey]` +
  `ICON_MAP[iconName]`. Fallback to `IN` for unconfigured countries.
- Seeded by `frontend/prisma/seed-nav.ts` (`npm run db:seed-nav`), not the main
  `seed.ts`.

- [ ] **Step 2: Add `GET /api/nav` to `documents/api/openapi.yaml`**

Add a `Navigation` tag (after the `Preferences` tag, ~line 76) and tag-group entry
(after the `Preferences` tag-group, ~line 90), matching the existing formatting.

Add the path (place it next to `/api/preferences`, before `/dashboard`):

```yaml
  /api/nav:
    get:
      summary: Sidebar navigation items for a country
      operationId: getNav
      tags: [Navigation]
      security:
        - SessionCookie: []
      description: |
        Returns the ordered sidebar items for the given country from the `nav_config`
        table. Only India (`IN`) is configured today; any other `country` (including an
        IP-detected one the user never chose) falls back to India's rows, so the sidebar
        is never empty. Labels are keys (`labelKey` → `t.nav[...]`, translated by
        language); `iconName` maps to the client `ICON_MAP`.

        Does not require an unlocked vault — `middleware.ts` lets `/api/nav` through on
        `userId` alone.
      parameters:
        - name: country
          in: query
          required: false
          schema: { type: string, default: "IN" }
          description: ISO 3166-1 alpha-2 code. Defaults to `IN`.
      responses:
        "200":
          description: Ordered nav items (ascending `sortOrder`).
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/NavItem"
        "401":
          description: No valid session.
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Error"
              example: { error: "Unauthorized" }
```

Add the schema (in `components.schemas`, next to `Preferences`):

```yaml
    NavItem:
      type: object
      required: [id, country, href, labelKey, iconName, sortOrder]
      properties:
        id:        { type: string, description: uuid }
        country:   { type: string, example: "IN" }
        href:      { type: string, example: "/stocks" }
        labelKey:  { type: string, description: "Key into the client t.nav.* translations", example: "stocks" }
        iconName:  { type: string, description: "Key into the client ICON_MAP", example: "CandlestickChart" }
        sortOrder: { type: integer, example: 2 }
```

- [ ] **Step 3: Validate the YAML**

Run:
```
cd /Users/rahulsingh/Documents/Documents/CreativeAppz/Github/WealthVault/develop/WealthVault && node -e "const y=require('./frontend/node_modules/js-yaml');const d=y.load(require('fs').readFileSync('documents/api/openapi.yaml','utf8'));console.log('OK', !!d.paths['/api/nav'].get, !!d.components.schemas.NavItem)"
```
Expected: `OK true true`

- [ ] **Step 4: Copy to public**

Run: `cp documents/api/openapi.yaml frontend/public/api-docs/openapi.yaml`

- [ ] **Step 5: Commit**

```bash
git add documents/database/nav-config.md documents/api/openapi.yaml frontend/public/api-docs/openapi.yaml
git commit -m "$(printf 'Docs: nav_config table + GET /api/nav in the OpenAPI spec\n\nClaude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx')"
```

---

## Task 7: Manual verification + memory

No code changes.

- [ ] **Step 1: Sidebar renders**

`cd frontend && npm run dev`, sign in, unlock. The left nav shows all **11** items in
order. Icons: Stocks = candlestick, Cash & Banking = wallet, Liabilities = hand-coins,
Fixed Income = vault; the other 7 unchanged. Clicking each navigates to its `href`.

- [ ] **Step 2: No 500s**

Watch `/tmp` dev log (or the terminal) while loading `/dashboard` and other pages — no
`TypeError: Cannot read properties of undefined (reading 'findMany')` anywhere.

- [ ] **Step 3: Locale switch**

`/settings` only offers India, so `country` stays `IN`. If reachable, confirm the nav
still renders when `LocaleContext` briefly holds an IP-detected non-IN code (fallback).

- [ ] **Step 4: Update project memory**

Edit `/Users/rahulsingh/.claude/projects/-Users-rahulsingh-Documents-Documents-CreativeAppz-Github-WealthVault-develop-WealthVault/memory/api-nav-broken-deferred.md`
— mark it resolved (or delete the file and its `MEMORY.md` line), since `/api/nav` now
works and the sidebar renders.

---

## Self-review notes

- **Spec coverage:** model → Task 1; seed → Task 2; icon map + DTO → Task 3; route + fallback → Task 4; tests → Task 5; docs → Task 6; verification + memory → Task 7. Sidebar/middleware unchanged (noted in Tasks 3/4). Backend schema mirror → Task 1 Step 2.
- **Type consistency:** `IN_NAV` rows (`href`/`labelKey`/`iconName`/`sortOrder`) are identical in `seed-nav.ts` (Task 2) and `seedNavData.ts` (Task 5) — same 4 refreshed icons. `NavItemDto.id: string` (Task 3) matches the model's `id String @default(uuid())` (Task 1) and the `NavItem` schema's `id: string` (Task 6). `ICON_MAP` keys (Task 3) === every `iconName` in `IN_NAV`.
- **No placeholders:** every code block is complete; `nav-config.md` (Task 6 Step 1) is described by required content, following an existing sibling doc — acceptable for a prose doc.
- **Ordering:** Task 1 must land before 2–5 (model must exist). 3 and 4 are independent of each other. 6 is independent. 7 is last.

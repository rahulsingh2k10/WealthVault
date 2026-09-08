# User Preferences Rebuild + Settings Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore per-user persistence of `country` / `locale` / `theme` in a new `user_preference` table and add a `/settings` page that edits them.

**Architecture:** The preferences UI, the `/api/preferences` route, `savePreference()` and `PreferencesSync` all already exist and are correct — they only broke because the `AppConfig` Prisma model was deleted. This plan re-adds the model as `UserPreference`, repoints the route's two delegate calls, adds a `/settings` page that binds three controls to the existing `useLocale()` / `useTheme()` setters, and wires the sidebar's dead "Settings" item to it.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL (`prisma db push`, no migrations), next-themes, Jest test suite under `tests/` driven by `run-tests.sh` against a real dev server.

**Spec:** `docs/superpowers/specs/2026-09-08-user-preferences-rebuild-design.md`

---

## Background the engineer needs

- **Two Prisma schemas exist.** Only `frontend/prisma/schema.prisma` matters here — the route runs as a Next.js API route using `frontend/src/lib/prisma.ts`. `backend/` is untouched.
- **No migrations.** Schema changes are applied with `npx prisma db push` from `frontend/`. It is destructive-by-diff but adding a brand-new table + FK is purely additive.
- **`DATABASE_URL == TEST_DATABASE_URL`** in `frontend/.env` in this environment. That is deliberate for the test suite (the API tests assert it and refuse to run otherwise). One `db push` covers both the app and the tests.
- **Test suite shape.** `tests/` is its own npm project. Suites live in `tests/api/**`, `tests/database/**`. They boot a real `next dev` on port 3100 (`ensureDevServer`) and hit it over HTTP, using a sealed iron-session cookie for auth. Run everything with `./run-tests.sh` (from repo root) or one suite with `./run-tests.sh api`. Run a single file with `cd tests && npx jest --config jest.config.js --runInBand <pattern>`.
- **Baseline:** full suite is 208/209 green (one unrelated pre-existing failure). `next build` / clean `tsc` already fail in `frontend/` due to the earlier schema reduction — do **not** use them as a gate; use test-suite green + `tsc` error-count delta.
- **Current route** (`frontend/src/app/api/preferences/route.ts`) — for reference, this is what exists now:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const DEFAULTS = { country: 'US', locale: 'en-US', theme: 'dark' }
const ALLOWED = ['country', 'locale', 'theme']

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const rows = await prisma.appConfig.findMany({ where: { userId: session.userId, key: { in: ALLOWED } } })
  const prefs = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const { key, value } = await req.json()
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

## File Structure

### Created

| File | Responsibility |
|------|----------------|
| `tests/api/preferences/preferences.test.ts` | HTTP-level tests for `GET`/`PATCH /api/preferences` and the `/settings` route guard |
| `frontend/src/app/settings/page.tsx` | Server component: unlock guard + `AppShell` shell, renders `<SettingsPanel />` |
| `frontend/src/components/settings/SettingsPanel.tsx` | Client component: country / language / theme controls bound to existing context setters |

### Modified

| File | Change |
|------|--------|
| `frontend/prisma/schema.prisma` | Add `UserPreference` model + `User.userPreferences` back-relation |
| `frontend/src/app/api/preferences/route.ts` | `prisma.appConfig` → `prisma.userPreference` (2 call sites) |
| `frontend/src/components/layout/Sidebar.tsx` | "Settings" `SheetItem` `onClick` → navigate to `/settings` |
| `tests/helpers/testUser.ts` | `deleteTestUser` also clears the user's `userPreference` rows (FK, no cascade) |
| `tests/database/schema.test.ts` | Add `user_preference` column-order assertion |
| `tests/run-tests.ts` | Register the `preferences` suite |
| `run-tests.sh` | Register the `preferences` suite in `API_SUITES` |

### Explicitly NOT touched

`frontend/prisma/seed.ts` — already non-functional against the reduced schema (references `appConfig` + ~6 dropped models). Out of scope.

---

## Task 1: Register the `preferences` suite and write the failing API tests

**Files:**
- Create: `tests/api/preferences/preferences.test.ts`
- Modify: `tests/run-tests.ts`
- Modify: `run-tests.sh:78` (the `API_SUITES=(...)` line)

- [ ] **Step 1: Register the suite in the TS orchestrator**

In `tests/run-tests.ts`, add `"preferences"` to both the type and the array:

```typescript
type Suite = "auth" | "unlock" | "dashboard" | "upgrade" | "preferences" | "subscription" | "database" | "playwright";
const ALL_SUITES: Suite[] = ["auth", "unlock", "dashboard", "upgrade", "preferences", "subscription", "database", "playwright"];
```

And add a `case` in `runSuite` (place it right after the `upgrade` case):

```typescript
    case "preferences":
      return runJest("api/preferences");
```

- [ ] **Step 2: Register the suite in `run-tests.sh`**

Change the `API_SUITES` array (currently one line) to include the new suite before `subscription`:

```bash
API_SUITES=("Auth API Tests:auth" "Unlock API Tests:unlock" "Dashboard API Tests:dashboard" "Upgrade Prompt Tests:upgrade" "Preferences API Tests:preferences" "Subscription Tests:subscription")
```

- [ ] **Step 3: Write the failing test file**

Create `tests/api/preferences/preferences.test.ts`:

```typescript
import { hasTestDb, disconnectTestPrisma, getTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
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
    await ensureDevServer();
  }
}, 70000);

afterAll(async () => {
  await disconnectTestPrisma();
});

async function cookieFor(userId: string): Promise<string> {
  // /api/preferences sits behind middleware.ts but is explicitly allowed
  // without encryptionKey — only userId is required.
  const sealed = await sealSessionCookie({ userId });
  return `${SESSION_COOKIE_NAME}=${sealed}`;
}

function getPrefs(cookie?: string) {
  return fetch(`${TEST_SERVER_URL}/api/preferences`, {
    headers: cookie ? { cookie } : {},
  });
}

function patchPref(body: unknown, cookie?: string) {
  return fetch(`${TEST_SERVER_URL}/api/preferences`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

describeOrSkip("/api/preferences", () => {
  test("GET without a session cookie → 401", async () => {
    const res = await getPrefs();
    expect(res.status).toBe(401);
  });

  test("PATCH without a session cookie → 401", async () => {
    const res = await patchPref({ key: "country", value: "IN" });
    expect(res.status).toBe(401);
  });

  test("GET for a user with no rows → all defaults", async () => {
    const user = await createTestUser();
    try {
      const res = await getPrefs(await cookieFor(user.id));
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ country: "US", locale: "en-US", theme: "dark" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("PATCH persists a preference and GET reads it back over the defaults", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      const patch = await patchPref({ key: "country", value: "IN" }, cookie);
      expect(patch.status).toBe(200);
      await expect(patch.json()).resolves.toEqual({ success: true });

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ userId: user.id, key: "country", value: "IN" });

      const get = await getPrefs(cookie);
      await expect(get.json()).resolves.toEqual({ country: "IN", locale: "en-US", theme: "dark" });
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a second PATCH on the same key updates the same row (upsert, not insert)", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      await patchPref({ key: "theme", value: "light" }, cookie);
      await patchPref({ key: "theme", value: "dark" }, cookie);

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id, key: "theme" } });
      expect(rows).toHaveLength(1);
      expect(rows[0].value).toBe("dark");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("PATCH with a key outside the allow-list → 400 and writes nothing", async () => {
    const user = await createTestUser();
    const cookie = await cookieFor(user.id);
    try {
      const res = await patchPref({ key: "isAdmin", value: "true" }, cookie);
      expect(res.status).toBe(400);

      const prisma = getTestPrisma();
      const rows = await prisma.userPreference.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
```

- [ ] **Step 4: Run the suite and confirm it fails for the right reason**

Run: `cd tests && npx jest --config jest.config.js --runInBand api/preferences`

Expected: the four tests that touch `prisma.userPreference` / a persisted value **FAIL**. `prisma.userPreference` is `undefined` (`TypeError: Cannot read properties of undefined`) in the test process, and the route's `prisma.appConfig.findMany` throws server-side so `PATCH`/`GET` return 500 — so `GET ... → all defaults` and the persistence tests fail. The two `401` tests may already pass (middleware handles them). This is the expected red.

- [ ] **Step 5: Commit**

```bash
git add tests/api/preferences/preferences.test.ts tests/run-tests.ts run-tests.sh
git commit -m "Add failing preferences API test suite + register it in the runner

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 2: Restore the model as `UserPreference` and push it

**Files:**
- Modify: `frontend/prisma/schema.prisma` (add model near the other small models, e.g. after `ProcessedWebhookEvent`; add relation field inside `model User`)

- [ ] **Step 1: Add the `UserPreference` model**

Append to `frontend/prisma/schema.prisma` (after the `ProcessedWebhookEvent` model):

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

- [ ] **Step 2: Add the back-relation on `User`**

Inside `model User { ... }`, next to the other relation lists (e.g. right after `subscriptions           Subscription[]`), add:

```prisma
  userPreferences         UserPreference[]
```

Match the column alignment of the surrounding fields.

- [ ] **Step 3: Regenerate the Prisma client**

Run: `cd frontend && npx prisma generate`
Expected: `✔ Generated Prisma Client` with no schema validation error.

- [ ] **Step 4: Push the schema to the database**

Run: `cd frontend && npx prisma db push`
Expected: `The database is now in sync with your Prisma schema.` and a line indicating `user_preference` was created. No prompt about data loss (the change is additive).

- [ ] **Step 5: Verify the table exists with the expected columns**

Run:
```bash
cd frontend && npx prisma db execute --stdin <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_name = 'user_preference' ORDER BY ordinal_position;
SQL
```
Expected columns, in order: `id, userId, key, value, createdAt, updatedAt`.
(If `prisma db execute` prints no rows, fall back to `npx prisma studio` and confirm the `UserPreference` model is listed.)

- [ ] **Step 6: Commit**

```bash
git add frontend/prisma/schema.prisma
git commit -m "Restore user preferences as the UserPreference model (user_preference)

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 3: Repoint the route and fix test-user cleanup

**Files:**
- Modify: `frontend/src/app/api/preferences/route.ts`
- Modify: `tests/helpers/testUser.ts`

- [ ] **Step 1: Point the route at the new delegate**

In `frontend/src/app/api/preferences/route.ts`, change the two `prisma.appConfig` references to `prisma.userPreference`. Final file:

```typescript
import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

const DEFAULTS = { country: 'US', locale: 'en-US', theme: 'dark' }
const ALLOWED = ['country', 'locale', 'theme']

export async function GET() {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const rows = await prisma.userPreference.findMany({ where: { userId: session.userId, key: { in: ALLOWED } } })
  const prefs = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) }
  return NextResponse.json(prefs)
}

export async function PATCH(req: Request) {
  const session = await getSession()
  if (!session.userId) return NextResponse.json({}, { status: 401 })

  const { key, value } = await req.json()
  if (!ALLOWED.includes(key)) return NextResponse.json({ error: 'Invalid key' }, { status: 400 })

  await prisma.userPreference.upsert({
    where:  { userId_key: { userId: session.userId, key } },
    update: { value },
    create: { userId: session.userId, key, value },
  })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Clear `userPreference` rows in `deleteTestUser`**

The `UserPreference.user` relation has no `onDelete: Cascade`, so `prisma.user.delete` throws `P2003` if the user has preference rows. In `tests/helpers/testUser.ts`, add one line to `deleteTestUser` before the `user.delete` call:

```typescript
export async function deleteTestUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.subscription.deleteMany({ where: { userId } });
  await prisma.subscriptionPlanHistory.deleteMany({ where: { userId } });
  await prisma.userPreference.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}
```

- [ ] **Step 3: Run the preferences suite — expect green**

Run: `cd tests && npx jest --config jest.config.js --runInBand api/preferences`
Expected: all 6 tests **PASS**.

- [ ] **Step 4: Check the `tsc` error-count delta in `frontend/`**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Expected: the count is **lower than or equal to** the pre-change baseline — the `prisma.appConfig` references were themselves type errors and are now valid. Note the number in the commit if it changed.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/api/preferences/route.ts tests/helpers/testUser.ts
git commit -m "Point /api/preferences at prisma.userPreference; clear prefs in deleteTestUser

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 4: Add the schema column-order assertion

**Files:**
- Modify: `tests/database/schema.test.ts`

- [ ] **Step 1: Add the test**

At the end of `tests/database/schema.test.ts`, inside the top-level `describeOrSkip` (match the file's existing structure — look at how the `auth_platforms` / `subscription_plans` blocks are written and mirror them), add:

```typescript
describeOrSkip("user_preference table", () => {
  test("column order matches the schema definition", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'user_preference' ORDER BY ordinal_position`
    );
    expect(rows.map((r) => r.column_name)).toEqual([
      "id",
      "userId",
      "key",
      "value",
      "createdAt",
      "updatedAt",
    ]);
  });

  test("(userId, key) is unique", async () => {
    const prisma = getTestPrisma();
    const rows = await prisma.$queryRawUnsafe<{ indexdef: string }[]>(
      `SELECT indexdef FROM pg_indexes WHERE tablename = 'user_preference'`
    );
    expect(rows.some((r) => /UNIQUE.*\(.*"?userId"?.*,.*"?key"?.*\)/i.test(r.indexdef))).toBe(true);
  });
});
```

If the file already has a shared `beforeAll`/`afterAll` and `getTestPrisma` import at the top (it does), you do not need to re-add them — just append the `describeOrSkip("user_preference table", ...)` block.

- [ ] **Step 2: Run the database suite**

Run: `cd tests && npx jest --config jest.config.js --runInBand database`
Expected: all schema tests **PASS**, including the two new ones. If the column-order assertion fails, replace the expected array with the actual order the failure prints (Prisma's `db push` can reorder — the existing `users` test documents this) and re-run.

- [ ] **Step 3: Commit**

```bash
git add tests/database/schema.test.ts
git commit -m "Assert user_preference table shape in the database schema suite

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 5: Build the `/settings` page

**Files:**
- Create: `frontend/src/app/settings/page.tsx`
- Create: `frontend/src/components/settings/SettingsPanel.tsx`
- Modify: `tests/api/preferences/preferences.test.ts` (add the route-guard block)

- [ ] **Step 1: Write the failing route-guard test**

Append this block to `tests/api/preferences/preferences.test.ts`, inside the file (a new top-level `describe`, sibling to `/api/preferences`):

```typescript
describe("GET /settings (route guard)", () => {
  function getSettings(cookie?: string) {
    return fetch(`${TEST_SERVER_URL}/settings`, { redirect: "manual", headers: cookie ? { cookie } : {} });
  }

  test("redirects to / when there is no session", async () => {
    const res = await getSettings();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/");
  });

  test("redirects to /unlock when the vault is locked", async () => {
    const sealed = await sealSessionCookie({ userId: "no-such-user" });
    const res = await getSettings(`${SESSION_COOKIE_NAME}=${sealed}`);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/unlock");
  });

  test("returns 200 HTML when userId + encryptionKey are present", async () => {
    const sealed = await sealSessionCookie({ userId: "no-such-user", encryptionKey: "fake-key" });
    const res = await getSettings(`${SESSION_COOKIE_NAME}=${sealed}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
  });
});
```

- [ ] **Step 2: Run it and confirm the 200 test fails**

Run: `cd tests && npx jest --config jest.config.js --runInBand api/preferences -t "route guard"`
Expected: the "no session → /" test passes (middleware); the `/unlock` and `200` tests **FAIL** with 404 (no `/settings` route yet). Note: the middleware may 307 unmatched paths differently — if "no session" also 404s, that is fine, the point is the 200 case must go green in step 5.

- [ ] **Step 3: Create the `SettingsPanel` client component**

Create `frontend/src/components/settings/SettingsPanel.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useLocale } from "@/context/LocaleContext";
import { LOCALES, type Locale } from "@/i18n/translations";
import { COUNTRIES, countryFlag } from "@/i18n/countries";
import { savePreference } from "@/lib/savePreference";

export function SettingsPanel() {
  const { t, locale, setLocale, country, setCountry } = useLocale();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = !mounted || theme !== "light";

  const chooseTheme = (next: "dark" | "light") => {
    setTheme(next);
    savePreference("theme", next);
  };

  return (
    <div
      className="mx-auto flex w-full max-w-[560px] flex-col gap-6 rounded-2xl p-6"
      style={{
        background: "var(--ui-card-bg)",
        border: "1px solid var(--ui-card-border)",
        boxShadow: "var(--ui-card-shadow)",
      }}
    >
      {/* Country */}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {t.sidebar.country}
        </span>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--ui-input-bg)",
            border: "1px solid var(--ui-input-border)",
            color: "var(--ui-text-pri)",
          }}
        >
          {COUNTRIES.map(({ code, name }) => (
            <option key={code} value={code}>
              {countryFlag(code)} {name}
            </option>
          ))}
        </select>
      </label>

      {/* Language */}
      <label className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {t.sidebar.language}
        </span>
        <select
          value={locale}
          onChange={(e) => setLocale(e.target.value as Locale)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{
            background: "var(--ui-input-bg)",
            border: "1px solid var(--ui-input-border)",
            color: "var(--ui-text-pri)",
          }}
        >
          {LOCALES.map(({ code, native }) => (
            <option key={code} value={code}>
              {native}
            </option>
          ))}
        </select>
      </label>

      {/* Theme */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold" style={{ color: "var(--ui-text-pri)" }}>
          {t.sidebar.settings}
        </span>
        <div
          className="inline-flex w-fit overflow-hidden rounded-lg"
          style={{ border: "1px solid var(--ui-input-border)" }}
        >
          {(["dark", "light"] as const).map((mode) => {
            const active = mode === "dark" ? isDark : !isDark;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => chooseTheme(mode)}
                className="px-4 py-2 text-sm font-medium capitalize transition-colors"
                style={{
                  background: active ? "var(--ui-accent)" : "var(--ui-input-bg)",
                  color: active ? "var(--ui-on-accent)" : "var(--ui-text-sec)",
                }}
              >
                {mode}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

Notes:
- `setCountry` and `setLocale` from `useLocale()` **already** call `savePreference()` internally (see `frontend/src/context/LocaleContext.tsx`) — binding the `<select>`s to them is the entire persistence path. Only theme needs the explicit `savePreference` call, mirroring `ThemeTogglePill`.
- The "Theme" heading reuses `t.sidebar.settings` only because there is no dedicated key; if a reviewer objects, hardcode the string `"Theme"` — do not add 12 locale entries.

- [ ] **Step 4: Create the settings page (server component)**

Create `frontend/src/app/settings/page.tsx`, mirroring `frontend/src/app/subscription/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/session";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session.encryptionKey || !session.userId) redirect("/unlock");

  return (
    <AppShell title="Settings">
      <SettingsPanel />
    </AppShell>
  );
}
```

- [ ] **Step 5: Run the guard tests — expect green**

Run: `cd tests && npx jest --config jest.config.js --runInBand api/preferences`
Expected: every test in the file **PASSES** (the original 6 plus the 3 guard tests).

- [ ] **Step 6: Manual visual check**

Start the app (`cd frontend && npm run dev`), log in, unlock, visit `http://localhost:3000/settings`. Confirm: the card renders in both dark and light mode; changing Country to India and reloading keeps India selected; `select * from user_preference` shows a `country=IN` row for your user.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/settings/page.tsx frontend/src/components/settings/SettingsPanel.tsx tests/api/preferences/preferences.test.ts
git commit -m "Add /settings page with country, language and theme controls

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 6: Wire the sidebar "Settings" item to `/settings`

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx` (the `SheetItem` with `icon={Settings}` / `label={t.sidebar.settings}`, currently around line 210–214)

- [ ] **Step 1: Change the onClick**

The item currently reads:

```tsx
<SheetItem
  icon={Settings}
  label={t.sidebar.settings}
  onClick={() => setSheetOpen(false)}
/>
```

Change `onClick` to navigate, matching the Subscription item just below it:

```tsx
<SheetItem
  icon={Settings}
  label={t.sidebar.settings}
  onClick={() => {
    setSheetOpen(false);
    router.push("/settings");
  }}
/>
```

`router` (`useRouter()`) is already in scope at the top of `Sidebar`.

- [ ] **Step 2: Manual check**

With the app running: open the sidebar profile sheet, click "Settings" → lands on `/settings`, sheet closes.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "Wire the sidebar Settings item to /settings

Claude-Session: https://claude.ai/code/session_01XrnSY2DstZc8N5P4rBWg62"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the whole test suite**

Run (from repo root): `./run-tests.sh`
Expected: `preferences` suite green; `database` suite green; overall still at the 208/209 baseline (the one known unrelated failure is the only red). If anything else fails, stop and diagnose before proceeding.

- [ ] **Step 2: Confirm no stray `appConfig` references remain**

Run: `rg -n "appConfig|AppConfig|app_config" frontend/src tests`
Expected: no matches in `frontend/src` or `tests`. (`frontend/prisma/seed.ts` may still match — that is the known out-of-scope file.)

- [ ] **Step 3: Final `tsc` delta note**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Record the number. It should be ≤ the starting baseline.

- [ ] **Step 4: Update memory / docs if the project tracks status**

No code change. If `MEMORY.md` has a relevant entry, note that user preferences are reconnected via the `user_preference` table and a `/settings` page.

---

## Self-Review notes (for the implementer)

- **Spec coverage:** schema restore → Task 2; route repoint → Task 3; `/settings` page + panel → Task 5; sidebar wiring → Task 6; API test suite → Tasks 1/3/5; schema assertion → Task 4; suite registration → Task 1. `seed.ts` explicitly excluded per spec.
- **Name consistency:** model `UserPreference`, table `user_preference`, delegate `prisma.userPreference`, relation field `User.userPreferences`, test suite key `preferences`, route path `/api/preferences` (unchanged), page `/settings`. Used consistently in every task above.
- **The `deleteTestUser` change (Task 3 Step 2) is load-bearing** for every test in the new suite that calls `createTestUser` — do not skip it or the tests will fail on cleanup with `P2003`.

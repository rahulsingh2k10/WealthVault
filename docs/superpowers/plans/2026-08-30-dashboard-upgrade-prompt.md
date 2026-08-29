# Dashboard Upgrade Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show `FREE`-tier users a centered "upgrade your plan" modal 6 seconds after the dashboard loads, once per browser session, presenting the three paid plans (Reserve / Treasury / Sovereign) with offer-aware pricing and an animated border beam on the selected card. Presentational only — no checkout.

**Architecture:** The dashboard page (a server component) calls a new server function `getUpgradePromptData(userId)` that returns `null` unless the signed-in user exists and is on `FREE`; otherwise it returns serialisable plan view-models + an optional member count. A client controller `<UpgradePrompt>` owns the 6 s timer and `sessionStorage` suppression; a client `<UpgradeModal>` renders the UI (portalled to `document.body`, framer-motion transitions). Pricing lives in the existing `SubscriptionPlan` table — no new API route. The supplied `border-beam.tsx` drops into `components/ui/` verbatim and is coloured from existing `--ui-accent` / `--ui-accent-warm` theme tokens.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS (`darkMode: "class"`, `next-themes`), Prisma 5 + PostgreSQL, `framer-motion` (already a dependency), `iron-session`. Tests: Jest via `tests/jest.config.js` (node env, `ts-jest`) and Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-dashboard-upgrade-prompt-design.md`
**Visual reference:** `.superpowers/brainstorm/mockup-upgrade-sheet-v10.html`
**Branch:** `feature/dashboard-upgrade-prompt` (already created; the spec is already committed there).

---

## Conventions used below

- All paths are repo-relative from `/Users/rahulsingh/Documents/Documents/CreativeAppz/Github/WealthVault/main/WealthVault`.
- Run Jest suites from the `tests/` directory: `cd tests && npx jest --config jest.config.js <pattern> --runInBand`.
- **Type-check baseline:** the frontend currently has **89 pre-existing `tsc` errors** — a stale generated Prisma client vs. a reduced 4-model `schema.prisma` (asset models like `bankAccount`, `equityHolding`, `navConfig` are referenced by `seed.ts` and many API routes but not in the schema). This is an unrelated in-progress migration; **do not fix it**. Every "type-check" step below means:
  `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → the count must **stay at 89** (not increase), **and**
  `cd frontend && npx tsc --noEmit 2>&1 | grep -E "<files you created/modified>"` → must be **empty**.
  The generated client *does* have `User`, `SubscriptionPlan` (incl. `price`, `offerPrice`, `offerStartDate`, `offerEndDate`, `currency`, `isActive`, `tier`), `SubscriptionPeriod`, `AuthPlatform` — everything this feature uses.
- **`next build` does not pass on this codebase** (those 89 errors). Do not run it. Runtime verification is via the Playwright e2e (which uses `next dev`, and `next dev` does not fail on type errors).
- The repo rule (`CLAUDE.md`): surgical changes only, match existing style, YAGNI. Every commit message ends with the trailer:
  `Claude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB`

---

## File structure

### New files

| File | Responsibility |
|---|---|
| `frontend/src/components/ui/border-beam.tsx` | Animated gradient border overlay. Pasted verbatim from the task; only depends on `cn` + React. |
| `frontend/src/lib/services/UpgradePromptService.ts` | Server-only. `buildPlanCardView(plan, now)` (pure) + `getUpgradePromptData(userId)` (Prisma) + the `PlanCardView` / `UpgradePromptData` / `PaidTier` types. |
| `frontend/src/components/dashboard/UpgradePrompt.tsx` | `"use client"` controller: the 6 s timer, `sessionStorage` suppression, nothing visual. Renders `<UpgradeModal>`. |
| `frontend/src/components/dashboard/UpgradeModal.tsx` | `"use client"` UI: portalled backdrop + panel, segmented control (desktop), three selectable plan cards, features, trust row, "Maybe later". |
| `tests/api/upgrade-prompt/format-money.test.ts` | Unit tests for `formatMoney`. |
| `tests/api/upgrade-prompt/plan-card-view.test.ts` | Unit tests for `buildPlanCardView` (pure, no DB). |
| `tests/api/upgrade-prompt/service.test.ts` | Integration tests for `getUpgradePromptData` (real `@/lib/prisma`, `describeOrSkip` + DB-URL safety check pattern). |
| `tests/e2e/upgrade-prompt.spec.ts` | Playwright: FREE user sees it / dismiss persists / paid user never sees it / selection sync. |

### Modified files

| File | Change |
|---|---|
| `frontend/src/lib/utils.ts` | Append `formatMoney(amount, currency, locale)`. |
| `frontend/src/app/dashboard/page.tsx` | Call `getUpgradePromptData`; render `<UpgradePrompt>` when non-null. |
| `frontend/src/i18n/translations.ts` | Add `upgrade` namespace to the `Translations` interface and to all 11 locale objects. |
| `frontend/prisma/seed.ts` | Replace the placeholder `subscriptionPlan.createMany` block with real placeholder pricing + a launch offer. |
| `tests/helpers/seedReferenceData.ts` | Add `Tier` type + `getPlanId(tier)`; make `getFreePlanId` delegate; give `ensureReferenceData` the same pricing + offer fields as the seed (with `update:` so re-runs refresh). |
| `tests/helpers/testUser.ts` | `createTestUser` accepts `{ tier }` (default `"FREE"`). |
| `tests/run-tests.ts` | Register an `"upgrade"` suite → `runJest("api/upgrade-prompt")`. |
| `run-tests.sh` | Add `"Upgrade Prompt Tests:upgrade"` to the `API_SUITES` array. |
| `tests/playwright.config.ts` | Add `NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS: "300"` to `webServer.env`. |

---

## Task 1: `formatMoney` currency helper

**Files:**
- Modify: `frontend/src/lib/utils.ts` (append at end of file)
- Test: `tests/api/upgrade-prompt/format-money.test.ts` (create)

`formatINR` in `utils.ts` always renders 2 decimal places; subscription prices are whole rupees. `formatMoney` is a small locale-aware, currency-generic, zero-decimal formatter.

- [ ] **Step 1: Write the failing test**

Create `tests/api/upgrade-prompt/format-money.test.ts`:

```ts
import { formatMoney } from "@/lib/utils";

describe("formatMoney", () => {
  test("formats whole INR with the ₹ symbol and no decimals", () => {
    expect(formatMoney(1600, "INR")).toBe("₹1,600");
    expect(formatMoney(12000, "INR")).toBe("₹12,000");
    expect(formatMoney(0, "INR")).toBe("₹0");
  });

  test("groups Indian-style by default (en-IN)", () => {
    expect(formatMoney(1800000, "INR")).toBe("₹18,00,000");
  });

  test("honours an explicit locale + currency", () => {
    expect(formatMoney(1600, "USD", "en-US")).toBe("$1,600");
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd tests && npx jest --config jest.config.js api/upgrade-prompt/format-money --runInBand`
Expected: FAIL — `formatMoney is not a function` (or a module-resolution error for the missing export).

- [ ] **Step 3: Implement**

Append to `frontend/src/lib/utils.ts`:

```ts
/**
 * Format a whole-unit money amount for display, e.g.
 *   formatMoney(1600, "INR")            → "₹1,600"
 *   formatMoney(1600, "USD", "en-US")   → "$1,600"
 * Unlike formatINR, this shows no decimal places — subscription prices are whole units.
 */
export function formatMoney(amount: number, currency: string, locale = "en-IN"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd tests && npx jest --config jest.config.js api/upgrade-prompt/format-money --runInBand`
Expected: PASS (3 tests). If the `en-IN` grouping assertion fails because the CI Node lacks full ICU, replace `"₹18,00,000"` with the value the runtime produces and note it — Node 20 ships full ICU so this should pass as written.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/utils.ts tests/api/upgrade-prompt/format-money.test.ts
git commit -m "$(printf 'Add formatMoney helper for whole-unit currency display\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 2: Add `border-beam.tsx` verbatim

**Files:**
- Create: `frontend/src/components/ui/border-beam.tsx`

The component from the task depends only on `@/lib/utils` `cn` and React — no shadcn primitives, no new dependencies. It goes in the existing `components/ui/` folder unchanged. `demo.tsx` is **not** copied (it is usage documentation only).

- [ ] **Step 1: Create the file**

Create `frontend/src/components/ui/border-beam.tsx` with **exactly** this content:

```tsx
"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Injects a block of CSS into the document head exactly once (keyed by id).
 */
function useGlobalStyles(css: string, id: string) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(id)) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }, [css, id]);
}

const BORDER_BEAM_STYLES = `
@keyframes border-beam-spin {
  from {
    --angle: 0deg;
  }
  to {
    --angle: 360deg;
  }
}

@property --angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}
`;

interface BorderBeamProps {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  /** Match iOS-style squircle corners (requires Chrome 139+) */
  squircle?: boolean;
}

export function BorderBeam({
  className,
  size = 200,
  duration = 12,
  delay = 0,
  colorFrom = "#ffaa40",
  colorTo = "#9c40ff",
  borderWidth = 1.5,
  squircle = false,
}: BorderBeamProps) {
  useGlobalStyles(BORDER_BEAM_STYLES, "border-beam-styles");

  const squircleStyle = squircle
    ? ({ cornerShape: "squircle" } as React.CSSProperties)
    : {};

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        className,
      )}
      style={
        {
          "--size": size,
          "--duration": `${duration}s`,
          "--delay": `-${delay}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--border-width": `${borderWidth}px`,
          ...squircleStyle,
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={
          {
            padding: "var(--border-width)",
            background: `
            linear-gradient(
              var(--angle, 0deg),
              transparent 0%,
              transparent 35%,
              var(--color-from) 50%,
              var(--color-to) 65%,
              transparent 80%,
              transparent 100%
            )
          `,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMask:
              "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            animation: `border-beam-spin var(--duration) linear infinite var(--delay)`,
            ...squircleStyle,
          } as React.CSSProperties
        }
      />
    </div>
  );
}

export default BorderBeam;
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors. (`cornerShape` is not in React's `CSSProperties` — the file already casts through `as React.CSSProperties`, so it compiles.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/border-beam.tsx
git commit -m "$(printf 'Add BorderBeam component (animated gradient border)\n\nSupplied component, pasted verbatim into components/ui. Depends only on\ncn + React; no shadcn setup required.\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 3: `UpgradePromptService` — types + `buildPlanCardView` (pure)

**Files:**
- Create: `frontend/src/lib/services/UpgradePromptService.ts`
- Test: `tests/api/upgrade-prompt/plan-card-view.test.ts` (create)

`buildPlanCardView` turns a `SubscriptionPlan` row into the view model the modal renders. It is pure — `now` is injected — so offer-window logic is unit-testable without a clock.

- [ ] **Step 1: Write the failing test**

Create `tests/api/upgrade-prompt/plan-card-view.test.ts`:

```ts
import { buildPlanCardView } from "@/lib/services/UpgradePromptService";
// Type-only import from the frontend's generated client (same approach as tests/helpers/testDb.ts).
// Erased at compile time, so it does not require the tests/ dir to have a generated Prisma client.
import type { SubscriptionPlan } from "../../frontend/node_modules/@prisma/client";

// Minimal SubscriptionPlan-shaped row. buildPlanCardView only reads tier / price /
// offerPrice / currency / offerStartDate / offerEndDate, and coerces prices with Number(),
// so plain numbers stand in for Prisma.Decimal.
function plan(overrides: Partial<Record<keyof SubscriptionPlan, unknown>>): SubscriptionPlan {
  return {
    tier: "QUARTERLY",
    price: 6000,
    offerPrice: null,
    currency: "INR",
    offerStartDate: null,
    offerEndDate: null,
    ...overrides,
  } as unknown as SubscriptionPlan;
}

const NOW = new Date("2026-09-01T00:00:00Z");

describe("buildPlanCardView", () => {
  test("no offerPrice → offer inactive, effective = base, 0% discount", () => {
    const v = buildPlanCardView(plan({ tier: "MONTHLY", price: 3000 }), NOW);
    expect(v).toMatchObject({
      tier: "MONTHLY",
      billingMonths: 1,
      currency: "INR",
      basePerPeriod: 3000,
      effectivePerPeriod: 3000,
      offerActive: false,
      discountPercent: 0,
      offerEndsAt: null,
    });
  });

  test("offerPrice + now inside the window → offer active", () => {
    const v = buildPlanCardView(
      plan({
        tier: "ANNUAL",
        price: 18000,
        offerPrice: 14400,
        offerStartDate: new Date("2026-08-01T00:00:00Z"),
        offerEndDate: new Date("2026-09-30T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(true);
    expect(v.billingMonths).toBe(12);
    expect(v.effectivePerPeriod).toBe(14400);
    expect(v.discountPercent).toBe(20);
    expect(v.offerEndsAt).toBe("2026-09-30T23:59:59.000Z");
  });

  test("now after offerEndDate → offer inactive", () => {
    const v = buildPlanCardView(
      plan({
        offerPrice: 4800,
        offerStartDate: new Date("2026-08-01T00:00:00Z"),
        offerEndDate: new Date("2026-08-31T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(false);
    expect(v.effectivePerPeriod).toBe(6000);
    expect(v.discountPercent).toBe(0);
    expect(v.offerEndsAt).toBeNull();
  });

  test("now before offerStartDate → offer inactive", () => {
    const v = buildPlanCardView(
      plan({
        offerPrice: 4800,
        offerStartDate: new Date("2026-10-01T00:00:00Z"),
        offerEndDate: new Date("2026-12-31T23:59:59Z"),
      }),
      NOW,
    );
    expect(v.offerActive).toBe(false);
  });

  test("open-ended window (both dates null) with an offerPrice → offer active", () => {
    const v = buildPlanCardView(plan({ offerPrice: 5100 }), NOW);
    expect(v.offerActive).toBe(true);
    expect(v.discountPercent).toBe(15); // round(1 - 5100/6000) = 15
  });

  test("discount percent is rounded", () => {
    const v = buildPlanCardView(plan({ price: 1000, offerPrice: 853 }), NOW);
    expect(v.discountPercent).toBe(15); // 14.7 → 15
  });
});
```

- [ ] **Step 2: Run it — expect failure**

Run: `cd tests && npx jest --config jest.config.js api/upgrade-prompt/plan-card-view --runInBand`
Expected: FAIL — cannot find module `@/lib/services/UpgradePromptService` / `buildPlanCardView` undefined.

- [ ] **Step 3: Implement the service file**

Create `frontend/src/lib/services/UpgradePromptService.ts`:

```ts
import { prisma } from "@/lib/prisma";
import type { SubscriptionPlan } from "@prisma/client";

export type PaidTier = "MONTHLY" | "QUARTERLY" | "ANNUAL";

const BILLING_MONTHS: Record<PaidTier, 1 | 3 | 12> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  ANNUAL: 12,
};

export interface PlanCardView {
  tier: PaidTier;
  billingMonths: 1 | 3 | 12;
  currency: string;
  /** Amount per billing period, whole units (e.g. 6000 for a ₹6,000/quarter plan). */
  basePerPeriod: number;
  /** offerPrice when the offer is live, otherwise basePerPeriod. */
  effectivePerPeriod: number;
  offerActive: boolean;
  /** round((1 - effective/base) * 100); 0 when no offer is active. */
  discountPercent: number;
  /** ISO string of offerEndDate when the offer is live, else null. */
  offerEndsAt: string | null;
}

export interface UpgradePromptData {
  plans: PlanCardView[];
  /** Paid-member count floored to a round hundred, or null when <= 100. */
  memberCount: number | null;
}

/**
 * Turn a SubscriptionPlan row into the view model the modal renders.
 * Pure: `now` is injected so the offer window is testable without a clock.
 */
export function buildPlanCardView(plan: SubscriptionPlan, now: Date): PlanCardView {
  const tier = plan.tier as PaidTier;
  const base = Number(plan.price);
  const offerPrice = plan.offerPrice == null ? null : Number(plan.offerPrice);

  const withinWindow =
    (plan.offerStartDate == null || now >= plan.offerStartDate) &&
    (plan.offerEndDate == null || now <= plan.offerEndDate);
  const offerActive = offerPrice !== null && withinWindow;

  const effective = offerActive ? (offerPrice as number) : base;
  const discountPercent =
    offerActive && base > 0 ? Math.round((1 - effective / base) * 100) : 0;

  return {
    tier,
    billingMonths: BILLING_MONTHS[tier],
    currency: plan.currency,
    basePerPeriod: base,
    effectivePerPeriod: effective,
    offerActive,
    discountPercent,
    offerEndsAt: offerActive && plan.offerEndDate ? plan.offerEndDate.toISOString() : null,
  };
}

/**
 * Data for the dashboard upgrade prompt, or null when it must not show:
 * missing user id, user not found, or the user is not on the FREE tier.
 */
export async function getUpgradePromptData(
  userId: string | undefined,
): Promise<UpgradePromptData | null> {
  if (!userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { subscriptionPlan: true },
  });
  if (!user || user.subscriptionPlan.tier !== "FREE") return null;

  const now = new Date();
  const [rows, paidCount] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      where: { isActive: true, tier: { not: "FREE" } },
      orderBy: { tier: "asc" }, // enum order: MONTHLY, QUARTERLY, ANNUAL
    }),
    prisma.user.count({ where: { subscriptionPlan: { tier: { not: "FREE" } } } }),
  ]);

  const plans = rows.map((row) => buildPlanCardView(row, now));
  const memberCount = paidCount > 100 ? Math.floor(paidCount / 100) * 100 : null;

  return { plans, memberCount };
}
```

- [ ] **Step 4: Run it — expect pass**

Run: `cd tests && npx jest --config jest.config.js api/upgrade-prompt/plan-card-view --runInBand`
Expected: PASS (6 tests).

- [ ] **Step 5: Type-check the frontend (against the 89-error baseline — see Conventions)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89`.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "UpgradePromptService"` → must be empty.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/services/UpgradePromptService.ts tests/api/upgrade-prompt/plan-card-view.test.ts
git commit -m "$(printf 'Add UpgradePromptService: buildPlanCardView + view-model types\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 4: Test helpers — `getPlanId(tier)` and `createTestUser({ tier })`

**Files:**
- Modify: `tests/helpers/seedReferenceData.ts`
- Modify: `tests/helpers/testUser.ts`

`createTestUser` currently always uses the FREE plan; the service tests (Task 5) and e2e (Task 12) need paid users too. `ensureReferenceData` also needs the new pricing/offer fields so integration + e2e see the same numbers as the seed, and it must actually **update** existing rows (the test DB already holds the old 199/499/1999 rows).

- [ ] **Step 1: Update `seedReferenceData.ts`**

Replace the whole file contents of `tests/helpers/seedReferenceData.ts` with:

```ts
import { getTestPrisma } from "./testDb";

export const TIERS = ["FREE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export const PLATFORMS = ["GOOGLE", "APPLE", "X", "LINKEDIN"] as const;

export type Tier = (typeof TIERS)[number];

// Keep in lockstep with frontend/prisma/seed.ts — placeholder pricing + launch offer.
const OFFER_START = new Date("2026-08-01T00:00:00Z");
const OFFER_END = new Date("2026-09-30T23:59:59Z");

const PLAN_PRICING: Record<
  Tier,
  { price: number; offerPrice: number | null; offerStartDate: Date | null; offerEndDate: Date | null }
> = {
  FREE:      { price: 0,     offerPrice: null,  offerStartDate: null,        offerEndDate: null },
  MONTHLY:   { price: 3000,  offerPrice: null,  offerStartDate: null,        offerEndDate: null },
  QUARTERLY: { price: 6000,  offerPrice: 4800,  offerStartDate: OFFER_START, offerEndDate: OFFER_END },
  ANNUAL:    { price: 18000, offerPrice: 14400, offerStartDate: OFFER_START, offerEndDate: OFFER_END },
};

export async function ensureReferenceData(): Promise<void> {
  const prisma = getTestPrisma();

  for (const tier of TIERS) {
    const pricing = PLAN_PRICING[tier];
    await prisma.subscriptionPlan.upsert({
      where: { tier },
      update: { ...pricing, currency: "INR", isActive: true },
      create: { tier, ...pricing, currency: "INR", isActive: true },
    });
  }

  for (const platform of PLATFORMS) {
    await prisma.authPlatform.upsert({
      where: { platform },
      update: {},
      create: { platform },
    });
  }
}

export async function getPlanId(tier: Tier): Promise<string> {
  const prisma = getTestPrisma();
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier } });
  return plan.id;
}

export async function getFreePlanId(): Promise<string> {
  return getPlanId("FREE");
}

export async function getPlatformId(platform: (typeof PLATFORMS)[number]): Promise<string> {
  const prisma = getTestPrisma();
  const row = await prisma.authPlatform.findUniqueOrThrow({ where: { platform } });
  return row.id;
}
```

- [ ] **Step 2: Update `testUser.ts`**

Replace the whole file contents of `tests/helpers/testUser.ts` with:

```ts
import { randomUUID } from "crypto";
import { getTestPrisma } from "./testDb";
import { getPlanId, getPlatformId, PLATFORMS, type Tier } from "./seedReferenceData";

export interface CreateTestUserOptions {
  platform?: (typeof PLATFORMS)[number];
  verifier?: string | null;
  tier?: Tier;
}

export async function createTestUser(options: CreateTestUserOptions = {}) {
  const prisma = getTestPrisma();
  const platform = options.platform ?? "GOOGLE";
  const tier = options.tier ?? "FREE";
  const [planId, platformId] = await Promise.all([
    getPlanId(tier),
    getPlatformId(platform),
  ]);

  return prisma.user.create({
    data: {
      fullName: "Test User",
      username: `test-user-${randomUUID()}@example.com`,
      auth_platformId: platformId,
      subscriptionPlanId: planId,
      verifier: options.verifier ?? null,
    },
  });
}

export async function deleteTestUser(userId: string): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.subscriptionPeriod.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
}
```

- [ ] **Step 3: Run the existing DB suites to confirm no regression**

Run: `cd tests && npx jest --config jest.config.js database --runInBand`
Expected: PASS — all of `tests/database/schema.test.ts` and `tests/database/subscription-period-service.test.ts` still green (they import `getFreePlanId`, which now delegates; `ensureReferenceData` now upserts the new prices, which those tests don't assert on). If `TEST_DATABASE_URL` is unset the suites skip — that is acceptable, note it and move on.

- [ ] **Step 4: Commit**

```bash
git add tests/helpers/seedReferenceData.ts tests/helpers/testUser.ts
git commit -m "$(printf 'test helpers: getPlanId(tier), createTestUser({tier}), seed launch-offer pricing\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 5: `getUpgradePromptData` integration tests

**Files:**
- Test: `tests/api/upgrade-prompt/service.test.ts` (create)

Follows the pattern of `tests/database/subscription-period-service.test.ts`: skip when `TEST_DATABASE_URL` is unset, refuse to run if `DATABASE_URL` and `TEST_DATABASE_URL` diverge (the service uses the app's `@/lib/prisma` singleton), and `require()` the service lazily so that check runs first.

- [ ] **Step 1: Write the test**

Create `tests/api/upgrade-prompt/service.test.ts`:

```ts
import { hasTestDb, getTestPrisma, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error(
        "DATABASE_URL and TEST_DATABASE_URL differ — refusing to run getUpgradePromptData " +
          "against the real @/lib/prisma singleton, since it would not necessarily hit the test database.",
      );
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("getUpgradePromptData", () => {
  // Lazy require: the DATABASE_URL/TEST_DATABASE_URL check above must run before
  // the service module (and its own @/lib/prisma singleton) is loaded.
  const { getUpgradePromptData } = require("@/lib/services/UpgradePromptService");

  test("returns null when userId is undefined", async () => {
    expect(await getUpgradePromptData(undefined)).toBeNull();
  });

  test("returns null when the user does not exist", async () => {
    expect(await getUpgradePromptData("00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  test("returns null for a paid user", async () => {
    const user = await createTestUser({ tier: "ANNUAL" });
    try {
      expect(await getUpgradePromptData(user.id)).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("returns the three paid plans in MONTHLY, QUARTERLY, ANNUAL order for a FREE user", async () => {
    const user = await createTestUser(); // FREE by default
    try {
      const data = await getUpgradePromptData(user.id);
      expect(data).not.toBeNull();
      expect(data.plans.map((p: { tier: string }) => p.tier)).toEqual([
        "MONTHLY",
        "QUARTERLY",
        "ANNUAL",
      ]);
      const annual = data.plans.find((p: { tier: string }) => p.tier === "ANNUAL");
      expect(annual.offerActive).toBe(true);
      expect(annual.effectivePerPeriod).toBe(14400);
      expect(annual.discountPercent).toBe(20);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("memberCount is null when there are 100 or fewer paid users", async () => {
    const user = await createTestUser();
    try {
      const data = await getUpgradePromptData(user.id);
      expect(data.memberCount).toBeNull();
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
```

> Note on the ANNUAL offer assertions: they assume "now" is on or before 2026-09-30 (the seeded `OFFER_END`). If this plan is executed after that date, change `ensureReferenceData`'s `OFFER_END` (and `frontend/prisma/seed.ts`) to a future date first, keeping both in lockstep, and update the caption/date expectations here and in Task 12 accordingly.

- [ ] **Step 2: Run it**

Run: `cd tests && npx jest --config jest.config.js api/upgrade-prompt/service --runInBand`
Expected: PASS (5 tests) when `TEST_DATABASE_URL` is set and equals `DATABASE_URL`; otherwise the `describeOrSkip` block is skipped (0 failures) — acceptable, note it.

- [ ] **Step 3: Commit**

```bash
git add tests/api/upgrade-prompt/service.test.ts
git commit -m "$(printf 'Add getUpgradePromptData integration tests\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 6: Register the `upgrade` Jest suite in both test runners

**Files:**
- Modify: `tests/run-tests.ts`
- Modify: `run-tests.sh`

- [ ] **Step 1: Update `tests/run-tests.ts`**

Change the `Suite` type and `ALL_SUITES` (lines 4-5):

```ts
type Suite = "auth" | "unlock" | "dashboard" | "upgrade" | "database" | "playwright";
const ALL_SUITES: Suite[] = ["auth", "unlock", "dashboard", "upgrade", "database", "playwright"];
```

In `runSuite`, add a case after the `"dashboard"` case:

```ts
    case "dashboard":
      return runJest("api/dashboard");
    case "upgrade":
      return runJest("api/upgrade-prompt");
```

- [ ] **Step 2: Update `run-tests.sh`**

Change the `API_SUITES` array (currently defined just before the `case` block):

```bash
API_SUITES=("Auth API Tests:auth" "Unlock API Tests:unlock" "Dashboard API Tests:dashboard" "Upgrade Prompt Tests:upgrade")
```

Nothing else in `run-tests.sh` changes — `run_group` derives the suite count from the array length, and both the `""` and `api` branches already expand `"${API_SUITES[@]}"`.

- [ ] **Step 3: Run the API group**

Run: `./run-tests.sh api`
Expected: four suites run under the "API Testing" header — `SUITE 1 of 4 — Auth API Tests` … `SUITE 4 of 4 — Upgrade Prompt Tests`. Every suite passes (Upgrade Prompt: `plan-card-view` + `format-money` always pass; `service` passes or skips depending on `TEST_DATABASE_URL`). The per-test-case list prints for each.

- [ ] **Step 4: Commit**

```bash
git add tests/run-tests.ts run-tests.sh
git commit -m "$(printf 'Register the upgrade-prompt suite in the test orchestrators\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 7: Seed placeholder pricing + launch offer

**Files:**
- Modify: `frontend/prisma/seed.ts`

- [ ] **Step 1: Replace the pricing block**

In `frontend/prisma/seed.ts`, find this block:

```ts
  // Seed subscription plan pricing — placeholder values, real pricing not finalized yet
  await prisma.subscriptionPlan.createMany({
    data: [
      { tier: 'FREE',      price: 0, offerPrice: null, currency: 'INR', isActive: true },
      { tier: 'MONTHLY',   price: 0, offerPrice: null, currency: 'INR', isActive: true },
      { tier: 'QUARTERLY', price: 0, offerPrice: null, currency: 'INR', isActive: true },
      { tier: 'ANNUAL',    price: 0, offerPrice: null, currency: 'INR', isActive: true },
    ],
  });
  console.log("✅ Subscription plans seeded (placeholder pricing)");
```

Replace it with:

```ts
  // Seed subscription plan pricing — PLACEHOLDER values, real pricing not finalized.
  // `price` / `offerPrice` are per billing period, whole INR. The launch offer
  // (20% off Treasury & Sovereign) is a placeholder too — set the real prices and
  // window before going live.
  const offerStart = new Date('2026-08-01T00:00:00Z');
  const offerEnd = new Date('2026-09-30T23:59:59Z');
  await prisma.subscriptionPlan.createMany({
    data: [
      { tier: 'FREE',      price: 0,     offerPrice: null,  currency: 'INR', isActive: true },
      { tier: 'MONTHLY',   price: 3000,  offerPrice: null,  currency: 'INR', isActive: true },                                              // Reserve   ₹3,000/mo
      { tier: 'QUARTERLY', price: 6000,  offerPrice: 4800,  currency: 'INR', isActive: true, offerStartDate: offerStart, offerEndDate: offerEnd }, // Treasury  ₹2,000 → ₹1,600/mo
      { tier: 'ANNUAL',    price: 18000, offerPrice: 14400, currency: 'INR', isActive: true, offerStartDate: offerStart, offerEndDate: offerEnd }, // Sovereign ₹1,500 → ₹1,200/mo
    ],
  });
  console.log("✅ Subscription plans seeded (placeholder pricing + launch offer)");
```

- [ ] **Step 2: Type-check the seed**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89` (`seed.ts` already has ~22 of those baseline errors from missing asset models; your change touches only `subscriptionPlan.createMany`, and `offerStartDate` / `offerEndDate` are `DateTime?` in the schema + present in the generated client, so no NEW error). Run `... | grep "seed.ts"` and eyeball: the seed errors should be the same asset-model ones as before, none about `subscriptionPlan` / `offerStartDate` / `offerEndDate`.

- [ ] **Step 3: (If a dev database + `SEED_PASSPHRASE` are available) run the seed**

Run: `cd frontend && npm run db:seed`
Expected: "✅ Subscription plans seeded (placeholder pricing + launch offer)" and a successful finish. If no dev DB / passphrase is configured, skip this step and note it — the integration + e2e tests use `ensureReferenceData` (Task 4), not this seed.

- [ ] **Step 4: Commit**

```bash
git add frontend/prisma/seed.ts
git commit -m "$(printf 'Seed placeholder subscription pricing and a launch offer\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 8: `upgrade` i18n namespace (interface + 11 locales)

**Files:**
- Modify: `frontend/src/i18n/translations.ts`

Add one `upgrade` namespace to the `Translations` interface and an `upgrade: { … }` block to every locale object. Plan/brand names (`Reserve` / `Treasury` / `Sovereign`) are **not** here — they are constants in `UpgradeModal`. Interpolation tokens `{count}`, `{percent}`, `{amount}`, `{date}` and the `🎁` emoji are preserved verbatim in every locale.

> ⚠️ The non-English strings below are provisional AI translations. Add a code comment
> `// TODO(i18n): upgrade.* strings are AI-translated — need native-speaker review` directly
> above the `upgrade` block in the interface, and after the plan lands, file a follow-up task
> for native review (matches spec §8).

- [ ] **Step 1: Add to the `Translations` interface**

In `frontend/src/i18n/translations.ts`, inside `export interface Translations { … }`, after the `language` block, add:

```ts
  // TODO(i18n): upgrade.* strings are AI-translated — need native-speaker review
  upgrade: {
    title: string;
    subtitle: string;
    social: string;
    feature1: string;
    feature2: string;
    feature3: string;
    feature4: string;
    reserveTagline: string;
    treasuryTagline: string;
    sovereignTagline: string;
    billedMonthly: string;
    billedQuarterly: string;
    billedYearly: string;
    perMonthSuffix: string;
    everyMonth: string;
    everyQuarter: string;
    everyYear: string;
    chipBestValue: string;
    chipSave: string;
    offerBanner: string;
    offerCaption: string;
    ctaReserve: string;
    ctaTreasury: string;
    ctaSovereign: string;
    maybeLater: string;
    trustEncrypted: string;
    trustCancel: string;
    trustMoneyBack: string;
  };
```

- [ ] **Step 2: Add the `upgrade` block to each locale**

For each locale object in the `translations` map, add an `upgrade: { … }` entry as a sibling of that locale's `sidebar` / `language` entries. Use the exact strings below (locale codes match the file's `Locale` union).

**`en-US`**
```ts
    upgrade: {
      title: "Your wealth, fully unlocked",
      subtitle: "See every asset class in one private view. Your numbers stay encrypted end-to-end — even we can't read them.",
      social: "Join {count}+ people tracking their net worth privately",
      feature1: "All 11 asset categories",
      feature2: "Unlimited holdings & accounts",
      feature3: "Reports & CSV / PDF export",
      feature4: "Priority support",
      reserveTagline: "Month-to-month, cancel anytime",
      treasuryTagline: "Pay quarterly, save more",
      sovereignTagline: "Our lowest monthly rate",
      billedMonthly: "Billed monthly",
      billedQuarterly: "Billed quarterly",
      billedYearly: "Billed yearly",
      perMonthSuffix: "/mo",
      everyMonth: "{amount} every month",
      everyQuarter: "{amount} billed quarterly",
      everyYear: "{amount} billed yearly",
      chipBestValue: "BEST VALUE",
      chipSave: "SAVE {percent}%",
      offerBanner: "Launch offer — {percent}% off · ends {date}",
      offerCaption: "🎁 {percent}% off · ends {date}",
      ctaReserve: "Start with Reserve",
      ctaTreasury: "Choose Treasury",
      ctaSovereign: "Go Sovereign",
      maybeLater: "Maybe later",
      trustEncrypted: "End-to-end encrypted",
      trustCancel: "Cancel anytime",
      trustMoneyBack: "7-day money-back",
    },
```

**`fr-FR`**
```ts
    upgrade: {
      title: "Votre patrimoine, entièrement débloqué",
      subtitle: "Toutes vos classes d'actifs dans une seule vue privée. Vos chiffres restent chiffrés de bout en bout — même nous ne pouvons pas les lire.",
      social: "Rejoignez plus de {count} personnes qui suivent leur patrimoine en toute confidentialité",
      feature1: "Les 11 catégories d'actifs",
      feature2: "Positions et comptes illimités",
      feature3: "Rapports et export CSV / PDF",
      feature4: "Assistance prioritaire",
      reserveTagline: "Mois par mois, résiliable à tout moment",
      treasuryTagline: "Payez au trimestre, économisez plus",
      sovereignTagline: "Notre tarif mensuel le plus bas",
      billedMonthly: "Facturé mensuellement",
      billedQuarterly: "Facturé trimestriellement",
      billedYearly: "Facturé annuellement",
      perMonthSuffix: "/mois",
      everyMonth: "{amount} chaque mois",
      everyQuarter: "{amount} facturé par trimestre",
      everyYear: "{amount} facturé par an",
      chipBestValue: "MEILLEURE OFFRE",
      chipSave: "-{percent} %",
      offerBanner: "Offre de lancement — {percent} % de réduction · se termine le {date}",
      offerCaption: "🎁 {percent} % de réduction · se termine le {date}",
      ctaReserve: "Commencer avec Reserve",
      ctaTreasury: "Choisir Treasury",
      ctaSovereign: "Passer à Sovereign",
      maybeLater: "Plus tard",
      trustEncrypted: "Chiffré de bout en bout",
      trustCancel: "Résiliable à tout moment",
      trustMoneyBack: "Remboursé sous 7 jours",
    },
```

**`de-DE`**
```ts
    upgrade: {
      title: "Ihr Vermögen, vollständig freigeschaltet",
      subtitle: "Jede Anlageklasse in einer privaten Ansicht. Ihre Zahlen bleiben Ende-zu-Ende verschlüsselt — auch wir können sie nicht lesen.",
      social: "Schließen Sie sich über {count} Menschen an, die ihr Vermögen privat verfolgen",
      feature1: "Alle 11 Anlagekategorien",
      feature2: "Unbegrenzte Positionen und Konten",
      feature3: "Berichte und CSV-/PDF-Export",
      feature4: "Priorisierter Support",
      reserveTagline: "Monatlich, jederzeit kündbar",
      treasuryTagline: "Vierteljährlich zahlen, mehr sparen",
      sovereignTagline: "Unser niedrigster Monatspreis",
      billedMonthly: "Monatliche Abrechnung",
      billedQuarterly: "Vierteljährliche Abrechnung",
      billedYearly: "Jährliche Abrechnung",
      perMonthSuffix: "/Mon.",
      everyMonth: "{amount} jeden Monat",
      everyQuarter: "{amount} vierteljährlich abgerechnet",
      everyYear: "{amount} jährlich abgerechnet",
      chipBestValue: "BESTES ANGEBOT",
      chipSave: "{percent} % SPAREN",
      offerBanner: "Einführungsangebot — {percent} % Rabatt · endet am {date}",
      offerCaption: "🎁 {percent} % Rabatt · endet am {date}",
      ctaReserve: "Mit Reserve starten",
      ctaTreasury: "Treasury wählen",
      ctaSovereign: "Zu Sovereign wechseln",
      maybeLater: "Vielleicht später",
      trustEncrypted: "Ende-zu-Ende verschlüsselt",
      trustCancel: "Jederzeit kündbar",
      trustMoneyBack: "7 Tage Geld-zurück",
    },
```

**`hi-IN`**
```ts
    upgrade: {
      title: "आपकी संपत्ति, पूरी तरह अनलॉक",
      subtitle: "हर एसेट क्लास एक निजी व्यू में। आपके आंकड़े एंड-टू-एंड एन्क्रिप्टेड रहते हैं — हम भी उन्हें नहीं पढ़ सकते।",
      social: "{count}+ लोगों से जुड़ें जो निजी तौर पर अपनी नेट वर्थ ट्रैक करते हैं",
      feature1: "सभी 11 एसेट श्रेणियाँ",
      feature2: "असीमित होल्डिंग्स और खाते",
      feature3: "रिपोर्ट और CSV / PDF एक्सपोर्ट",
      feature4: "प्राथमिकता सहायता",
      reserveTagline: "महीने-दर-महीने, कभी भी रद्द करें",
      treasuryTagline: "तिमाही भुगतान करें, ज़्यादा बचाएँ",
      sovereignTagline: "हमारी सबसे कम मासिक दर",
      billedMonthly: "मासिक बिलिंग",
      billedQuarterly: "तिमाही बिलिंग",
      billedYearly: "वार्षिक बिलिंग",
      perMonthSuffix: "/माह",
      everyMonth: "हर महीने {amount}",
      everyQuarter: "{amount} तिमाही बिल",
      everyYear: "{amount} वार्षिक बिल",
      chipBestValue: "सर्वोत्तम मूल्य",
      chipSave: "{percent}% बचत",
      offerBanner: "लॉन्च ऑफ़र — {percent}% छूट · {date} को समाप्त",
      offerCaption: "🎁 {percent}% छूट · {date} को समाप्त",
      ctaReserve: "Reserve से शुरू करें",
      ctaTreasury: "Treasury चुनें",
      ctaSovereign: "Sovereign लें",
      maybeLater: "बाद में",
      trustEncrypted: "एंड-टू-एंड एन्क्रिप्टेड",
      trustCancel: "कभी भी रद्द करें",
      trustMoneyBack: "7-दिन मनी-बैक",
    },
```

**`id-ID`**
```ts
    upgrade: {
      title: "Kekayaan Anda, terbuka sepenuhnya",
      subtitle: "Lihat setiap kelas aset dalam satu tampilan pribadi. Angka Anda tetap terenkripsi end-to-end — kami pun tidak bisa membacanya.",
      social: "Bergabunglah dengan {count}+ orang yang melacak kekayaan bersih mereka secara pribadi",
      feature1: "Semua 11 kategori aset",
      feature2: "Kepemilikan & akun tanpa batas",
      feature3: "Laporan & ekspor CSV / PDF",
      feature4: "Dukungan prioritas",
      reserveTagline: "Bulanan, batalkan kapan saja",
      treasuryTagline: "Bayar per kuartal, hemat lebih banyak",
      sovereignTagline: "Tarif bulanan terendah kami",
      billedMonthly: "Ditagih bulanan",
      billedQuarterly: "Ditagih per kuartal",
      billedYearly: "Ditagih tahunan",
      perMonthSuffix: "/bln",
      everyMonth: "{amount} setiap bulan",
      everyQuarter: "{amount} ditagih per kuartal",
      everyYear: "{amount} ditagih per tahun",
      chipBestValue: "NILAI TERBAIK",
      chipSave: "HEMAT {percent}%",
      offerBanner: "Penawaran perkenalan — diskon {percent}% · berakhir {date}",
      offerCaption: "🎁 diskon {percent}% · berakhir {date}",
      ctaReserve: "Mulai dengan Reserve",
      ctaTreasury: "Pilih Treasury",
      ctaSovereign: "Pilih Sovereign",
      maybeLater: "Nanti saja",
      trustEncrypted: "Terenkripsi end-to-end",
      trustCancel: "Batalkan kapan saja",
      trustMoneyBack: "Jaminan uang kembali 7 hari",
    },
```

**`it-IT`**
```ts
    upgrade: {
      title: "Il tuo patrimonio, completamente sbloccato",
      subtitle: "Ogni classe di attività in un'unica vista privata. I tuoi numeri restano crittografati end-to-end — nemmeno noi possiamo leggerli.",
      social: "Unisciti a oltre {count} persone che monitorano il proprio patrimonio in privato",
      feature1: "Tutte le 11 categorie di attività",
      feature2: "Posizioni e conti illimitati",
      feature3: "Report ed esportazione CSV / PDF",
      feature4: "Assistenza prioritaria",
      reserveTagline: "Mese per mese, disdici quando vuoi",
      treasuryTagline: "Paga ogni trimestre, risparmia di più",
      sovereignTagline: "La nostra tariffa mensile più bassa",
      billedMonthly: "Fatturazione mensile",
      billedQuarterly: "Fatturazione trimestrale",
      billedYearly: "Fatturazione annuale",
      perMonthSuffix: "/mese",
      everyMonth: "{amount} ogni mese",
      everyQuarter: "{amount} fatturato ogni trimestre",
      everyYear: "{amount} fatturato ogni anno",
      chipBestValue: "MIGLIORE OFFERTA",
      chipSave: "RISPARMIA {percent}%",
      offerBanner: "Offerta di lancio — {percent}% di sconto · termina il {date}",
      offerCaption: "🎁 {percent}% di sconto · termina il {date}",
      ctaReserve: "Inizia con Reserve",
      ctaTreasury: "Scegli Treasury",
      ctaSovereign: "Passa a Sovereign",
      maybeLater: "Più tardi",
      trustEncrypted: "Crittografato end-to-end",
      trustCancel: "Disdici quando vuoi",
      trustMoneyBack: "Rimborso entro 7 giorni",
    },
```

**`ja-JP`**
```ts
    upgrade: {
      title: "あなたの資産を、すべて解放",
      subtitle: "すべての資産クラスを一つのプライベートなビューで。数字はエンドツーエンドで暗号化され、私たちにも読めません。",
      social: "{count}人以上が、非公開で純資産を管理しています",
      feature1: "11すべての資産カテゴリー",
      feature2: "保有・口座数は無制限",
      feature3: "レポートとCSV / PDFエクスポート",
      feature4: "優先サポート",
      reserveTagline: "月単位、いつでも解約可能",
      treasuryTagline: "四半期払いでもっとお得に",
      sovereignTagline: "当社で最も安い月額",
      billedMonthly: "毎月請求",
      billedQuarterly: "四半期ごとに請求",
      billedYearly: "年ごとに請求",
      perMonthSuffix: "/月",
      everyMonth: "毎月 {amount}",
      everyQuarter: "{amount} を四半期ごとに請求",
      everyYear: "{amount} を年ごとに請求",
      chipBestValue: "ベストバリュー",
      chipSave: "{percent}%お得",
      offerBanner: "ローンチ記念 — {percent}%オフ · {date}まで",
      offerCaption: "🎁 {percent}%オフ · {date}まで",
      ctaReserve: "Reserve で始める",
      ctaTreasury: "Treasury を選ぶ",
      ctaSovereign: "Sovereign にする",
      maybeLater: "後で",
      trustEncrypted: "エンドツーエンド暗号化",
      trustCancel: "いつでも解約可能",
      trustMoneyBack: "7日間返金保証",
    },
```

**`ko-KR`**
```ts
    upgrade: {
      title: "당신의 자산, 완전히 열어보세요",
      subtitle: "모든 자산 클래스를 하나의 비공개 화면에서. 수치는 종단 간 암호화되어 저희도 읽을 수 없습니다.",
      social: "{count}명 이상이 자신의 순자산을 비공개로 관리하고 있습니다",
      feature1: "11개 자산 카테고리 전체",
      feature2: "보유 종목·계좌 무제한",
      feature3: "리포트 및 CSV / PDF 내보내기",
      feature4: "우선 지원",
      reserveTagline: "월 단위, 언제든 해지 가능",
      treasuryTagline: "분기 결제로 더 절약하세요",
      sovereignTagline: "가장 낮은 월 요금",
      billedMonthly: "월별 청구",
      billedQuarterly: "분기별 청구",
      billedYearly: "연별 청구",
      perMonthSuffix: "/월",
      everyMonth: "매월 {amount}",
      everyQuarter: "{amount} 분기별 청구",
      everyYear: "{amount} 연별 청구",
      chipBestValue: "최고의 가치",
      chipSave: "{percent}% 절약",
      offerBanner: "출시 기념 — {percent}% 할인 · {date} 종료",
      offerCaption: "🎁 {percent}% 할인 · {date} 종료",
      ctaReserve: "Reserve로 시작하기",
      ctaTreasury: "Treasury 선택",
      ctaSovereign: "Sovereign 선택",
      maybeLater: "나중에",
      trustEncrypted: "종단 간 암호화",
      trustCancel: "언제든 해지 가능",
      trustMoneyBack: "7일 환불 보장",
    },
```

**`pt-BR`**
```ts
    upgrade: {
      title: "Seu patrimônio, totalmente desbloqueado",
      subtitle: "Todas as classes de ativos em uma visão privada. Seus números ficam criptografados de ponta a ponta — nem nós conseguimos lê-los.",
      social: "Junte-se a mais de {count} pessoas que acompanham o patrimônio de forma privada",
      feature1: "Todas as 11 categorias de ativos",
      feature2: "Posições e contas ilimitadas",
      feature3: "Relatórios e exportação CSV / PDF",
      feature4: "Suporte prioritário",
      reserveTagline: "Mês a mês, cancele quando quiser",
      treasuryTagline: "Pague por trimestre e economize mais",
      sovereignTagline: "Nossa menor mensalidade",
      billedMonthly: "Cobrança mensal",
      billedQuarterly: "Cobrança trimestral",
      billedYearly: "Cobrança anual",
      perMonthSuffix: "/mês",
      everyMonth: "{amount} todo mês",
      everyQuarter: "{amount} cobrado por trimestre",
      everyYear: "{amount} cobrado por ano",
      chipBestValue: "MELHOR VALOR",
      chipSave: "ECONOMIZE {percent}%",
      offerBanner: "Oferta de lançamento — {percent}% de desconto · termina em {date}",
      offerCaption: "🎁 {percent}% de desconto · termina em {date}",
      ctaReserve: "Começar com o Reserve",
      ctaTreasury: "Escolher o Treasury",
      ctaSovereign: "Ir de Sovereign",
      maybeLater: "Talvez depois",
      trustEncrypted: "Criptografado de ponta a ponta",
      trustCancel: "Cancele quando quiser",
      trustMoneyBack: "Reembolso em 7 dias",
    },
```

**`es-419`**
```ts
    upgrade: {
      title: "Tu patrimonio, totalmente desbloqueado",
      subtitle: "Todas las clases de activos en una vista privada. Tus cifras siguen cifradas de extremo a extremo: ni nosotros podemos leerlas.",
      social: "Únete a más de {count} personas que controlan su patrimonio en privado",
      feature1: "Las 11 categorías de activos",
      feature2: "Posiciones y cuentas ilimitadas",
      feature3: "Informes y exportación CSV / PDF",
      feature4: "Soporte prioritario",
      reserveTagline: "Mes a mes, cancela cuando quieras",
      treasuryTagline: "Paga por trimestre y ahorra más",
      sovereignTagline: "Nuestra tarifa mensual más baja",
      billedMonthly: "Facturación mensual",
      billedQuarterly: "Facturación trimestral",
      billedYearly: "Facturación anual",
      perMonthSuffix: "/mes",
      everyMonth: "{amount} cada mes",
      everyQuarter: "{amount} facturado por trimestre",
      everyYear: "{amount} facturado por año",
      chipBestValue: "MEJOR VALOR",
      chipSave: "AHORRA {percent}%",
      offerBanner: "Oferta de lanzamiento: {percent}% de descuento · termina el {date}",
      offerCaption: "🎁 {percent}% de descuento · termina el {date}",
      ctaReserve: "Empezar con Reserve",
      ctaTreasury: "Elegir Treasury",
      ctaSovereign: "Pasar a Sovereign",
      maybeLater: "Quizás más tarde",
      trustEncrypted: "Cifrado de extremo a extremo",
      trustCancel: "Cancela cuando quieras",
      trustMoneyBack: "Reembolso en 7 días",
    },
```

**`es-ES`**
```ts
    upgrade: {
      title: "Tu patrimonio, totalmente desbloqueado",
      subtitle: "Todas las clases de activos en una vista privada. Tus cifras siguen cifradas de extremo a extremo: ni nosotros podemos leerlas.",
      social: "Únete a más de {count} personas que controlan su patrimonio en privado",
      feature1: "Las 11 categorías de activos",
      feature2: "Posiciones y cuentas ilimitadas",
      feature3: "Informes y exportación CSV / PDF",
      feature4: "Soporte prioritario",
      reserveTagline: "Mes a mes, cancela cuando quieras",
      treasuryTagline: "Paga por trimestre y ahorra más",
      sovereignTagline: "Nuestra tarifa mensual más baja",
      billedMonthly: "Facturación mensual",
      billedQuarterly: "Facturación trimestral",
      billedYearly: "Facturación anual",
      perMonthSuffix: "/mes",
      everyMonth: "{amount} cada mes",
      everyQuarter: "{amount} facturado por trimestre",
      everyYear: "{amount} facturado al año",
      chipBestValue: "MEJOR VALOR",
      chipSave: "AHORRA {percent}%",
      offerBanner: "Oferta de lanzamiento: {percent}% de descuento · termina el {date}",
      offerCaption: "🎁 {percent}% de descuento · termina el {date}",
      ctaReserve: "Empezar con Reserve",
      ctaTreasury: "Elegir Treasury",
      ctaSovereign: "Pasar a Sovereign",
      maybeLater: "Quizás más tarde",
      trustEncrypted: "Cifrado de extremo a extremo",
      trustCancel: "Cancela cuando quieras",
      trustMoneyBack: "Reembolso en 7 días",
    },
```

- [ ] **Step 3: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89`.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "translations.ts"` → must be empty. If a locale object is missing the `upgrade` key, tsc reports it here (`translations.ts(NNN): ... is missing the following properties ... upgrade`) — add the block to that locale. This is the check that all 11 are present and complete.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/translations.ts
git commit -m "$(printf 'Add upgrade i18n namespace across all 11 locales\n\nNon-English strings are provisional AI translations; flagged for native review.\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 9: `UpgradeModal` component

**Files:**
- Create: `frontend/src/components/dashboard/UpgradeModal.tsx`

The visual component. No Jest unit test — the test infra is node-env with no React renderer; it is verified by `tsc`, the Playwright e2e (Task 12), and a manual browser check (Task 13). Mirrors mockup v10: portalled backdrop + panel, framer-motion transitions, segmented control on `sm+` only, three selectable cards, border beam on the selected card (skipped under reduced motion), offer-aware pricing, features, trust row, "Maybe later".

- [ ] **Step 1: Create the file**

Create `frontend/src/components/dashboard/UpgradeModal.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useLocale } from "@/context/LocaleContext";
import { BorderBeam } from "@/components/ui/border-beam";
import { formatMoney } from "@/lib/utils";
import type { PaidTier, PlanCardView } from "@/lib/services/UpgradePromptService";

interface UpgradeModalProps {
  open: boolean;
  plans: PlanCardView[];
  memberCount: number | null;
  onClose: () => void;
}

const PLAN_NAME: Record<PaidTier, string> = {
  MONTHLY: "Reserve",
  QUARTERLY: "Treasury",
  ANNUAL: "Sovereign",
};
const PLAN_GEM: Record<PaidTier, string> = { MONTHLY: "🪙", QUARTERLY: "💎", ANNUAL: "👑" };

function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

export function UpgradeModal({ open, plans, memberCount, onClose }: UpgradeModalProps) {
  const { t, locale } = useLocale();
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  // Default selection: ANNUAL if present, else the plan with the most billing months.
  const defaultTier =
    plans.find((p) => p.tier === "ANNUAL")?.tier ??
    [...plans].sort((a, b) => b.billingMonths - a.billingMonths)[0]?.tier ??
    "ANNUAL";
  const [selected, setSelected] = useState<PaidTier>(defaultTier);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const anyOffer = plans.some((p) => p.offerActive);
  const bannerPlan = plans.filter((p) => p.offerActive).sort((a, b) => b.discountPercent - a.discountPercent)[0];
  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso));

  const perMonth = (p: PlanCardView, amount: number) =>
    formatMoney(Math.round(amount / p.billingMonths), p.currency, locale);
  const billedLabel = (p: PlanCardView) => {
    const amount = formatMoney(p.effectivePerPeriod, p.currency, locale);
    const key = p.billingMonths === 1 ? "everyMonth" : p.billingMonths === 3 ? "everyQuarter" : "everyYear";
    return interpolate(t.upgrade[key], { amount });
  };
  const billedCadence = (p: PlanCardView) =>
    p.billingMonths === 1 ? t.upgrade.billedMonthly : p.billingMonths === 3 ? t.upgrade.billedQuarterly : t.upgrade.billedYearly;
  const tagline = (p: PlanCardView) =>
    p.tier === "MONTHLY" ? t.upgrade.reserveTagline : p.tier === "QUARTERLY" ? t.upgrade.treasuryTagline : t.upgrade.sovereignTagline;
  const cta = (p: PlanCardView) =>
    p.tier === "MONTHLY" ? t.upgrade.ctaReserve : p.tier === "QUARTERLY" ? t.upgrade.ctaTreasury : t.upgrade.ctaSovereign;

  const accentStyle: React.CSSProperties = {
    background: "linear-gradient(135deg, var(--ui-accent), var(--ui-accent-warm))",
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="upgrade-backdrop"
            className="fixed inset-0 z-40 backdrop-blur-[3px]"
            style={{ background: "rgba(20,10,40,0.45)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35 }}
            onClick={onClose}
          />
          <motion.div
            key="upgrade-panel"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none sm:p-6"
            initial={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: reduceMotion ? 1 : 0.94 }}
            transition={{ duration: reduceMotion ? 0 : 0.42, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="upgrade-modal-title"
              className="pointer-events-auto relative flex w-full max-w-[730px] flex-col overflow-hidden rounded-3xl"
              style={{
                maxHeight: "calc(100dvh - 3rem)",
                background: "var(--ui-modal-bg)",
                boxShadow: "var(--ui-modal-shadow)",
              }}
            >
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg text-[color:var(--ui-text-muted)] hover:text-[color:var(--ui-text-sec)]"
                style={{ background: "var(--ui-subtle-bg)" }}
              >
                <X className="h-4 w-4" />
              </button>

              <div className="min-h-0 flex-1 overflow-y-auto">
                {/* Hero */}
                <div
                  className="px-6 pb-5 pt-7 sm:px-8"
                  style={{
                    background:
                      "radial-gradient(120% 140% at 12% 0%, var(--ui-accent-bg), transparent 55%)",
                  }}
                >
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-[22px]"
                    style={{ ...accentStyle, color: "#fff", boxShadow: "0 8px 24px -6px var(--ui-accent)" }}
                  >
                    🏛️
                  </div>
                  <h2
                    id="upgrade-modal-title"
                    className="mt-4 text-[1.35rem] font-bold tracking-tight text-[color:var(--ui-text-pri)]"
                  >
                    {t.upgrade.title}
                  </h2>
                  <p className="mt-1.5 max-w-[46ch] text-[0.8rem] text-[color:var(--ui-text-sec)]">
                    {t.upgrade.subtitle}
                  </p>
                  {memberCount !== null && (
                    <div
                      className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[0.72rem] text-[color:var(--ui-text-sec)]"
                      style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-modal-bg)" }}
                    >
                      {interpolate(t.upgrade.social, {
                        count: new Intl.NumberFormat(locale).format(memberCount),
                      })}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="px-6 pb-4 pt-6 sm:px-8">
                  {anyOffer && bannerPlan?.offerEndsAt && (
                    <div
                      className="mb-5 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.72rem] font-bold"
                      style={{
                        color: "var(--ui-accent-warm)",
                        borderColor: "var(--ui-accent-warm)",
                        background: "var(--ui-accent-bg)",
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 animate-pulse rounded-full"
                        style={{ background: "var(--ui-accent-warm)" }}
                      />
                      {interpolate(t.upgrade.offerBanner, {
                        percent: bannerPlan.discountPercent,
                        date: fmtDate(bannerPlan.offerEndsAt),
                      })}
                    </div>
                  )}

                  {/* Segmented control — sm and up only */}
                  <div
                    className="mb-5 hidden gap-1 rounded-xl border p-1 sm:flex"
                    style={{ borderColor: "var(--ui-card-border)", background: "var(--ui-subtle-bg)" }}
                    role="tablist"
                    aria-label="Choose a plan"
                  >
                    {plans.map((p) => (
                      <button
                        key={p.tier}
                        role="tab"
                        aria-selected={selected === p.tier}
                        onClick={() => setSelected(p.tier)}
                        className="flex-1 rounded-lg px-2 py-2 text-[0.78rem] font-bold"
                        style={
                          selected === p.tier
                            ? { background: "var(--ui-modal-bg)", color: "var(--ui-text-pri)", boxShadow: "0 1px 4px rgba(15,23,42,0.12)" }
                            : { color: "var(--ui-text-sec)" }
                        }
                      >
                        {PLAN_NAME[p.tier]}
                        <span
                          className="mt-0.5 block text-[0.62rem]"
                          style={{ color: "var(--ui-accent-warm)" }}
                        >
                          {p.tier === "ANNUAL"
                            ? t.upgrade.chipBestValue
                            : p.offerActive
                              ? interpolate(t.upgrade.chipSave, { percent: p.discountPercent })
                              : " "}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Plan cards */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    {plans.map((p) => {
                      const isSelected = selected === p.tier;
                      return (
                        <div
                          key={p.tier}
                          onClick={() => setSelected(p.tier)}
                          className="relative cursor-pointer rounded-2xl border p-4 sm:p-[18px]"
                          style={{
                            borderColor: isSelected ? "var(--ui-accent-border)" : "var(--ui-card-border)",
                            background: isSelected
                              ? "linear-gradient(180deg, var(--ui-accent-bg), transparent 55%), var(--ui-modal-bg)"
                              : "var(--ui-modal-bg)",
                            boxShadow: isSelected ? "0 22px 55px -22px var(--ui-accent)" : undefined,
                          }}
                        >
                          {isSelected && !reduceMotion && (
                            <BorderBeam
                              colorFrom="var(--ui-accent)"
                              colorTo="var(--ui-accent-warm)"
                              borderWidth={2}
                              duration={6}
                            />
                          )}

                          {/* top row: gem + chip (left), check (right) */}
                          <div className="mb-3 flex min-h-[22px] items-center gap-2">
                            <span className="text-[17px] leading-none">{PLAN_GEM[p.tier]}</span>
                            {p.tier === "ANNUAL" ? (
                              <span
                                className="rounded-full px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                                style={{ ...accentStyle, color: "#fff" }}
                              >
                                {t.upgrade.chipBestValue}
                              </span>
                            ) : p.offerActive ? (
                              <span
                                className="rounded-full border px-2 py-[3px] text-[0.55rem] font-extrabold tracking-wider"
                                style={{
                                  color: "var(--ui-accent-warm)",
                                  borderColor: "var(--ui-accent-warm)",
                                  background: "var(--ui-accent-bg)",
                                }}
                              >
                                {interpolate(t.upgrade.chipSave, { percent: p.discountPercent })}
                              </span>
                            ) : null}
                            {isSelected && (
                              <span
                                className="ml-auto flex h-[21px] w-[21px] items-center justify-center rounded-full text-[12px] text-white"
                                style={{ background: "var(--ui-accent)" }}
                                aria-hidden
                              >
                                ✓
                              </span>
                            )}
                          </div>

                          {/* mid: identity + price (row on mobile) */}
                          <div className="mb-1 flex items-start justify-between gap-4 sm:block">
                            <div className="min-w-0 flex-1">
                              <div className="text-[0.95rem] font-extrabold text-[color:var(--ui-text-pri)]">
                                {PLAN_NAME[p.tier]}
                              </div>
                              <div className="mt-0.5 text-[0.72rem] text-[color:var(--ui-text-muted)]">
                                {billedCadence(p)}
                              </div>
                              <div className="mt-1.5 min-h-0 text-[0.72rem] leading-normal text-[color:var(--ui-text-sec)] sm:mt-3 sm:min-h-[34px]">
                                {tagline(p)}
                              </div>
                            </div>
                            <div className="shrink-0 text-right sm:text-left">
                              <div className="min-h-[14px] text-[0.7rem] text-[color:var(--ui-text-muted)] line-through sm:mt-3.5">
                                {p.offerActive
                                  ? `${perMonth(p, p.basePerPeriod)}${t.upgrade.perMonthSuffix}`
                                  : " "}
                              </div>
                              <div className="mt-0.5 whitespace-nowrap text-[1.6rem] font-black leading-none tracking-tight text-[color:var(--ui-text-pri)] sm:text-[1.7rem]">
                                {perMonth(p, p.effectivePerPeriod)}
                                <span className="text-[0.7rem] font-semibold text-[color:var(--ui-text-muted)]">
                                  {" "}
                                  {t.upgrade.perMonthSuffix}
                                </span>
                              </div>
                              <div className="mt-1 text-[0.66rem] text-[color:var(--ui-text-muted)]">
                                {billedLabel(p)}
                              </div>
                            </div>
                          </div>

                          {p.offerActive && p.offerEndsAt && (
                            <div className="mt-3 text-[0.62rem] font-extrabold" style={{ color: "var(--ui-accent-warm)" }}>
                              {interpolate(t.upgrade.offerCaption, {
                                percent: p.discountPercent,
                                date: fmtDate(p.offerEndsAt),
                              })}
                            </div>
                          )}

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Presentational — future analytics hook.
                              console.info("[upgrade-prompt] plan CTA:", p.tier);
                              onClose();
                            }}
                            className="mt-4 w-full rounded-[10px] border-[1.5px] py-[9px] text-[0.78rem] font-extrabold"
                            style={
                              isSelected
                                ? { ...accentStyle, color: "#fff", borderColor: "transparent" }
                                : { color: "var(--ui-accent)", borderColor: "var(--ui-accent-border)", background: "transparent" }
                            }
                          >
                            {cta(p)}
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Features */}
                  <div className="mt-7 grid gap-3 sm:grid-cols-2">
                    {[t.upgrade.feature1, t.upgrade.feature2, t.upgrade.feature3, t.upgrade.feature4].map((f) => (
                      <div key={f} className="text-[0.78rem] text-[color:var(--ui-text-pri)]">
                        <span className="mr-2 font-extrabold" style={{ color: "var(--ui-accent-warm)" }}>
                          ✓
                        </span>
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Trust + Maybe later */}
                <div className="flex flex-wrap items-center justify-center gap-4 px-6 pb-1 pt-4 text-[0.72rem] text-[color:var(--ui-text-muted)] sm:px-8">
                  <span>🔒 {t.upgrade.trustEncrypted}</span>
                  <span>↩︎ {t.upgrade.trustCancel}</span>
                  <span>✦ {t.upgrade.trustMoneyBack}</span>
                </div>
                <button
                  onClick={onClose}
                  className="mx-auto mb-6 mt-2 block text-[0.78rem] text-[color:var(--ui-text-muted)] underline"
                >
                  {t.upgrade.maybeLater}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89`.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "UpgradeModal"` → must be empty. If `t.upgrade[key]` indexing errors, the union `"everyMonth" | "everyQuarter" | "everyYear"` isn't narrowing — annotate the local: `const key = (...) as "everyMonth" | "everyQuarter" | "everyYear";`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/UpgradeModal.tsx
git commit -m "$(printf 'Add UpgradeModal component\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 10: `UpgradePrompt` controller

**Files:**
- Create: `frontend/src/components/dashboard/UpgradePrompt.tsx`

- [ ] **Step 1: Create the file**

Create `frontend/src/components/dashboard/UpgradePrompt.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { UpgradeModal } from "./UpgradeModal";
import type { UpgradePromptData } from "@/lib/services/UpgradePromptService";

const DISMISS_KEY = "wv:upgrade-prompt:dismissed";
const DELAY_MS = Number(process.env.NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS) || 6000;

/**
 * Owns the "when does the upgrade modal appear" logic and nothing visual.
 * Rendered by the dashboard server page only for FREE-tier users.
 * Opens the modal DELAY_MS after mount, unless already dismissed this session.
 * Any dismissal suppresses it for the rest of the browser session.
 */
export function UpgradePrompt({ plans, memberCount }: UpgradePromptData) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {
      // sessionStorage unavailable (privacy mode) — just proceed to show it.
    }
    const id = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(id);
  }, []);

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setOpen(false);
  };

  return <UpgradeModal open={open} plans={plans} memberCount={memberCount} onClose={close} />;
}
```

- [ ] **Step 2: Type-check (against the 89-error baseline — see Conventions)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89`.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep "UpgradePrompt"` → must be empty.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/dashboard/UpgradePrompt.tsx
git commit -m "$(printf 'Add UpgradePrompt controller (6s timer + session suppression)\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 11: Wire the prompt into the dashboard page

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Replace the file**

Replace the whole contents of `frontend/src/app/dashboard/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { getSession } from '@/lib/session'
import { getUpgradePromptData } from '@/lib/services/UpgradePromptService'
import { UpgradePrompt } from '@/components/dashboard/UpgradePrompt'

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.encryptionKey) redirect('/unlock')

  const prompt = await getUpgradePromptData(session.userId)

  return (
    <AppShell title="Dashboard">
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </AppShell>
  )
}
```

- [ ] **Step 2: Type-check (against the 89-error baseline — see Conventions)**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → must still be `89`.
Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E "dashboard/page|UpgradePrompt|UpgradeModal|UpgradePromptService|border-beam"` → must be empty.
(`plans` / `memberCount` are plain serialisable data, so there is no "Cannot pass a function to a Client Component" RSC boundary issue. `next build` is NOT run — it cannot pass on this codebase; the e2e in Task 12 exercises the real render path via `next dev`.)

- [ ] **Step 3: Regression — existing dashboard API tests still pass**

Run: `cd tests && npx jest --config jest.config.js api/dashboard --runInBand`
Expected: PASS (3 tests). The "200 when both userId and encryptionKey present" case uses a non-existent userId — `getUpgradePromptData` returns `null` (user lookup fails) and the page still returns `200`.

> This suite needs the dev server (`ensureDevServer`). If `TEST_DATABASE_URL`/env isn't set up for that, note the skip; Task 13 runs the full suite.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "$(printf 'Show the upgrade prompt on the dashboard for FREE-tier users\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 12: Playwright e2e + config

**Files:**
- Modify: `tests/playwright.config.ts`
- Create: `tests/e2e/upgrade-prompt.spec.ts`

- [ ] **Step 1: Add the delay env var to the Playwright web server**

In `tests/playwright.config.ts`, change the `webServer.env` line:

```ts
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS: "300",
    },
```

- [ ] **Step 2: Write the e2e spec**

Create `tests/e2e/upgrade-prompt.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { hasTestDb, disconnectTestPrisma } from "../helpers/testDb";
import { ensureReferenceData } from "../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../helpers/testUser";
import { sealSessionCookie, SESSION_COOKIE_NAME } from "../helpers/session";

test.skip(!hasTestDb(), "TEST_DATABASE_URL is not set in frontend/.env");

test.afterAll(async () => {
  await disconnectTestPrisma();
});

test.describe("Dashboard upgrade prompt", () => {
  test.beforeAll(async () => {
    await ensureReferenceData();
  });

  async function signIn(page: import("@playwright/test").Page, userId: string) {
    const sealed = await sealSessionCookie({ userId, encryptionKey: "fake-key-for-ui-check" });
    await page.context().addCookies([
      { name: SESSION_COOKIE_NAME, value: sealed, url: "http://localhost:3100" },
    ]);
  }

  test("a FREE user sees the modal ~6s (short in tests) after the dashboard loads", async ({ page }) => {
    const user = await createTestUser(); // FREE
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");

      const dialog = page.getByRole("dialog", { name: /your wealth, fully unlocked/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });

      await expect(page.getByRole("heading", { name: /your wealth, fully unlocked/i })).toBeVisible();
      // Sovereign offer price (₹1,200/mo) and offer caption present.
      await expect(page.getByText("₹1,200", { exact: false })).toBeVisible();
      await expect(page.getByText(/20% off/i).first()).toBeVisible();
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("dismissing it suppresses it for the rest of the session (survives reload)", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");

      const dialog = page.getByRole("dialog", { name: /your wealth, fully unlocked/i });
      await expect(dialog).toBeVisible({ timeout: 5000 });
      await page.getByRole("button", { name: /maybe later/i }).click();
      await expect(dialog).toBeHidden();

      await page.reload();
      // Wait longer than the test delay, then assert it did not reappear.
      await page.waitForTimeout(1200);
      await expect(dialog).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("a paid user never sees the modal", async ({ page }) => {
    const user = await createTestUser({ tier: "ANNUAL" });
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");
      await page.waitForTimeout(1200); // > test delay
      await expect(page.getByRole("dialog", { name: /your wealth, fully unlocked/i })).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("selecting Reserve moves the selection state off Sovereign", async ({ page }) => {
    const user = await createTestUser();
    try {
      await signIn(page, user.id);
      await page.goto("/dashboard");
      await expect(page.getByRole("dialog", { name: /your wealth, fully unlocked/i })).toBeVisible({ timeout: 5000 });

      const reserveTab = page.getByRole("tab", { name: /reserve/i });
      await reserveTab.click();
      await expect(reserveTab).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tab", { name: /sovereign/i })).toHaveAttribute("aria-selected", "false");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
```

> The `tab` role assertions target the segmented control, which is `hidden sm:flex`. Playwright's default viewport is 1280×720, so it is visible. If run at a mobile viewport, guard those assertions with a viewport check.

- [ ] **Step 3: Run the e2e suite**

Run: `cd tests && npx playwright test --config playwright.config.ts upgrade-prompt`
Expected: 4 tests pass. (Playwright starts `next dev` on port 3100 with the short delay env. First run may need `npx playwright install chromium`.) If `TEST_DATABASE_URL` is unset the file is skipped — acceptable, note it.

- [ ] **Step 4: Commit**

```bash
git add tests/playwright.config.ts tests/e2e/upgrade-prompt.spec.ts
git commit -m "$(printf 'Add Playwright e2e for the dashboard upgrade prompt\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 13: Full-suite run, manual check, wrap-up

**Files:**
- (no code) — verification + memory update

- [ ] **Step 1: Full test suite**

Run: `./run-tests.sh`
Expected: all groups green — **API Testing** (Auth / Unlock / Dashboard / Upgrade Prompt), **Database Testing**, **Playwright End-to-End Testing**. The per-test-case listing prints for every suite. Note any suites that skip because `TEST_DATABASE_URL` is unset in this environment.

- [ ] **Step 2: Manual browser check**

Run: `cd frontend && npm run dev`, then:
1. Sign in (or seed a FREE user + set the session cookie) and open `/dashboard`.
2. After ~6 s the modal appears, centered, over a blurred dashboard.
3. Verify: Sovereign selected by default with the animated border beam; segmented control visible on desktop, hidden below 640px; clicking a card / segment moves the beam + check + fills that CTA; offer banner + struck prices + "20% off · ends …" caption on Treasury & Sovereign; the `Reserve` card has no chip; theme toggle recolours the beam (purple/orange ↔ gold/amber).
4. Dismiss via "Maybe later" → gone. Reload → does not reappear. Open a fresh tab on `/dashboard` → appears again.
5. (Optional) In DevTools set `prefers-reduced-motion: reduce` → modal still opens, no beam animation, no entrance scale.

Fix any visual regressions against `.superpowers/brainstorm/mockup-upgrade-sheet-v10.html`, committing each fix with a clear message.

- [ ] **Step 3: Update the plan checkboxes and the project memory**

- Tick every `- [ ]` in this file that is done, commit the plan.
- Update `~/.claude/projects/-Users-rahulsingh-…-WealthVault/memory/dashboard-upgrade-prompt.md`: change "Next step after spec approval" line to note the plan is implemented on `feature/dashboard-upgrade-prompt`, pending review/merge.

- [ ] **Step 4: Final commit**

```bash
git add docs/superpowers/plans/2026-08-30-dashboard-upgrade-prompt.md
git commit -m "$(printf 'Mark upgrade-prompt plan complete\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

- [ ] **Step 5: Hand back**

Report: branch `feature/dashboard-upgrade-prompt` ready for review; summarise what was built, which tests ran vs skipped, and the follow-ups (real prices + offer window, native i18n review, real checkout wiring).

---

## Self-review notes (checked against the spec)

- **§2 behaviour** → Tasks 3 (`getUpgradePromptData` gate), 10 (timer + sessionStorage), 11 (wiring), 12 (e2e for all three cases). ✅
- **§3 pricing/offers** → Tasks 3 (`buildPlanCardView`, tested in Task 3's file), 7 (seed), 9 (card rendering). Billing-months map, discount rounding, offer-window logic all covered by `plan-card-view.test.ts`. ✅
- **§4 social proof (>100)** → Task 3 (`memberCount` floor logic), Task 5 (null assertion), Task 9 (conditional render). ✅
- **§5 border-beam** → Task 2 (verbatim paste), Task 9 (themed via `--ui-accent` / `--ui-accent-warm`, skipped under `useReducedMotion`). ✅
- **§6 files** → all 12 modified + 8 created files have a task. ✅
- **§7 styling** → Task 9 uses `--ui-*` tokens + Tailwind + framer-motion + portal, matches EditModal's scroll-lock. ✅
- **§8 i18n** → Task 8, all 11 locales, interface entry, `TODO(i18n)` flag. ✅
- **§9 seed** → Task 7, plus Task 4 keeps `ensureReferenceData` in lockstep. ✅
- **§10 testing** → Tasks 1, 3, 5 (Jest), 6 (suite registration), 12 (Playwright), 11 step 4 + 13 (regression + full run). ✅
- **§11 out of scope** — no task adds payment, a manual entry point, analytics beyond the `console.info` hook, or plan mutation. ✅
- **Type consistency:** `PaidTier`, `PlanCardView`, `UpgradePromptData` defined in Task 3 and imported unchanged in Tasks 9, 10, 11. `getPlanId` / `createTestUser({tier})` defined in Task 4, used in Tasks 5 and 12. `formatMoney(amount, currency, locale)` defined in Task 1, called in Task 9. ✅
- **Deviation from spec §10:** the spec suggested an `api/upgrade-prompt` suite name; the plan uses exactly that (`runJest("api/upgrade-prompt")`) and puts the DB integration test there rather than in `tests/database/`, following the lazy-`require` + DB-URL-safety pattern from `subscription-period-service.test.ts`. Test coverage is unchanged. ✅

# Razorpay Recurring Subscriptions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `FREE`-tier user can subscribe to Reserve / Treasury / Sovereign via Razorpay Subscriptions (recurring), the app tracks their effective tier from webhooks + a computed helper (no cron), they can cancel (at cycle end) or change plan from a Manage Subscription screen, and after a 3-year grandfathered term the subscription completes and they return to `FREE`.

**Architecture:** A `PaymentProvider` interface with a `RazorpayProvider` implementation (SDK wrapper + HMAC verification + webhook-event normalisation) and a `FakeProvider` for tests, selected by `getProvider()`. `SubscriptionService` owns `getEffectivePlan` (the access source of truth) and `applySubscriptionEvent` (webhook → DB). Six `/api/subscription/*` routes. The upgrade modal's CTA calls `create` → Razorpay Checkout → `verify`; a public `webhook/[provider]` route is the authoritative confirmation.

**Tech Stack:** Next.js 14.1 (App Router), React 18, TypeScript, Prisma 5.10 + PostgreSQL, iron-session, `razorpay` Node SDK, `node:crypto` for HMAC. Tests: Jest (`tests/jest.config.js`, node env, ts-jest) + Playwright.

**Spec:** `docs/superpowers/specs/2026-08-30-razorpay-subscriptions-design.md` — read it before starting. Section refs below (§4, §6, …) point into it.
**Branch:** `feature/razorpay-subscriptions` (created; the spec is committed there).
**Prereq state:** `frontend/.env` already contains `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_PLAN_ID_{MONTHLY,QUARTERLY,ANNUAL}` (test values). `RAZORPAY_WEBHOOK_SECRET` is blank — Task 10 adds a test constant so tests don't need it; the real value is set before go-live.

---

## Conventions

- Repo root: `/Users/rahulsingh/Documents/Documents/CreativeAppz/Github/WealthVault/main/WealthVault`.
- Jest: `cd tests && npx jest --config jest.config.js <pattern> --runInBand`.
- **tsc baseline:** the frontend currently has **89** pre-existing `tsc` errors (stale Prisma client vs a reduced 4-model schema — see the upgrade-prompt spec). **Task 1 runs `prisma generate`, which regenerates the client and changes that number** — Task 1 records the new baseline `N`; every later "type-check" step means `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` stays `== N` **and** `... | grep -E "<your files>"` is empty. `next build` is never run (it can't pass); the e2e is the runtime gate.
- App code style: files under `src/app/api/**` and `src/lib/**` use **single quotes, no semicolons** in the older files and **double quotes, semicolons** in newer ones — match the nearest sibling; be consistent within a file.
- Commit trailer on every commit: `Claude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB`
- Do NOT `git checkout` / `switch` / `reset` — stay on `feature/razorpay-subscriptions`.

---

## File structure

### New files

| File | Responsibility |
|---|---|
| `frontend/src/lib/payments/types.ts` | `PaymentProvider` interface + DTOs (`CreateSubscriptionInput`, `NormalizedWebhookEvent`, `CheckoutParams`, …) |
| `frontend/src/lib/payments/razorpay.ts` | `RazorpayProvider` — `razorpay` SDK wrapper, `verifyCheckoutSignature`, `verifyWebhookSignature`, `normalizeWebhookEvent`, `ensureCustomer`, `createSubscription`, `cancelAtCycleEnd`, `fetchSubscription` |
| `frontend/src/lib/payments/fake.ts` | `FakeProvider` — deterministic; used when `PAYMENTS_PROVIDER === "fake"` |
| `frontend/src/lib/payments/index.ts` | `getProvider(name?)` registry + the `fake` seam |
| `frontend/src/lib/payments/webhookSecret.ts` | resolves the webhook secret: `process.env.RAZORPAY_WEBHOOK_SECRET \|\| TEST fallback` — exported so tests import the same constant |
| `frontend/src/lib/payments/checkout.ts` | client `startCheckout()` + `loadRazorpayCheckout()` |
| `frontend/src/lib/services/SubscriptionService.ts` | `totalCountFor`, `getEffectivePlan`, `applySubscriptionEvent`, `buildManageView` |
| `frontend/src/app/api/subscription/create/route.ts` | POST |
| `frontend/src/app/api/subscription/verify/route.ts` | POST |
| `frontend/src/app/api/subscription/cancel/route.ts` | POST |
| `frontend/src/app/api/subscription/change-plan/route.ts` | POST |
| `frontend/src/app/api/subscription/route.ts` | GET |
| `frontend/src/app/api/subscription/webhook/[provider]/route.ts` | POST (public) |
| `frontend/src/app/subscription/page.tsx` | Manage Subscription screen (server) |
| `frontend/src/components/subscription/ManageSubscription.tsx` | client section |
| `frontend/src/components/subscription/RenewalBanner.tsx` | AppShell banner when a renewal is retrying |
| `tests/helpers/fakeProvider.ts` | re-export of `FakeProvider` + helpers to craft signed webhook payloads |
| `tests/helpers/subscriptionFactory.ts` | `createSubscriptionRow(userId, overrides)` test helper |
| `tests/api/subscription/*.test.ts` | unit + integration |
| `tests/e2e/subscription.spec.ts` | e2e with a stubbed `window.Razorpay` |

### Modified files

| File | Change |
|---|---|
| `frontend/prisma/schema.prisma` | `SubscriptionPlan` +3 cols; `User` +2; new `Subscription` + `ProcessedWebhookEvent` models |
| `frontend/prisma/seed.ts` | `SubscriptionPlan` rows — new per-cycle `price`/`offerPrice`, `intervalMonths`, `termMonths`, `razorpayPlanId` from env |
| `frontend/src/lib/services/UpgradePromptService.ts` | `buildPlanCardView` reads `intervalMonths` + per-cycle `price`/`offerPrice`; `getUpgradePromptData` gates via `getEffectivePlan` |
| `frontend/src/app/api/auth/me/route.ts` | `subscription` from `getEffectivePlan` |
| `frontend/src/app/dashboard/page.tsx` | (unchanged if `getUpgradePromptData` handles the gate — verify) |
| `frontend/src/components/dashboard/UpgradeModal.tsx` | CTA → `create` → `startCheckout` → `verify` |
| `frontend/src/middleware.ts` | `/api/subscription/webhook` public |
| `frontend/src/components/layout/AppShell.tsx` | mount `<RenewalBanner />` |
| `frontend/src/components/layout/Sidebar.tsx` | "Subscription" link in the settings popover |
| `frontend/src/i18n/translations.ts` | `manageSubscription` + `renewalBanner` namespaces × 11 locales |
| `frontend/package.json` | `razorpay` dependency |
| `tests/helpers/seedReferenceData.ts` | new `SubscriptionPlan` shape (per-cycle price, interval/term, `razorpayPlanId`) |
| `tests/helpers/testUser.ts` | (no change needed — `subscriptionFactory` is separate) |
| `tests/run-tests.ts`, `run-tests.sh` | register the `subscription` suite |
| `tests/playwright.config.ts` | `webServer.env`: `PAYMENTS_PROVIDER: "fake"`, `RAZORPAY_WEBHOOK_SECRET: "<test>"` |
| `tests/e2e/upgrade-prompt.spec.ts`, `tests/api/upgrade-prompt/plan-card-view.test.ts` | update price fixtures to the new per-cycle numbers |

---

## Task 1: Schema migration + seed + regenerate client + re-baseline tsc

**Files:** `frontend/prisma/schema.prisma`, `frontend/prisma/seed.ts`, `tests/helpers/seedReferenceData.ts`

- [ ] **Step 1: Edit `frontend/prisma/schema.prisma`**

In `model SubscriptionPlan`, add before the closing `}` (after `users` / `subscriptionPeriods`):

```prisma
  razorpayPlanId      String?
  intervalMonths      Int?
  termMonths          Int?                 @default(36)
  subscriptions       Subscription[]
```

In `model User`, add after `subscriptionPeriods`:

```prisma
  razorpayCustomerId  String?
  subscriptions       Subscription[]
```

**Name collision:** `schema.prisma` already has `enum Subscription { FREE MONTHLY QUARTERLY ANNUAL }` (the type of `SubscriptionPlan.tier`). A `model Subscription` cannot coexist with it. **Rename the enum to `Tier` and add `@@map("Subscription")`** so the Postgres enum type name is unchanged (purely additive — `db push` shows no DROP). Nothing in `src/` or `tests/` imports the Prisma enum by name (verified), so this is safe. The generated client now exports `Tier` (same 4 values). All later tasks that reference the Prisma tier enum type use `Tier`.

Add two new models at the end of the file:

```prisma
model Subscription {
  id                     String           @id @default(uuid())
  userId                 String
  user                   User             @relation(fields: [userId], references: [id])
  subscriptionPlanId     String
  subscriptionPlan       SubscriptionPlan @relation(fields: [subscriptionPlanId], references: [id])

  provider               String           @default("razorpay")
  providerSubscriptionId String           @unique
  providerPlanId         String
  providerCustomerId     String?
  providerData           Json?

  status                 String           @default("created")
  totalCount             Int
  paidCount              Int              @default(0)
  currentStart           DateTime?
  currentEnd             DateTime?
  chargeAt               DateTime?
  startAt                DateTime?
  endedAt                DateTime?
  cancelAtCycleEnd       Boolean          @default(false)

  amount                 Int
  currency               String           @default("INR")
  offerId                String?
  supersedesId           String?

  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt

  @@index([userId])
  @@map("subscriptions")
}

model ProcessedWebhookEvent {
  id        String   @id @default(uuid())
  provider  String   @default("razorpay")
  eventId   String
  // "processing" until applySubscriptionEvent succeeds, then "done" — see the
  // Task 8 note below (added by that task's review fix, not Task 1 itself).
  status    String   @default("processing")
  createdAt DateTime @default(now())

  @@unique([provider, eventId])
  @@map("processed_webhook_events")
}
```

> **Note:** `status` was added by a Task 8 review fix, after this model was first created — see Task 8's note for why. Listed here so Task 1, read on its own, matches the final schema.

> **`backend/prisma/schema.prisma` is a mandated-identical copy** (its header says so; `backend/package.json` has `prisma migrate` scripts on the same DB). Every schema change in this plan must be mirrored there (keep its header) + `cd backend && npx prisma generate`. Task 1's review-fix commit does this. `documents/database/*.md` are stale after this feature — a deferred docs follow-up, not in this plan.

- [ ] **Step 2: Push the schema + regenerate the client**

**This project's DB is NOT managed by Prisma Migrate** (no `prisma/migrations/`, `prisma migrate status` says "not managed by Prisma Migrate"). It uses `prisma db push` (see `package.json` `db:push`). Do **NOT** run `prisma migrate` — it would offer to reset the database.

Run: `cd frontend && npx prisma db push`
Expected: "Your database is now in sync with your Prisma schema" + "Generated Prisma Client". The changes are purely additive (3 nullable columns on `subscription_plans`, 2 on `users`, 2 new tables) — `db push` applies them without data loss and **prompts nothing**. If it warns about data loss, STOP and report — something else is off.
Then `npx prisma generate` (db push already does this, but run it explicitly to be sure the client is fresh).
If the shell can't reach the DB: run `npx prisma generate` alone (regenerates the client from the schema so `tsc` and the type-checks work) and note that `db push` must be run against the real DB before the integration/e2e suites.

- [ ] **Step 3: Record the new tsc baseline**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"`
Write the number here in the plan: **BASELINE = 89** (regenerating the client for the new models typically *reduces* the count since `Subscription` etc. now exist; the asset-model errors remain). Every later task's type-check step uses this number.

- [ ] **Step 4: Update `frontend/prisma/seed.ts`**

Replace the subscription-plan block (the `createMany` added by the upgrade-prompt work) with:

```ts
  // Subscription plans — per-cycle amounts in whole INR.
  //   price      = list amount charged per billing cycle
  //   offerPrice = current intro amount (60% off) charged per cycle — matches the live Razorpay Plans
  // razorpayPlanId comes from the RAZORPAY_PLAN_ID_* env (test values in frontend/.env).
  const offerStart = new Date('2026-08-01T00:00:00Z');
  const offerEnd = new Date('2026-09-30T23:59:59Z');
  await prisma.subscriptionPlan.createMany({
    data: [
      { tier: 'FREE',      price: 0,     offerPrice: null,  currency: 'INR', isActive: true, intervalMonths: null, termMonths: null, razorpayPlanId: null },
      { tier: 'MONTHLY',   price: 9000,  offerPrice: 3600,  currency: 'INR', isActive: true, intervalMonths: 1,  termMonths: 36, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_MONTHLY ?? null,   offerStartDate: offerStart, offerEndDate: offerEnd },
      { tier: 'QUARTERLY', price: 18000, offerPrice: 7200,  currency: 'INR', isActive: true, intervalMonths: 3,  termMonths: 36, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_QUARTERLY ?? null, offerStartDate: offerStart, offerEndDate: offerEnd },
      { tier: 'ANNUAL',    price: 36000, offerPrice: 14400, currency: 'INR', isActive: true, intervalMonths: 12, termMonths: 36, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_ANNUAL ?? null,    offerStartDate: offerStart, offerEndDate: offerEnd },
    ],
  });
  console.log('✅ Subscription plans seeded (list + 60% intro, Razorpay plan ids)');
```

- [ ] **Step 5: Update `tests/helpers/seedReferenceData.ts`**

Change the `PLAN_PRICING` map to the new per-cycle numbers + interval/term/razorpayPlanId:

```ts
const PLAN_PRICING: Record<
  Tier,
  { price: number; offerPrice: number | null; offerStartDate: Date | null; offerEndDate: Date | null; intervalMonths: number | null; termMonths: number | null; razorpayPlanId: string | null }
> = {
  FREE:      { price: 0,     offerPrice: null,  offerStartDate: null,        offerEndDate: null,        intervalMonths: null, termMonths: null, razorpayPlanId: null },
  MONTHLY:   { price: 9000,  offerPrice: 3600,  offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 1,   termMonths: 36,   razorpayPlanId: 'plan_test_monthly' },
  QUARTERLY: { price: 18000, offerPrice: 7200,  offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 3,   termMonths: 36,   razorpayPlanId: 'plan_test_quarterly' },
  ANNUAL:    { price: 36000, offerPrice: 14400, offerStartDate: OFFER_START, offerEndDate: OFFER_END,   intervalMonths: 12,  termMonths: 36,   razorpayPlanId: 'plan_test_annual' },
};
```

The `upsert` in `ensureReferenceData` already spreads `...pricing` into both `update` and `create`, so no other change there.

- [ ] **Step 6: Run the DB suites to confirm the migration + seed shape**

Run: `cd tests && npx jest --config jest.config.js database --runInBand`
Expected: `schema.test.ts` + `subscription-period-service.test.ts` still pass (20 tests). `schema.test.ts` asserts the physical column order of `subscription_plans` / `users` (via `information_schema.columns`) — **if it fails on the new columns, update the expected column list in that test** to include `razorpayPlanId, intervalMonths, termMonths` (subscription_plans) and `razorpayCustomerId` (users) in the position `db push` actually added them (run `echo '\d subscription_plans' | npx prisma db execute --stdin` — or a `SELECT column_name FROM information_schema.columns WHERE table_name='subscription_plans' ORDER BY ordinal_position` — to see the real order). Note the exact edit in your report.

- [ ] **Step 7: Commit**

```bash
git add frontend/prisma/schema.prisma frontend/prisma/seed.ts tests/helpers/seedReferenceData.ts
git add tests/database/schema.test.ts   # only if Step 6 edited it
git commit -m "$(printf 'Subscription schema (db push): Subscription + ProcessedWebhookEvent models, plan interval/term/razorpayPlanId\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

> `db push` writes no migration files. The generated client lives in `frontend/node_modules/.prisma` (not committed). `git status` after the push should show only `schema.prisma` + `seed.ts` (+ maybe the test helper / test) as changed — nothing under `prisma/migrations/`.

---

## Task 2: `razorpay` dependency + `payments/types.ts` + webhook-secret helper

**Files:** `frontend/package.json`, `frontend/src/lib/payments/types.ts`, `frontend/src/lib/payments/webhookSecret.ts`

- [ ] **Step 1: Add the SDK**

Run: `cd frontend && npm install razorpay@2.9.8 --save-exact`
(Pin exactly. It's a server-only dep. `npm install` updates `package.json` + lockfile.)

- [ ] **Step 2: Create `frontend/src/lib/payments/types.ts`** — verbatim:

```ts
export type ProviderName = "razorpay";

export interface PlanForCheckout {
  tier: string;
  providerPlanId: string;
  totalCount: number;
  amountPaise: number;
  currency: string;
}

export interface CreateSubscriptionInput {
  userId: string;
  plan: PlanForCheckout;
  providerCustomerId: string;
  startAt?: number; // unix seconds
  offerId?: string;
  notes: Record<string, string>;
}

export interface CreatedSubscription {
  providerSubscriptionId: string;
  status: string; // normalised
  shortUrl?: string;
  raw: unknown;
}

export interface CheckoutParams {
  provider: ProviderName;
  razorpay?: { keyId: string; subscriptionId: string; name: string };
}

export type WebhookEventKind =
  | "authenticated"
  | "activated"
  | "charged"
  | "pending"
  | "halted"
  | "cancelled"
  | "completed"
  | "updated"
  | "ignored";

export interface NormalizedWebhookEvent {
  kind: WebhookEventKind;
  eventId: string;
  providerSubscriptionId: string;
  status: string; // normalised subscription status
  paidCount?: number;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  cancelAtCycleEnd?: boolean;
  providerPlanId?: string;
}

export interface EnsureCustomerUser {
  id: string;
  fullName: string;
  email: string | null;
  razorpayCustomerId: string | null;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  ensureCustomer(user: EnsureCustomerUser): Promise<string>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription>;
  verifyCheckoutSignature(p: { paymentId: string; subscriptionId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean;
  normalizeWebhookEvent(rawBody: string): NormalizedWebhookEvent;
  cancelAtCycleEnd(providerSubscriptionId: string): Promise<void>;
  fetchSubscription(providerSubscriptionId: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }>;
}
```

- [ ] **Step 3: Create `frontend/src/lib/payments/webhookSecret.ts`** — verbatim:

```ts
/**
 * The Razorpay webhook secret. In production this MUST come from the env
 * (set when the webhook is created in the Razorpay dashboard). Tests and the
 * e2e run use the fixed fallback so signed fixtures are reproducible.
 */
export const RAZORPAY_WEBHOOK_SECRET =
  process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_test_wealthvault_fixed";
```

- [ ] **Step 4: Type-check + commit**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → `== BASELINE`; `... | grep "payments/"` → empty.

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/payments/
git commit -m "$(printf 'Add razorpay SDK + PaymentProvider interface + webhook-secret helper\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 3: `RazorpayProvider` — HMAC verification + webhook normalisation (TDD)

**Files:** `frontend/src/lib/payments/razorpay.ts`, `tests/api/subscription/razorpay-provider.test.ts`

The two verification functions and `normalizeWebhookEvent` are pure and testable without the SDK or a network. `ensureCustomer` / `createSubscription` / `cancelAtCycleEnd` / `fetchSubscription` call the SDK — covered by the `FakeProvider` in integration tests, not here.

- [ ] **Step 1: Write the failing test** — `tests/api/subscription/razorpay-provider.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { RazorpayProvider } from "@/lib/payments/razorpay";
import { RAZORPAY_WEBHOOK_SECRET } from "@/lib/payments/webhookSecret";

// The provider reads RAZORPAY_KEY_SECRET at construction; set a known one.
const KEY_SECRET = "test_key_secret_123";
process.env.RAZORPAY_KEY_SECRET = KEY_SECRET;
process.env.RAZORPAY_KEY_ID = "rzp_test_x";

const provider = new RazorpayProvider();

describe("verifyCheckoutSignature", () => {
  const paymentId = "pay_ABC";
  const subscriptionId = "sub_XYZ";
  const good = createHmac("sha256", KEY_SECRET).update(`${paymentId}|${subscriptionId}`).digest("hex");

  test("accepts a correct signature", () => {
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: good })).toBe(true);
  });
  test("rejects a wrong signature", () => {
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: "deadbeef" })).toBe(false);
  });
  test("rejects when the payload differs", () => {
    const other = createHmac("sha256", KEY_SECRET).update(`pay_OTHER|${subscriptionId}`).digest("hex");
    expect(provider.verifyCheckoutSignature({ paymentId, subscriptionId, signature: other })).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "subscription.charged", payload: {} });
  const good = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");

  test("accepts a correct signature over the raw body", () => {
    expect(provider.verifyWebhookSignature(body, good)).toBe(true);
  });
  test("rejects a tampered body", () => {
    expect(provider.verifyWebhookSignature(body + " ", good)).toBe(false);
  });
  test("rejects a null header", () => {
    expect(provider.verifyWebhookSignature(body, null)).toBe(false);
  });
});

describe("normalizeWebhookEvent", () => {
  function evt(event: string, sub: Record<string, unknown>) {
    return JSON.stringify({
      id: "evt_1",
      event,
      payload: { subscription: { entity: { id: "sub_1", status: "active", plan_id: "plan_1", ...sub } } },
    });
  }

  test("subscription.activated → kind 'activated', dates parsed from unix seconds", () => {
    const n = provider.normalizeWebhookEvent(
      evt("subscription.activated", { status: "active", current_start: 1735689600, current_end: 1738368000, charge_at: 1738368000, paid_count: 1 }),
    );
    expect(n.kind).toBe("activated");
    expect(n.status).toBe("active");
    expect(n.providerSubscriptionId).toBe("sub_1");
    expect(n.eventId).toBe("evt_1");
    expect(n.paidCount).toBe(1);
    expect(n.currentEnd?.toISOString()).toBe("2025-02-01T00:00:00.000Z");
  });

  test("subscription.charged → kind 'charged'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.charged", { paid_count: 2 })).kind).toBe("charged");
  });
  test("subscription.pending → kind 'pending'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.pending", { status: "pending" })).kind).toBe("pending");
  });
  test("subscription.halted → kind 'halted'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.halted", { status: "halted" })).kind).toBe("halted");
  });
  test("subscription.cancelled → kind 'cancelled'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.cancelled", { status: "cancelled" })).kind).toBe("cancelled");
  });
  test("subscription.completed → kind 'completed'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.completed", { status: "completed" })).kind).toBe("completed");
  });
  test("subscription.authenticated → kind 'authenticated'", () => {
    expect(provider.normalizeWebhookEvent(evt("subscription.authenticated", { status: "authenticated" })).kind).toBe("authenticated");
  });
  test("unknown event → kind 'ignored'", () => {
    expect(provider.normalizeWebhookEvent(evt("payment.captured", {})).kind).toBe("ignored");
  });
});
```

- [ ] **Step 2: Run — expect failure**

Run: `cd tests && npx jest --config jest.config.js api/subscription/razorpay-provider --runInBand`
Expected: FAIL — cannot find `@/lib/payments/razorpay`.

- [ ] **Step 3: Implement `frontend/src/lib/payments/razorpay.ts`**

```ts
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "./webhookSecret";
import type {
  CreateSubscriptionInput,
  CreatedSubscription,
  EnsureCustomerUser,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
  WebhookEventKind,
} from "./types";

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ba.length !== bb.length || ba.length === 0) return false;
  return timingSafeEqual(ba, bb);
}

function unixToDate(v: unknown): Date | null {
  return typeof v === "number" && v > 0 ? new Date(v * 1000) : null;
}

const EVENT_KIND: Record<string, WebhookEventKind> = {
  "subscription.authenticated": "authenticated",
  "subscription.activated": "activated",
  "subscription.charged": "charged",
  "subscription.pending": "pending",
  "subscription.halted": "halted",
  "subscription.cancelled": "cancelled",
  "subscription.completed": "completed",
  "subscription.updated": "updated",
};

/**
 * Pure — does not touch `this`, so it's exported standalone rather than only
 * as a RazorpayProvider method. FakeProvider (Task 4) reuses this directly
 * instead of constructing a RazorpayProvider (which now requires real
 * RAZORPAY_KEY_ID/SECRET at construction time — see the constructor below).
 */
export function normalizeRazorpayWebhookEvent(rawBody: string): NormalizedWebhookEvent {
  const body = JSON.parse(rawBody) as {
    id: string;
    event: string;
    payload?: { subscription?: { entity?: Record<string, unknown> } };
  };
  const e = body.payload?.subscription?.entity ?? {};
  const kind = EVENT_KIND[body.event] ?? "ignored";
  return {
    kind,
    eventId: body.id,
    providerSubscriptionId: String(e.id ?? ""),
    status: String(e.status ?? ""),
    paidCount: typeof e.paid_count === "number" ? e.paid_count : undefined,
    currentStart: unixToDate(e.current_start),
    currentEnd: unixToDate(e.current_end),
    chargeAt: unixToDate(e.charge_at),
    cancelAtCycleEnd: kind === "cancelled" ? Boolean(e.current_end) : undefined,
    providerPlanId: e.plan_id ? String(e.plan_id) : undefined,
  };
}

export class RazorpayProvider implements PaymentProvider {
  readonly name: ProviderName = "razorpay";
  private client: Razorpay;
  private keySecret: string;

  constructor() {
    // Fail fast rather than defaulting to "" — an empty-string HMAC key is
    // guessable, so a misconfigured deployment would silently accept forged
    // signatures instead of rejecting all of them.
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new Error(
        "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set — refusing to construct a RazorpayProvider with a missing/empty key.",
      );
    }
    this.keySecret = keySecret;
    this.client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  verifyCheckoutSignature({ paymentId, subscriptionId, signature }: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    return safeEqualHex(hmacHex(this.keySecret, `${paymentId}|${subscriptionId}`), signature);
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return safeEqualHex(hmacHex(RAZORPAY_WEBHOOK_SECRET, rawBody), signatureHeader);
  }

  normalizeWebhookEvent(rawBody: string): NormalizedWebhookEvent {
    return normalizeRazorpayWebhookEvent(rawBody);
  }

  async ensureCustomer(user: EnsureCustomerUser): Promise<string> {
    if (user.razorpayCustomerId) return user.razorpayCustomerId;
    const created = await this.client.customers.create({
      name: user.fullName,
      ...(user.email ? { email: user.email } : {}),
      fail_existing: 0,
      notes: { userId: user.id },
    });
    return created.id;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const sub = await this.client.subscriptions.create({
      plan_id: input.plan.providerPlanId,
      total_count: input.plan.totalCount,
      quantity: 1,
      customer_notify: 1,
      ...(input.startAt ? { start_at: input.startAt } : {}),
      ...(input.offerId ? { offer_id: input.offerId } : {}),
      notes: input.notes,
    } as Parameters<typeof this.client.subscriptions.create>[0]);
    return {
      providerSubscriptionId: sub.id,
      status: String(sub.status),
      shortUrl: (sub as { short_url?: string }).short_url,
      raw: sub,
    };
  }

  async cancelAtCycleEnd(providerSubscriptionId: string): Promise<void> {
    await this.client.subscriptions.cancel(providerSubscriptionId, true /* cancel_at_cycle_end */);
  }

  async fetchSubscription(providerSubscriptionId: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }> {
    const s = await this.client.subscriptions.fetch(providerSubscriptionId);
    return {
      status: String(s.status),
      currentEnd: unixToDate((s as { current_end?: number }).current_end),
      shortUrl: (s as { short_url?: string }).short_url,
    };
  }
}
```

> The `razorpay` SDK's TS types are loose; the `as Parameters<…>[0]` cast and the `as { … }` narrowings are expected. If `tsc` flags `subscriptions.cancel`'s second arg, check the installed SDK's `.d.ts` — some versions take `{ cancel_at_cycle_end: 1 }` as an object; adapt and note it.

- [ ] **Step 4: Run — expect pass**

Run: `cd tests && npx jest --config jest.config.js api/subscription/razorpay-provider --runInBand` → all pass.

- [ ] **Step 5: Type-check + commit**

`cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → `== BASELINE`; `... | grep "payments/razorpay"` → empty.

```bash
git add frontend/src/lib/payments/razorpay.ts tests/api/subscription/razorpay-provider.test.ts
git commit -m "$(printf 'Add RazorpayProvider: HMAC verify + webhook normalisation\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 4: `FakeProvider` + `getProvider` registry

**Files:** `frontend/src/lib/payments/fake.ts`, `frontend/src/lib/payments/index.ts`, `tests/helpers/fakeProvider.ts`

- [ ] **Step 1: `frontend/src/lib/payments/fake.ts`**

```ts
import { createHmac } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "./webhookSecret";
import { normalizeRazorpayWebhookEvent } from "./razorpay";
import type {
  CreateSubscriptionInput,
  CreatedSubscription,
  EnsureCustomerUser,
  NormalizedWebhookEvent,
  PaymentProvider,
  ProviderName,
} from "./types";

/**
 * Deterministic provider for tests + e2e. Selected when PAYMENTS_PROVIDER === "fake".
 * verifyCheckoutSignature / verifyWebhookSignature use the SAME HMAC scheme as
 * RazorpayProvider so signed test fixtures work against either.
 */
export class FakeProvider implements PaymentProvider {
  readonly name: ProviderName = "razorpay";
  private keySecret = process.env.RAZORPAY_KEY_SECRET || "test_key_secret_123";

  async ensureCustomer(user: EnsureCustomerUser): Promise<string> {
    return user.razorpayCustomerId ?? `cust_fake_${user.id.slice(0, 8)}`;
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription> {
    const id = `sub_fake_${Math.random().toString(36).slice(2, 10)}`;
    return { providerSubscriptionId: id, status: "created", shortUrl: `https://fake.rzp/${id}`, raw: input };
  }

  verifyCheckoutSignature({ paymentId, subscriptionId, signature }: { paymentId: string; subscriptionId: string; signature: string }): boolean {
    const good = createHmac("sha256", this.keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
    return good === signature;
  }

  verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    return createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest("hex") === signatureHeader;
  }

  normalizeWebhookEvent(rawBody: string): NormalizedWebhookEvent {
    // Reuse RazorpayProvider's (pure, standalone) parsing logic directly —
    // NOT `new RazorpayProvider()`, which now throws if real Razorpay keys
    // aren't set (see Task 3's fail-fast fix), which would defeat the point
    // of a fake provider in tests that don't set them.
    return normalizeRazorpayWebhookEvent(rawBody);
  }

  async cancelAtCycleEnd(): Promise<void> {
    /* no-op */
  }

  async fetchSubscription(id: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }> {
    return { status: "active", currentEnd: null, shortUrl: `https://fake.rzp/${id}` };
  }
}
```

- [ ] **Step 2: `frontend/src/lib/payments/index.ts`**

```ts
import type { PaymentProvider, ProviderName } from "./types";
import { RazorpayProvider } from "./razorpay";
import { FakeProvider } from "./fake";

let cached: PaymentProvider | null = null;

export function getProvider(_name: ProviderName = "razorpay"): PaymentProvider {
  if (cached) return cached;
  cached = process.env.PAYMENTS_PROVIDER === "fake" ? new FakeProvider() : new RazorpayProvider();
  return cached;
}

/** test-only: reset the cached instance between tests */
export function __resetProviderCache(): void {
  cached = null;
}

export type { PaymentProvider } from "./types";
```

- [ ] **Step 3: `tests/helpers/fakeProvider.ts`**

```ts
import { createHmac } from "node:crypto";
import { RAZORPAY_WEBHOOK_SECRET } from "../../frontend/src/lib/payments/webhookSecret";

/** Build a Razorpay-shaped webhook body + its signature for the webhook route tests. */
export function signedWebhook(event: string, subscriptionEntity: Record<string, unknown>, eventId = `evt_${Math.random().toString(36).slice(2)}`) {
  const body = JSON.stringify({
    id: eventId,
    event,
    payload: { subscription: { entity: { id: "sub_1", status: "active", plan_id: "plan_test_annual", ...subscriptionEntity } } },
  });
  const signature = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
  return { body, signature, eventId };
}

/** Build a checkout signature the verify route will accept (matches RazorpayProvider). */
export function checkoutSignature(paymentId: string, subscriptionId: string, keySecret = process.env.RAZORPAY_KEY_SECRET || "test_key_secret_123") {
  return createHmac("sha256", keySecret).update(`${paymentId}|${subscriptionId}`).digest("hex");
}
```

- [ ] **Step 4: Type-check + commit**

`cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → `== BASELINE`; `grep -E "payments/(fake|index)"` → empty.

```bash
git add frontend/src/lib/payments/fake.ts frontend/src/lib/payments/index.ts tests/helpers/fakeProvider.ts
git commit -m "$(printf 'Add FakeProvider + getProvider registry (PAYMENTS_PROVIDER=fake seam)\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 5: `SubscriptionService` — `totalCountFor` + `getEffectivePlan` (TDD)

**Files:** `frontend/src/lib/services/SubscriptionService.ts`, `tests/api/subscription/effective-plan.test.ts`, `tests/helpers/subscriptionFactory.ts`, `tests/helpers/testUser.ts`

This is the access source of truth — the most important test in the feature.

> **Also fixed here:** `tests/helpers/testUser.ts`'s `deleteTestUser` cleaned up `SubscriptionPeriod` rows before deleting the user, but not the new `Subscription` rows (no cascade delete) — so it silently leaked test users via its `.catch(() => {})`. Add `await prisma.subscription.deleteMany({ where: { userId } });` alongside the existing `subscriptionPeriod.deleteMany` call, before `user.delete`. Do this once, here — every later task (8, 10, 12) that creates `Subscription` rows via `deleteTestUser` in a `finally` then relies on this fix, with no local workaround needed.

- [ ] **Step 1: `tests/helpers/subscriptionFactory.ts`**

```ts
import { getTestPrisma } from "./testDb";
import { getPlanId, type Tier } from "./seedReferenceData";

type Overrides = Partial<{
  tier: Tier;
  status: string;
  currentEnd: Date | null;
  currentStart: Date | null;
  cancelAtCycleEnd: boolean;
  totalCount: number;
  paidCount: number;
  supersedesId: string | null;
  startAt: Date | null;
  providerSubscriptionId: string;
  createdAt: Date;
}>;

export async function createSubscriptionRow(userId: string, o: Overrides = {}) {
  const prisma = getTestPrisma();
  const tier = o.tier ?? "ANNUAL";
  const subscriptionPlanId = await getPlanId(tier);
  return prisma.subscription.create({
    data: {
      userId,
      subscriptionPlanId,
      provider: "razorpay",
      providerSubscriptionId: o.providerSubscriptionId ?? `sub_${Math.random().toString(36).slice(2, 12)}`,
      providerPlanId: `plan_test_${tier.toLowerCase()}`,
      status: o.status ?? "active",
      totalCount: o.totalCount ?? 3,
      paidCount: o.paidCount ?? 1,
      currentStart: o.currentStart ?? new Date(Date.now() - 86400_000),
      currentEnd: o.currentEnd === undefined ? new Date(Date.now() + 30 * 86400_000) : o.currentEnd,
      cancelAtCycleEnd: o.cancelAtCycleEnd ?? false,
      supersedesId: o.supersedesId ?? null,
      startAt: o.startAt ?? null,
      amount: 1440000,
      currency: "INR",
      ...(o.createdAt ? { createdAt: o.createdAt } : {}),
    },
  });
}
```

- [ ] **Step 2: Write the failing test** — `tests/api/subscription/effective-plan.test.ts`:

```ts
import { hasTestDb, disconnectTestPrisma } from "../../helpers/testDb";
import { ensureReferenceData } from "../../helpers/seedReferenceData";
import { createTestUser, deleteTestUser } from "../../helpers/testUser";
import { createSubscriptionRow } from "../../helpers/subscriptionFactory";

const describeOrSkip = hasTestDb() ? describe : describe.skip;

beforeAll(async () => {
  if (hasTestDb()) {
    if (process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
      throw new Error("DATABASE_URL and TEST_DATABASE_URL differ — refusing to run against the real @/lib/prisma singleton.");
    }
    await ensureReferenceData();
  }
}, 30000);

afterAll(async () => {
  await disconnectTestPrisma();
});

describeOrSkip("getEffectivePlan", () => {
  const { getEffectivePlan, totalCountFor } = require("@/lib/services/SubscriptionService");

  test("totalCountFor computes term/interval", () => {
    expect(totalCountFor({ termMonths: 36, intervalMonths: 1 })).toBe(36);
    expect(totalCountFor({ termMonths: 36, intervalMonths: 3 })).toBe(12);
    expect(totalCountFor({ termMonths: 36, intervalMonths: 12 })).toBe(3);
  });

  test("no subscription rows → FREE", async () => {
    const user = await createTestUser();
    try {
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("active subscription → its paid tier", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active" });
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("ANNUAL");
      expect(eff.paymentRetrying).toBe(false);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("pending subscription → tier kept, paymentRetrying true", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "pending" });
      const eff = await getEffectivePlan(user.id);
      expect(eff.tier).toBe("MONTHLY");
      expect(eff.paymentRetrying).toBe(true);
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("halted → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "halted", currentEnd: null });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("cancelled with currentEnd in the future → tier kept", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "cancelled", currentEnd: new Date(Date.now() + 5 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("completed with currentEnd in the past → FREE", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { status: "completed", currentEnd: new Date(Date.now() - 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("plan change: old completed (past) + new active → new tier", async () => {
    const user = await createTestUser();
    try {
      await createSubscriptionRow(user.id, { tier: "MONTHLY", status: "completed", currentEnd: new Date(Date.now() - 86400_000), createdAt: new Date(Date.now() - 10 * 86400_000) });
      await createSubscriptionRow(user.id, { tier: "ANNUAL", status: "active", currentEnd: new Date(Date.now() + 300 * 86400_000) });
      expect((await getEffectivePlan(user.id)).tier).toBe("ANNUAL");
    } finally {
      await deleteTestUser(user.id);
    }
  });

  test("lazy reconciliation: stale User.subscriptionPlanId gets corrected to FREE", async () => {
    const { getTestPrisma } = require("../../helpers/testDb");
    const { getPlanId } = require("../../helpers/seedReferenceData");
    const prisma = getTestPrisma();
    const user = await createTestUser();
    try {
      // user points at ANNUAL but their only sub is completed & lapsed
      await prisma.user.update({ where: { id: user.id }, data: { subscriptionPlanId: await getPlanId("ANNUAL") } });
      await createSubscriptionRow(user.id, { status: "completed", currentEnd: new Date(Date.now() - 86400_000) });
      await getEffectivePlan(user.id);
      const after = await prisma.user.findUnique({ where: { id: user.id }, include: { subscriptionPlan: true } });
      expect(after.subscriptionPlan.tier).toBe("FREE");
    } finally {
      await deleteTestUser(user.id);
    }
  });
});
```

- [ ] **Step 3: Run — expect failure** (`Cannot find module '@/lib/services/SubscriptionService'`).

- [ ] **Step 4: Implement `frontend/src/lib/services/SubscriptionService.ts`** (`getEffectivePlan` + `totalCountFor` only for this task — `applySubscriptionEvent` and `buildManageView` come in Tasks 8 & 12):

```ts
import { prisma } from "@/lib/prisma";
import { logSubscriptionPeriodIfChanged } from "@/lib/services/SubscriptionPeriodService";
import type { Subscription } from "@prisma/client";

export function totalCountFor(p: { termMonths: number | null; intervalMonths: number | null }): number {
  if (!p.termMonths || !p.intervalMonths) throw new Error("plan is missing termMonths/intervalMonths");
  return Math.round(p.termMonths / p.intervalMonths);
}

// Rows in these statuses grant access regardless of currentEnd (used by both
// grants() and the tie-break below — kept as one set so they can't drift).
const GRANTS_UNCONDITIONALLY = new Set(["active", "authenticated", "pending"]);
const GRANTS_UNTIL_END = new Set(["cancelled", "completed"]);

function grants(row: Subscription, now: Date): boolean {
  // A scheduled (plan-change) row hasn't started yet, regardless of status —
  // it must not outrank the still-current subscription before its startAt.
  if (row.startAt && now < row.startAt) return false;
  if (GRANTS_UNCONDITIONALLY.has(row.status)) return true;
  if (GRANTS_UNTIL_END.has(row.status)) return !!row.currentEnd && now < row.currentEnd;
  return false;
}

export interface EffectivePlan {
  tier: string;
  subscriptionPlanId: string;
  currentEnd: Date | null;
  paymentRetrying: boolean;
}

export async function getEffectivePlan(userId: string): Promise<EffectivePlan> {
  const now = new Date();
  const [rows, freePlan, user] = await Promise.all([
    prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { subscriptionPlan: true },
    }),
    prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } }),
    prisma.user.findUnique({ where: { id: userId }, select: { subscriptionPlanId: true } }),
  ]);

  const granting = rows.filter((r) => grants(r, now));
  // prefer the one whose access extends furthest (or an unconditionally-granting row)
  const chosen =
    granting.sort((a, b) => {
      const ae = a.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(a.status) ? Infinity : 0);
      const be = b.currentEnd?.getTime() ?? (GRANTS_UNCONDITIONALLY.has(b.status) ? Infinity : 0);
      return be - ae;
    })[0] ?? null;

  const effective: EffectivePlan = chosen
    ? {
        tier: chosen.subscriptionPlan.tier,
        subscriptionPlanId: chosen.subscriptionPlanId,
        currentEnd: chosen.currentEnd,
        paymentRetrying: granting.some((r) => r.status === "pending"),
      }
    : { tier: "FREE", subscriptionPlanId: freePlan.id, currentEnd: null, paymentRetrying: false };

  // lazy reconciliation of the denormalised User.subscriptionPlanId cache
  if (user && user.subscriptionPlanId !== effective.subscriptionPlanId) {
    await prisma.user.update({ where: { id: userId }, data: { subscriptionPlanId: effective.subscriptionPlanId } });
    await logSubscriptionPeriodIfChanged(userId, effective.subscriptionPlanId);
  }

  return effective;
}
```

> **Review-driven fixes** (applied after the first implementation, see the "Also fixed" note above Step 1): (1) `grants()` now checks `startAt` first — a scheduled plan-change row must not grant/outrank before it actually starts. (2) The tie-break's "infinite" check now shares `GRANTS_UNCONDITIONALLY` with `grants()` (previously used a narrower `GRANTS_ALWAYS` that excluded `pending`, mis-ranking pending rows). (3) `paymentRetrying` is scoped to `granting` rows, not all historical rows. (4) `user.findUnique` joined into the initial `Promise.all`; the FREE-plan lookup uses `findUniqueOrThrow` (tier is `@unique`). Tasks 8/9/10, which build on this file, should use this corrected version.

- [ ] **Step 5: Run — expect pass** (`cd tests && npx jest --config jest.config.js api/subscription/effective-plan --runInBand`).

- [ ] **Step 6: Type-check + commit**

```bash
git add frontend/src/lib/services/SubscriptionService.ts tests/api/subscription/effective-plan.test.ts tests/helpers/subscriptionFactory.ts
git commit -m "$(printf 'Add SubscriptionService.getEffectivePlan + totalCountFor (computed effective tier)\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 6: Refactor `UpgradePromptService` + fix upgrade-prompt fixtures

**Files:** `frontend/src/lib/services/UpgradePromptService.ts`, `tests/api/upgrade-prompt/plan-card-view.test.ts`, `tests/e2e/upgrade-prompt.spec.ts`

`price`/`offerPrice` are now list/intro **per cycle** and `SubscriptionPlan` has `intervalMonths` — drop the hardcoded `BILLING_MONTHS` map, read the column. Gate `getUpgradePromptData` on `getEffectivePlan`.

- [ ] **Step 1: Edit `buildPlanCardView`** — replace `BILLING_MONTHS[tier]` with `plan.intervalMonths` (throw if null for a paid tier), and confirm `basePerPeriod` / `effectivePerPeriod` already come from `Number(plan.price)` / `Number(plan.offerPrice)` (per cycle) — they do; only the divisor source changes. `billingMonths` field of `PlanCardView` = `plan.intervalMonths`.

- [ ] **Step 2: Edit `getUpgradePromptData`** — replace the `user.subscriptionPlan.tier !== "FREE"` check with:
```ts
  const eff = await getEffectivePlan(userId);
  if (eff.tier !== "FREE") return null;
```
(import `getEffectivePlan` from `./SubscriptionService`). Keep the `!userId` / user-not-found guards.

- [ ] **Step 3: Update `tests/api/upgrade-prompt/plan-card-view.test.ts`** — `buildPlanCardView` now reads `plan.intervalMonths` instead of the removed `BILLING_MONTHS` map, so:
  - The `plan()` test-row builder must set `intervalMonths` — add it to the defaults (`intervalMonths: 3` for the default QUARTERLY-ish row) and to the per-test overrides that set a `tier` (`intervalMonths: 1` when `tier: "MONTHLY"`, `12` when `tier: "ANNUAL"`).
  - `buildPlanCardView` should **throw** when `intervalMonths` is null for a paid tier — add a test: `plan({ tier: "MONTHLY", intervalMonths: null })` → `expect(() => buildPlanCardView(...)).toThrow()`.
  - The existing assertions use arbitrary `price`/`offerPrice` (not seed values), so `discountPercent` / `effectivePerPeriod` expectations mostly stand — but re-check each: any that computed `billingMonths` from the tier now get it from `intervalMonths`, so the override must supply the matching number. The "offer active" ANNUAL case: if it asserts `billingMonths === 12`, give the row `intervalMonths: 12`.

- [ ] **Step 4: Update `tests/e2e/upgrade-prompt.spec.ts`** — the price regex `/₹1,[0-9]{3}\s*\/mo/i` still matches ₹1,200 (Sovereign intro per-month). No change needed unless an assertion hard-codes a different number — scan and adjust. The "20% off" text is now "60% off"; if any assertion referenced a percentage, update to `/60% off/i` (or keep it generic).

- [ ] **Step 5: Run** — `cd tests && npx jest --config jest.config.js api/upgrade-prompt --runInBand` → all pass. Then `cd frontend && npx tsc --noEmit 2>&1 | grep -c "error TS"` → `== BASELINE`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/services/UpgradePromptService.ts tests/api/upgrade-prompt/ tests/e2e/upgrade-prompt.spec.ts
git commit -m "$(printf 'UpgradePromptService: read intervalMonths from the DB, gate on getEffectivePlan\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 7: `/api/auth/me` uses `getEffectivePlan`

**Files:** `frontend/src/app/api/auth/me/route.ts`

- [ ] **Step 1: Edit the route** — replace `subscription: dbUser.subscriptionPlan.tier` with a call to `getEffectivePlan(session.userId)` and return `subscription: eff.tier` plus `paymentRetrying: eff.paymentRetrying` and `subscriptionEndsAt: eff.currentEnd`. Keep the avatar back-fill logic. The `include: { subscriptionPlan: true }` can stay or go (still used elsewhere in the response? check — if only for `.tier`, drop it and add the `getEffectivePlan` call).

- [ ] **Step 2: Run the auth suite** — `cd tests && npx jest --config jest.config.js api/auth --runInBand` → still passes (24 tests; the `me` tests may assert `subscription` — update expectations to `FREE` for the default test user which has no `Subscription` rows).

- [ ] **Step 3: tsc + commit**

```bash
git add frontend/src/app/api/auth/me/route.ts tests/api/auth/
git commit -m "$(printf 'auth/me: report subscription tier from getEffectivePlan\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 8: `applySubscriptionEvent` + `POST /api/subscription/webhook/[provider]` (TDD)

**Files:** `frontend/src/lib/services/SubscriptionService.ts` (append), `frontend/src/app/api/subscription/webhook/[provider]/route.ts`, `frontend/src/middleware.ts`, `tests/api/subscription/webhook.test.ts`

- [ ] **Step 1: Append `applySubscriptionEvent` to `SubscriptionService.ts`**

```ts
import type { NormalizedWebhookEvent } from "@/lib/payments/types";

const TERMINAL = new Set(["halted", "completed", "expired"]);

export async function applySubscriptionEvent(evt: NormalizedWebhookEvent): Promise<void> {
  if (evt.kind === "ignored") return;

  const row = await prisma.subscription.findUnique({ where: { providerSubscriptionId: evt.providerSubscriptionId } });
  if (!row) {
    console.warn("[subscription] webhook for unknown subscription", evt.providerSubscriptionId);
    return;
  }

  await prisma.subscription.update({
    where: { id: row.id },
    data: {
      status: evt.status || row.status,
      paidCount: evt.paidCount ?? row.paidCount,
      currentStart: evt.currentStart ?? row.currentStart,
      currentEnd: evt.currentEnd ?? row.currentEnd,
      chargeAt: evt.chargeAt ?? row.chargeAt,
      cancelAtCycleEnd: evt.cancelAtCycleEnd ?? row.cancelAtCycleEnd,
      endedAt: TERMINAL.has(evt.status) ? new Date() : row.endedAt,
    },
  });

  // recompute + reconcile the user's effective tier across ALL their rows
  await getEffectivePlan(row.userId);
}
```

- [ ] **Step 2: Add the webhook route** — `frontend/src/app/api/subscription/webhook/[provider]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { applySubscriptionEvent } from "@/lib/services/SubscriptionService";

export async function POST(req: NextRequest, { params }: { params: { provider: string } }) {
  if (params.provider !== "razorpay") {
    return NextResponse.json({ error: "unknown provider" }, { status: 404 });
  }
  const raw = await req.text();
  const provider = getProvider("razorpay");

  if (!provider.verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"))) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const evt = provider.normalizeWebhookEvent(raw);

  // Idempotency: create the row up front. On a real duplicate (unique
  // constraint), only skip reprocessing if a PRIOR attempt actually finished
  // ("done") — a row stuck at "processing" means a prior attempt crashed
  // before completing, and it's safe (and necessary) to retry, because
  // applySubscriptionEvent writes absolute values, never deltas.
  let alreadyDone = false;
  try {
    await prisma.processedWebhookEvent.create({ data: { provider: "razorpay", eventId: evt.eventId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const existing = await prisma.processedWebhookEvent.findUnique({
        where: { provider_eventId: { provider: "razorpay", eventId: evt.eventId } },
      });
      alreadyDone = existing?.status === "done";
    } else {
      console.error("[subscription] webhook idempotency check failed", e);
      return NextResponse.json({ error: "idempotency check failed" }, { status: 500 });
    }
  }

  if (alreadyDone) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    await applySubscriptionEvent(evt);
  } catch (e) {
    console.error("[subscription] webhook processing failed", e);
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }

  await prisma.processedWebhookEvent.updateMany({
    where: { provider: "razorpay", eventId: evt.eventId },
    data: { status: "done" },
  });

  return NextResponse.json({ ok: true });
}
```

> **Review-driven fix:** the original version created the idempotency row BEFORE processing and treated any `create()` failure as "already processed." A 500 from `applySubscriptionEvent` (Razorpay retries) would then be silently swallowed as a duplicate on retry — for a terminal event like `halted`, that permanently left a user with paid access forever, undetected. `ProcessedWebhookEvent` gained a `status: "processing" | "done"` column (`@default("processing")`, applied via `db push` — mirror into `backend/prisma/schema.prisma` too, per the mandatory-sync convention); a row stuck at `"processing"` is safely reprocessed (the function only ever writes absolute values, never deltas); only a genuine `P2002` unique-constraint hit on an already-`"done"` row short-circuits. Task 9/10, which add more `applySubscriptionEvent`/webhook-adjacent code, should assume this version.

- [ ] **Step 3: Middleware** — in `frontend/src/middleware.ts`, add to the "Always public" `if (...)` list:
```ts
    pathname.startsWith("/api/subscription/webhook") ||
```

- [ ] **Step 4: Write `tests/api/subscription/webhook.test.ts`** — DB integration, uses the running dev server (like `tests/api/dashboard/dashboard.test.ts` via `ensureDevServer`) **OR** call the route handler directly. Prefer calling `applySubscriptionEvent` directly for the state-machine assertions + one live `fetch` to the dev server's webhook URL for the signature/dedupe path. Cases:
  - bad signature → 400
  - unknown event id first time → processed; same event id again → `{ duplicate: true }`, and `paidCount` unchanged (no double apply)
  - `activated` on a `created` row → row `active`, `currentEnd` set, `User.subscriptionPlanId` → that tier, a `SubscriptionPeriod` row logged
  - `charged` with a higher `paid_count` → absolute update
  - `pending` → tier kept, next `getEffectivePlan().paymentRetrying === true`
  - `halted` → `User` → FREE
  - `cancelled` with future `current_end` → tier kept until then
  Use `signedWebhook(...)` from `tests/helpers/fakeProvider.ts` and `createSubscriptionRow(...)`.

- [ ] **Step 5: Run** → pass. tsc → `== BASELINE`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/services/SubscriptionService.ts frontend/src/app/api/subscription/webhook frontend/src/middleware.ts tests/api/subscription/webhook.test.ts
git commit -m "$(printf 'Add subscription webhook route + applySubscriptionEvent\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 9: `POST /api/subscription/create` + `POST /api/subscription/verify` (TDD)

**Files:** `frontend/src/app/api/subscription/create/route.ts`, `frontend/src/app/api/subscription/verify/route.ts`, `tests/api/subscription/create-verify.test.ts`

- [ ] **Step 1: `create/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";
import { getEffectivePlan, totalCountFor } from "@/lib/services/SubscriptionService";

const PAID_TIERS = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tier, offerId } = await req.json();
  if (!PAID_TIERS.includes(tier)) return NextResponse.json({ error: "invalid tier" }, { status: 400 });

  const eff = await getEffectivePlan(session.userId);
  if (eff.tier !== "FREE") return NextResponse.json({ error: "already_subscribed" }, { status: 409 });

  const [user, plan] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: session.userId } }),
    prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier } }),
  ]);
  if (!plan.razorpayPlanId || !plan.intervalMonths || !plan.termMonths) {
    return NextResponse.json({ error: "plan not configured for payments" }, { status: 500 });
  }

  const provider = getProvider();
  const email = user.username.includes("@") ? user.username : null;
  const providerCustomerId = await provider.ensureCustomer({ id: user.id, fullName: user.fullName, email, razorpayCustomerId: user.razorpayCustomerId });
  if (providerCustomerId !== user.razorpayCustomerId) {
    await prisma.user.update({ where: { id: user.id }, data: { razorpayCustomerId: providerCustomerId } });
  }

  const totalCount = totalCountFor(plan);
  const amountPaise = Number(plan.offerPrice ?? plan.price) * 100;

  const created = await provider.createSubscription({
    userId: user.id,
    plan: { tier, providerPlanId: plan.razorpayPlanId, totalCount, amountPaise, currency: plan.currency },
    providerCustomerId,
    offerId: typeof offerId === "string" ? offerId : undefined,
    notes: { userId: user.id, tier },
  });

  await prisma.subscription.create({
    data: {
      userId: user.id,
      subscriptionPlanId: plan.id,
      provider: provider.name,
      providerSubscriptionId: created.providerSubscriptionId,
      providerPlanId: plan.razorpayPlanId,
      providerCustomerId,
      providerData: created.shortUrl ? { shortUrl: created.shortUrl } : undefined,
      status: "created",
      totalCount,
      amount: amountPaise,
      currency: plan.currency,
      offerId: typeof offerId === "string" ? offerId : null,
    },
  });

  return NextResponse.json({
    checkout: {
      provider: "razorpay",
      razorpay: { keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, subscriptionId: created.providerSubscriptionId, name: "WealthVault" },
    },
  });
}
```

- [ ] **Step 2: `verify/route.ts`**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/lib/payments";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = await req.json();
  if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const provider = getProvider();
  if (!provider.verifyCheckoutSignature({ paymentId: razorpay_payment_id, subscriptionId: razorpay_subscription_id, signature: razorpay_signature })) {
    return NextResponse.json({ error: "bad signature" }, { status: 400 });
  }

  const row = await prisma.subscription.findFirst({
    where: { providerSubscriptionId: razorpay_subscription_id, userId: session.userId },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  await prisma.subscription.update({ where: { id: row.id }, data: { status: "authenticated" } });

  // plan change: this row supersedes another → now cancel the old one
  if (row.supersedesId) {
    const old = await prisma.subscription.findUnique({ where: { id: row.supersedesId } });
    if (old && !old.cancelAtCycleEnd) {
      await provider.cancelAtCycleEnd(old.providerSubscriptionId);
      await prisma.subscription.update({ where: { id: old.id }, data: { cancelAtCycleEnd: true } });
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: `tests/api/subscription/create-verify.test.ts`** — DB integration with `PAYMENTS_PROVIDER=fake` (set `process.env.PAYMENTS_PROVIDER = "fake"` + `__resetProviderCache()` in `beforeAll`). Uses `ensureDevServer` + `fetch` to the routes with a sealed session cookie (pattern: `tests/api/dashboard/dashboard.test.ts` + `tests/helpers/session.ts`). Cases:
  - no cookie → 401
  - FREE user, `tier: "ANNUAL"` → 200, returns `checkout.razorpay.subscriptionId`, a `Subscription` row exists (`status: created`), `user.razorpayCustomerId` set
  - already-subscribed user (`createSubscriptionRow` active) → 409
  - `tier: "FREE"` or garbage → 400
  - verify with a `checkoutSignature(...)` that matches → row `authenticated`, `{ ok: true }`
  - verify with a bad signature → 400
  - verify for another user's subscription id → 404

> The dev server the tests hit must run with `PAYMENTS_PROVIDER=fake`. Add it to `tests/helpers/testServer.ts`'s spawn env (find where it starts `next dev` and add `PAYMENTS_PROVIDER: "fake"` + `RAZORPAY_KEY_SECRET` if not already inherited). Note the exact edit.

- [ ] **Step 4: Run → pass. tsc → `== BASELINE`. Commit.**

```bash
git add frontend/src/app/api/subscription/create frontend/src/app/api/subscription/verify tests/api/subscription/create-verify.test.ts tests/helpers/testServer.ts
git commit -m "$(printf 'Add subscription create + verify routes\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 10: `POST /api/subscription/cancel` + `change-plan` + `GET /api/subscription`

**Files:** `frontend/src/app/api/subscription/cancel/route.ts`, `frontend/src/app/api/subscription/change-plan/route.ts`, `frontend/src/app/api/subscription/route.ts`, `frontend/src/lib/services/SubscriptionService.ts` (append `buildManageView`), `tests/api/subscription/manage.test.ts`

- [ ] **Step 1: `cancel/route.ts`** — auth; find the user's granting sub (status in active/authenticated/pending); `provider.cancelAtCycleEnd(providerSubscriptionId)`; set `cancelAtCycleEnd: true`; return `{ ok: true, accessUntil: row.currentEnd }`. 404 if no active sub.

- [ ] **Step 2: `change-plan/route.ts`** — auth; body `{ tier }`; find current granting sub `cur`; reject 400 if `cur.subscriptionPlan.tier === tier` or not a paid tier; load target plan; `provider.createSubscription({ ..., startAt: Math.floor(cur.currentEnd.getTime()/1000) })`; insert new `Subscription` row with `supersedesId: cur.id`, `status: created`, `startAt: cur.currentEnd`; return the same `{ checkout: {...} }` shape as `create`. (The old sub is cancelled by `verify` on success — Task 9 Step 2.)

- [ ] **Step 3: `buildManageView(userId)` in `SubscriptionService.ts`**

```ts
import { formatMoney } from "@/lib/utils";

export async function buildManageView(userId: string) {
  const eff = await getEffectivePlan(userId);
  const rows = await prisma.subscription.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { subscriptionPlan: true },
  });
  const active = rows.find((r) => ["active", "authenticated", "pending"].includes(r.status)) ?? null;

  if (!active) return { tier: "FREE" as const };

  const p = active.subscriptionPlan;
  const intervalLabel = p.intervalMonths === 1 ? "month" : p.intervalMonths === 3 ? "quarter" : "year";
  const lockedThrough = new Date(active.createdAt);
  if (p.termMonths) lockedThrough.setMonth(lockedThrough.getMonth() + p.termMonths);

  return {
    tier: p.tier,
    planName: { MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }[p.tier as "MONTHLY" | "QUARTERLY" | "ANNUAL"],
    status: active.status,
    amountPerCycle: formatMoney(Math.round(active.amount / 100), active.currency),
    intervalLabel,
    nextChargeAt: active.chargeAt?.toISOString() ?? null,
    currentEnd: active.currentEnd?.toISOString() ?? null,
    priceLockedThrough: lockedThrough.toISOString(),
    cancelAtCycleEnd: active.cancelAtCycleEnd,
    paymentRetrying: eff.paymentRetrying,
    retryUrl: eff.paymentRetrying ? (active.providerData as { shortUrl?: string } | null)?.shortUrl ?? null : null,
  };
}
```

- [ ] **Step 4: `route.ts` (GET)** — auth; `return NextResponse.json(await buildManageView(session.userId))`.

- [ ] **Step 5: `tests/api/subscription/manage.test.ts`** — `buildManageView` unit-ish (with `createSubscriptionRow`): FREE → `{ tier: "FREE" }`; active ANNUAL → full view with `priceLockedThrough` ≈ createdAt + 36 months; `pending` → `paymentRetrying: true` + `retryUrl`. Cancel route: active sub → `cancelAtCycleEnd` true, provider called. Change-plan: creates a superseding row + returns checkout.

- [ ] **Step 6: Run → pass. tsc → `== BASELINE`. Commit.**

```bash
git add frontend/src/app/api/subscription/cancel frontend/src/app/api/subscription/change-plan frontend/src/app/api/subscription/route.ts frontend/src/lib/services/SubscriptionService.ts tests/api/subscription/manage.test.ts
git commit -m "$(printf 'Add subscription cancel / change-plan / GET routes + buildManageView\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 11: Register the `subscription` Jest suite

**Files:** `tests/run-tests.ts`, `run-tests.sh`

- [ ] **Step 1: `tests/run-tests.ts`** — add `"subscription"` to `Suite` and `ALL_SUITES` (after `"upgrade"`), and a `case "subscription": return runJest("api/subscription");` after the `upgrade` case.

- [ ] **Step 2: `run-tests.sh`** — append `"Subscription Tests:subscription"` to `API_SUITES=(...)`.

- [ ] **Step 3: Run** `./run-tests.sh api` → 5 API suites, all green (Auth, Unlock, Dashboard, Upgrade Prompt, Subscription).

- [ ] **Step 4: Commit.**

```bash
git add tests/run-tests.ts run-tests.sh
git commit -m "$(printf 'Register the subscription test suite\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 12: Client checkout util + wire the `UpgradeModal` CTA

**Files:** `frontend/src/lib/payments/checkout.ts`, `frontend/src/components/dashboard/UpgradeModal.tsx`

- [ ] **Step 1: `frontend/src/lib/payments/checkout.ts`**

```ts
import type { CheckoutParams } from "./types";

let scriptPromise: Promise<void> | null = null;

function loadRazorpayCheckout(): Promise<void> {
  if (typeof window !== "undefined" && (window as { Razorpay?: unknown }).Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

interface RazorpayCtor {
  new (opts: Record<string, unknown>): { open(): void };
}

/**
 * Opens the provider's checkout, resolves true once the payment is verified
 * server-side, false if the user dismisses it.
 */
export async function startCheckout(
  params: CheckoutParams,
  onVerified: (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => Promise<void>,
): Promise<boolean> {
  if (params.provider !== "razorpay" || !params.razorpay) throw new Error("unsupported checkout provider");
  await loadRazorpayCheckout();
  const RP = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
  const { keyId, subscriptionId, name } = params.razorpay;

  return new Promise<boolean>((resolve) => {
    const rzp = new RP({
      key: keyId,
      subscription_id: subscriptionId,
      name,
      handler: async (resp: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
        await onVerified(resp);
        resolve(true);
      },
      modal: { ondismiss: () => resolve(false) },
    });
    rzp.open();
  });
}
```

- [ ] **Step 2: Wire `UpgradeModal.tsx`** — the card CTA `onClick` currently does `console.info(...) + onClose()`. Replace with an async handler on each card CTA:
  - set a local `submitting` state (disable CTAs, show "Starting…")
  - `const res = await fetch("/api/subscription/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tier: p.tier }) })`
  - on non-OK → show an inline error, re-enable
  - `const { checkout } = await res.json()`
  - `const done = await startCheckout(checkout, async (r) => { await fetch("/api/subscription/verify", { method: "POST", headers: {...}, body: JSON.stringify(r) }) })`
  - if `done` → `onClose()` + call an `onSubscribed?()` prop (new optional prop) so the parent can toast + refetch `/api/auth/me`; else leave the modal open.
  - Keep it minimal — no new design, reuse existing button styles + a small disabled/spinner state.
- [ ] **Step 3: `UpgradePrompt.tsx`** — pass `onSubscribed={() => { /* toast + router.refresh() */ }}` (Next `useRouter().refresh()` re-runs the server component; the modal won't re-open because the gate now returns null for the paid tier).

- [ ] **Step 4: tsc → `== BASELINE`; `grep -E "checkout|UpgradeModal|UpgradePrompt"` → empty. Commit.**

```bash
git add frontend/src/lib/payments/checkout.ts frontend/src/components/dashboard/UpgradeModal.tsx frontend/src/components/dashboard/UpgradePrompt.tsx
git commit -m "$(printf 'Wire UpgradeModal CTAs to Razorpay Checkout (create -> checkout -> verify)\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 13: Manage Subscription screen + renewal banner + i18n

**Files:** `frontend/src/app/subscription/page.tsx`, `frontend/src/components/subscription/ManageSubscription.tsx`, `frontend/src/components/subscription/RenewalBanner.tsx`, `frontend/src/components/layout/AppShell.tsx`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/i18n/translations.ts`

- [ ] **Step 1: i18n** — add two namespaces to the `Translations` interface + all 11 locales, following the exact procedure of the upgrade-prompt plan's Task 8 (English authoritative, other 10 machine-translated with a `// TODO(i18n)` flag; preserve `{amount}` / `{date}` / `{plan}` tokens). Keys:
  - `manageSubscription`: `title`, `freeHeading`, `freeUpgradeCta`, `statusActive`, `statusPending`, `statusCancelled`, `nextCharge` ("Next charge {amount} on {date}"), `priceLocked` ("Your price is locked through {date}"), `cancelCta`, `cancelConfirmTitle`, `cancelConfirmBody` ("You'll keep {plan} until {date}, then move to Free."), `changePlanCta`, `retryCta`, `accessUntil` ("Access continues until {date}")
  - `renewalBanner`: `message` ("We couldn't process your renewal."), `action` ("Update payment →")
- [ ] **Step 2: `RenewalBanner.tsx`** (`"use client"`) — fetches `/api/auth/me`, if `paymentRetrying` renders a dismissible bar (accent-warm bg) with a link to `/subscription`. Session-dismiss via `sessionStorage`.
- [ ] **Step 3: `AppShell.tsx`** — mount `<RenewalBanner />` just inside the shell (above `<Header/>` / the `<main>`), so it shows on every authenticated page.
- [ ] **Step 4: `Sidebar.tsx`** — add a "Subscription" item to the settings popover linking to `/subscription` (match the existing popover item markup).
- [ ] **Step 5: `subscription/page.tsx`** (server) — `getSession()`, redirect to `/unlock` if no `encryptionKey`. Fetch both:
  ```ts
  const [view, prompt] = await Promise.all([
    buildManageView(session.userId),
    getUpgradePromptData(session.userId),   // returns { plans, memberCount } for a FREE user, else null
  ])
  ```
  Render `<AppShell title={t.manageSubscription.title}>`:
  - `view.tier === "FREE"` → heading (`t.manageSubscription.freeHeading`) + a `"use client"` `<OpenUpgradeModalButton plans={prompt!.plans} memberCount={prompt!.memberCount} />` — a tiny wrapper: a button that toggles a `useState` and renders `<UpgradeModal open={open} plans={...} memberCount={...} onClose={() => setOpen(false)} onSubscribed={() => router.refresh()} />`.
  - paid → `<ManageSubscription view={view} paidPlans={prompt?.plans ?? await listPaidPlansForChange()} />` — for "Change plan" the client needs the 3 paid plans' display info; if `prompt` is null (paid user), add a small `listPaidPlansForChange()` in `SubscriptionService` returning `[{ tier, name, perMonth, perCycle }]` from `SubscriptionPlan` where `tier != FREE`.
- [ ] **Step 6: `ManageSubscription.tsx`** (`"use client"`) — renders the view; **Cancel** → confirm dialog (reuse `EditModal` pattern or a simple `window.confirm` for v1) → `POST /api/subscription/cancel` → show `accessUntil` and disable; **Change plan** → a 3-option list → `POST /api/subscription/change-plan` → `startCheckout(...)` → on success toast + `router.refresh()`; **Retry** (if `paymentRetrying`) → `window.open(view.retryUrl, "_blank")`.
- [ ] **Step 7: tsc → `== BASELINE`; new files clean. Commit.**

```bash
git add frontend/src/app/subscription frontend/src/components/subscription frontend/src/components/layout/AppShell.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/i18n/translations.ts
git commit -m "$(printf 'Add Manage Subscription screen + renewal banner + i18n\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 14: Playwright e2e

**Files:** `tests/playwright.config.ts`, `tests/e2e/subscription.spec.ts`

- [ ] **Step 1: `tests/playwright.config.ts`** — add to `webServer.env`:
```ts
      PAYMENTS_PROVIDER: "fake",
      RAZORPAY_KEY_SECRET: "test_key_secret_123",
      RAZORPAY_KEY_ID: "rzp_test_e2e",
      NEXT_PUBLIC_RAZORPAY_KEY_ID: "rzp_test_e2e",
      // RAZORPAY_WEBHOOK_SECRET falls back to the fixed test value in webhookSecret.ts
```

- [ ] **Step 2: `tests/e2e/subscription.spec.ts`** — pattern of `tests/e2e/upgrade-prompt.spec.ts`.

The subscription id isn't known until `/api/subscription/create` responds, so the signature can't be pre-injected. Instead: the stub reads the id from the options Razorpay was constructed with, asks the **page** to compute the HMAC via `crypto.subtle` (SHA-256 is available in the browser), then calls the handler. Inject once per test with the key secret:

```ts
await page.addInitScript((keySecret: string) => {
  async function hmacHex(secret: string, msg: string) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
    return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  (window as unknown as { Razorpay: unknown }).Razorpay = class {
    opts: { subscription_id: string; handler: (r: unknown) => void };
    constructor(o: typeof this.opts) { this.opts = o; }
    async open() {
      const paymentId = "pay_e2e";
      const subscriptionId = this.opts.subscription_id;
      const signature = await hmacHex(keySecret, `${paymentId}|${subscriptionId}`);
      this.opts.handler({ razorpay_payment_id: paymentId, razorpay_subscription_id: subscriptionId, razorpay_signature: signature });
    }
  };
}, "test_key_secret_123");
```

(`test_key_secret_123` matches `RAZORPAY_KEY_SECRET` in `playwright.config.ts` Step 1, so the `/verify` route's `provider.verifyCheckoutSignature` — the FakeProvider, same HMAC scheme — accepts it.)

Cases:
  - FREE user → `/dashboard?wvUpgradePromptDelayMs=150` → modal → "Go Sovereign" → stub checkout fires → `/verify` 200 → modal closes. Then POST a `signedWebhook("subscription.activated", { current_end: <future unix> })` to `/api/subscription/webhook/razorpay` → reload → modal does not reappear; `/subscription` page shows "Sovereign".
  - Subscribed user → `/subscription` → "Cancel subscription" → confirm → page shows "Access continues until …".
  - Bad-signature webhook → 400 (a direct `request.post`).

- [ ] **Step 3: Run** `cd tests && npx playwright test --config playwright.config.ts subscription` → pass. Then the full `upgrade-prompt` spec still passes (prices changed in Task 6).

- [ ] **Step 4: Commit.**

```bash
git add tests/playwright.config.ts tests/e2e/subscription.spec.ts
git commit -m "$(printf 'Add subscription e2e (stubbed Razorpay checkout + signed webhook)\n\nClaude-Session: https://claude.ai/code/session_01AYKJrkWLstJJtCobh7tMaB')"
```

---

## Task 15: Full suite, manual check, wrap-up

- [ ] **Step 1:** `./run-tests.sh` → all green (API 5 suites incl. Subscription, Database, Playwright E2E incl. `subscription.spec.ts`). Note skips.
- [ ] **Step 2: Manual browser check** — `cd frontend && PAYMENTS_PROVIDER= npm run dev` with the **real** `rzp_test_` keys from `.env` (not the fake provider):
  1. Sign in as a FREE user, open `/dashboard`, wait for the modal, click a plan CTA → the **real Razorpay test Checkout** popup opens. Complete it with Razorpay's [test card / test UPI](https://razorpay.com/docs/payments/payments/test-card-details/).
  2. `/verify` succeeds → modal closes. (Webhook won't fire against localhost — either use an ngrok tunnel + a second dashboard webhook, or POST a signed `subscription.activated` yourself to confirm the tier flips.)
  3. `/subscription` shows the plan, "price locked through", Cancel, Change plan. Cancel → "access continues until". 
  4. Check dark + light.
- [ ] **Step 3:** Update `~/.claude/projects/.../memory/` — a `razorpay-subscriptions.md` project memory (status, branch, the pricing decision, the grandfather/term model, the follow-ups: FREE-gating then coupons; live-mode checklist). Add the MEMORY.md pointer.
- [ ] **Step 4:** Tick this plan's checkboxes; commit the plan.
- [ ] **Step 5:** Report: branch ready for review; what ran vs skipped; the go-live checklist (activate Subscriptions product, set `RAZORPAY_WEBHOOK_SECRET`, create the webhook pointing at prod, switch to live keys + re-create Plans, verify §14 open items).

---

## Self-review notes (checked against the spec)

- **§4 data model** → Task 1 (all columns + both new models + migration + seed + test-helper). ✅
- **§4.6 `getEffectivePlan` + lazy reconciliation** → Task 5, with the status×date matrix + the reconciliation test. ✅
- **§5 provider abstraction** → Tasks 2–4 (`types.ts`, `RazorpayProvider` w/ HMAC + normalise, `FakeProvider`, `getProvider` + `PAYMENTS_PROVIDER=fake`). ✅
- **§6 subscribe flow** → Task 9 (`create` + `verify`, incl. supersedes-cancel), Task 12 (`startCheckout` + modal wiring). ✅
- **§7 webhooks & lifecycle** → Task 8 (`applySubscriptionEvent` + route + middleware + dedupe + per-event tests). ✅
- **§8 cancel / change-plan / retry** → Task 10 (`cancel`, `change-plan`), Task 13 (Retry button → `retryUrl`). ✅
- **§9 Manage screen** → Task 10 (`buildManageView` + GET), Task 13 (page + `ManageSubscription` + `RenewalBanner` + sidebar link). ✅
- **§10 middleware / env / deps** → Task 8 (middleware), Task 2 (`razorpay` dep + webhook-secret helper), Task 1/9/14 (env). ✅
- **§11 file list** → every new/modified file has a task. ✅
- **§12 testing** → unit (Tasks 3, 5, 6), integration (Tasks 8, 9, 10), e2e (Task 14), suite registration (Task 11), tsc re-baseline (Task 1). ✅
- **§13 out of scope** — no task adds coupons UI/table, FREE-gating enforcement, billing history, proration, or dunning email. The `offerId` param is passed through `create` (Task 9) with no resolver. ✅
- **§14 open items** — Task 3 note (SDK `cancel` arg shape), Task 8/14 (which event fires on deferred activation — the `getEffectivePlan` recompute is written to be resilient), Task 9 (`ensureCustomer` without email — handled: `email = null` for X handles, passed conditionally), Task 8 (rawBody via `req.text()`). Task 15 Step 5 lists the go-live checklist. ✅
- **Type consistency:** `PaymentProvider` / `NormalizedWebhookEvent` / `CheckoutParams` defined in Task 2, implemented in Tasks 3–4, consumed unchanged in Tasks 8–10, 12. `getEffectivePlan` / `totalCountFor` (Task 5) used in Tasks 6, 7, 8, 9, 10. `createSubscriptionRow` (Task 5) used in Tasks 5, 8, 9, 10, 14. `signedWebhook` / `checkoutSignature` (Task 4) used in Tasks 8, 9, 14. ✅
- **Deviation:** the plan folds `applySubscriptionEvent` and `buildManageView` into `SubscriptionService.ts` across Tasks 5/8/10 (appends) rather than one task — keeps each task's test focused.

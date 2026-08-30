# Razorpay Recurring Subscriptions — Design

**Date:** 2026-08-30
**Status:** Approved for planning
**Depends on:** the dashboard upgrade prompt (merged — `docs/superpowers/specs/2026-08-30-dashboard-upgrade-prompt-design.md`). This wires real payment behind the modal's CTAs, which are currently presentational.
**Followed by (separate specs):** (1) FREE-tier data gating — when `tier == FREE`, list/dashboard responses cap each category at N rows, nothing deleted; (2) Coupon system — a `coupons` table + "Have a coupon?" field resolving a code to a Razorpay `offer_id`.

---

## 1. Summary

Let a `FREE`-tier user subscribe to a paid plan (Reserve / Treasury / Sovereign) via **Razorpay Subscriptions** (recurring, auto-renew). The plan they pick maps to a Razorpay Plan with a fixed interval (1 / 3 / 12 months) and a fixed amount that is **grandfathered for a 3-year term** — the price they subscribe at recurs unchanged for the whole term, then the subscription completes, the user drops to `FREE`, and the upgrade prompt returns so they can re-subscribe at then-current prices.

Access (the user's effective tier) is driven by webhooks + a computed `getEffectivePlan` helper — no cron. Cancellation is at cycle end (access continues to the paid-through date). Plan changes are supported (new plan starts when the current one ends). A minimal **Manage Subscription** screen exposes status / next charge / price-locked-through / cancel / change-plan / retry.

The payment layer is structured behind a `PaymentProvider` interface with `RazorpayProvider` as the only implementation, so a second provider later is additive.

---

## 2. Locked decisions (from brainstorming)

| # | Decision |
|---|---|
| Billing model | Razorpay **Subscriptions** (recurring mandate), not one-time orders |
| Plan → interval | 3 Razorpay Plans: Reserve = 1 month, Treasury = 3 months, Sovereign = 12 months; auto-renews at its own cadence |
| Grandfathering | The **effective price at subscribe time recurs unchanged for the whole term** (bound to the Razorpay Plan the subscription was created against) |
| Term | **3 years**, per-plan tunable via `SubscriptionPlan.termMonths` (default 36). `total_count = termMonths / intervalMonths` → Reserve 36, Treasury 12, Sovereign 3. On completion → `FREE` → modal returns |
| Razorpay Plan management | **Pre-created in the Razorpay dashboard**; IDs stored on `SubscriptionPlan.razorpayPlanId` (seeded from env). Price change = new Plan + repoint; existing subscribers unaffected |
| Cancellation | **At cycle end** — access until paid-through date, then `FREE`. Plus a minimal Manage Subscription screen |
| Plan switching | **In-app** — create + authorise the new plan first (deferred `start_at` = current `currentEnd`), then cancel the old on successful verify |
| Failed renewal | **Grace during Razorpay's retry window** (`pending`): keep access + show a banner; drop to `FREE` only on `halted` |
| Coupons | v1 wires an optional `offerId` param through `subscriptions.create`; **no coupon table / UI yet** |
| Provider extensibility | Provider-neutral `Subscription` columns + a `PaymentProvider` interface + per-provider webhook route. No multi-provider plan catalog / capability negotiation |

---

## 3. Pricing

**List price** (long-term, what you'll charge once the intro period ends):

| Tier | Interval | Per-month | Charged per cycle | `SubscriptionPlan.price` |
|---|---|---|---|---|
| Reserve | 1 month | ₹9,000 | ₹9,000 | `9000` |
| Treasury | 3 months | ₹6,000 | ₹18,000 | `18000` |
| Sovereign | 12 months | ₹3,000 | ₹36,000 | `36000` |

**Intro price — 60% off — what the 3 live Razorpay Plans charge NOW** and what `SubscriptionPlan.offerPrice` holds:

| Tier | Charged per cycle | `offerPrice` | Paise (Razorpay Plan) |
|---|---|---|---|
| Reserve | ₹3,600 / month | `3600` | 360000 |
| Treasury | ₹7,200 / 3 months | `7200` | 720000 |
| Sovereign | ₹14,400 / year | `14400` | 1440000 |

`price` / `offerPrice` are **per billing cycle, whole INR** (changed from the upgrade-prompt spec where QUARTERLY/ANNUAL were also per-cycle — the numbers change, the unit doesn't). The "/mo" figure the modal shows = `effectivePerCycle / intervalMonths`.

`FREE`: `price = 0`, `offerPrice = null`, `intervalMonths = null`, `termMonths = null`, `razorpayPlanId = null`.

The launch-offer window (`offerStartDate` / `offerEndDate`) drives only the **displayed** price + "60% off · ends …" text. Whatever `razorpayPlanId` is set is what actually gets charged.

---

## 4. Data model

Migration via `prisma migrate dev` against `frontend/prisma/schema.prisma` (the 4-model schema).

### 4.1 `SubscriptionPlan` — add 3 nullable columns

```prisma
model SubscriptionPlan {
  // ... existing: id, tier, price, offerPrice, currency, offerStartDate, offerEndDate, isActive, createdAt, updatedAt
  razorpayPlanId  String?  // Razorpay Plan new subscribers are created against; repoint on price change
  intervalMonths  Int?     // 1 / 3 / 12 (null for FREE)
  termMonths      Int?     @default(36)  // grandfather term (null for FREE)
  subscriptions   Subscription[]
}
```

### 4.2 `User` — add

```prisma
razorpayCustomerId String?   // created on first subscribe
subscriptions      Subscription[]
```

### 4.3 New `Subscription` model — one row per provider subscription

```prisma
model Subscription {
  id                     String   @id @default(uuid())
  userId                 String
  user                   User     @relation(fields: [userId], references: [id])
  subscriptionPlanId     String
  subscriptionPlan       SubscriptionPlan @relation(fields: [subscriptionPlanId], references: [id])

  provider               String   @default("razorpay")
  providerSubscriptionId String   @unique
  providerPlanId         String   // the plan the sub is bound to — the grandfather anchor, never repointed
  providerCustomerId     String?
  providerData           Json?    // provider-specific extras (e.g. short_url)

  // status mirrors the provider's subscription status, normalised:
  //   created | authenticated | active | pending | halted | cancelled | completed | expired
  status                 String   @default("created")
  totalCount             Int
  paidCount              Int      @default(0)
  currentStart           DateTime?
  currentEnd             DateTime?  // paid-through date — access is valid until here
  chargeAt               DateTime?
  startAt                DateTime?  // set for a scheduled (plan-change) subscription
  endedAt                DateTime?
  cancelAtCycleEnd       Boolean  @default(false)

  amount                 Int      // paise per cycle, snapshot for display
  currency               String   @default("INR")
  offerId                String?  // provider offer applied at create time, if any
  supersedesId           String?  // id of the Subscription this one replaces (plan change)

  createdAt              DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([userId])
  @@map("subscriptions")
}
```

### 4.4 New `ProcessedWebhookEvent` model — idempotency

```prisma
model ProcessedWebhookEvent {
  id        String   @id @default(uuid())
  provider  String
  eventId   String   @unique   // provider's event id
  createdAt DateTime @default(now())

  @@map("processed_webhook_events")
}
```

### 4.5 `SubscriptionPeriod` — unchanged

Still the append-only audit log. Webhook handlers call the existing `logSubscriptionPeriodIfChanged(userId, planId)` whenever the effective tier changes.

### 4.6 `getEffectivePlan(userId): Promise<{ tier, subscriptionPlanId, currentEnd, paymentRetrying }>`

New helper in `frontend/src/lib/services/SubscriptionService.ts` (see §11). Pure-ish (one indexed query). The **source of truth for access**; `User.subscriptionPlanId` is a denormalised cache kept ~current by webhooks.

```
rows = Subscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
now  = new Date()

A subscription row "grants access" when:
  status in ('active', 'authenticated')                         → yes
  status == 'pending'                                            → yes (grace),  paymentRetrying = true
  status in ('cancelled', 'completed') AND currentEnd AND now < currentEnd  → yes
  otherwise                                                      → no

effective = the granting row with the latest currentEnd (or, for active/authenticated
            with null currentEnd, treat as granting "now")
if none grant → FREE plan
```

**Lazy reconciliation:** when `getEffectivePlan` computes an effective tier that differs from `User.subscriptionPlanId`, it updates `User.subscriptionPlanId` and calls `logSubscriptionPeriodIfChanged`. This is how a `cancelled`/`completed` sub whose `currentEnd` has passed flips the user to `FREE` without a cron — the next read of `getEffectivePlan` (from `/api/auth/me`, the dashboard page, or the future gating layer) does it.

Callers: `frontend/src/app/api/auth/me/route.ts` (return `subscription` from `getEffectivePlan`, not the raw relation), `frontend/src/app/dashboard/page.tsx` (the upgrade-prompt FREE gate — via `getUpgradePromptData`, which should call `getEffectivePlan`), `GET /api/subscription`.

---

## 5. Provider abstraction

### 5.1 `frontend/src/lib/payments/types.ts`

```ts
export type ProviderName = "razorpay";

export interface CreateSubscriptionInput {
  userId: string;
  plan: { tier: string; providerPlanId: string; totalCount: number; amountPaise: number; currency: string };
  providerCustomerId: string;
  startAt?: number;       // unix seconds — for a scheduled plan change
  offerId?: string;       // pass-through; no coupon table in v1
  notes: Record<string, string>;
}

export interface CreatedSubscription {
  providerSubscriptionId: string;
  status: string;                 // normalised
  shortUrl?: string;
  raw: unknown;
}

/** What the client needs to open the provider's checkout. */
export interface CheckoutParams {
  provider: ProviderName;
  razorpay?: { keyId: string; subscriptionId: string; name: string };
}

export interface NormalizedWebhookEvent {
  kind:
    | "authenticated" | "activated" | "charged" | "pending"
    | "halted" | "cancelled" | "completed" | "updated" | "ignored";
  eventId: string;
  providerSubscriptionId: string;
  status: string;                 // normalised subscription status
  paidCount?: number;
  currentStart?: Date | null;
  currentEnd?: Date | null;
  chargeAt?: Date | null;
  cancelAtCycleEnd?: boolean;
  providerPlanId?: string;
}

export interface PaymentProvider {
  readonly name: ProviderName;
  ensureCustomer(user: { id: string; fullName: string; email: string; razorpayCustomerId: string | null }): Promise<string>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreatedSubscription>;
  verifyCheckoutSignature(p: { paymentId: string; subscriptionId: string; signature: string }): boolean;
  verifyWebhookSignature(rawBody: string, signatureHeader: string): boolean;
  normalizeWebhookEvent(rawBody: string): NormalizedWebhookEvent;
  cancelAtCycleEnd(providerSubscriptionId: string): Promise<void>;
  fetchSubscription(providerSubscriptionId: string): Promise<{ status: string; currentEnd: Date | null; shortUrl?: string }>;
}
```

### 5.2 `frontend/src/lib/payments/razorpay.ts` — `RazorpayProvider implements PaymentProvider`

- Wraps the `razorpay` Node SDK (`new Razorpay({ key_id, key_secret })`), server-only.
- `verifyCheckoutSignature`: `hmac_sha256(paymentId + "|" + subscriptionId, KEY_SECRET) === signature` (timing-safe compare).
- `verifyWebhookSignature`: `hmac_sha256(rawBody, RAZORPAY_WEBHOOK_SECRET) === signatureHeader` (timing-safe).
- `normalizeWebhookEvent`: `JSON.parse(rawBody)`, switch on `event`, pull `payload.subscription.entity` (`id`, `status`, `paid_count`, `current_start`, `current_end`, `charge_at`, `plan_id`, `has_scheduled_changes`). Unknown events → `kind: "ignored"`.
- `createSubscription`: `subscriptions.create({ plan_id, total_count, quantity: 1, customer_notify: 1, start_at?, offer_id?, notes })`.
- `cancelAtCycleEnd`: `subscriptions.cancel(id, { cancel_at_cycle_end: 1 })`.

### 5.3 `frontend/src/lib/payments/index.ts`

```ts
export function getProvider(name: ProviderName = "razorpay"): PaymentProvider { ... }
```

API routes call `getProvider(sub.provider)` — never the SDK directly. When
`process.env.PAYMENTS_PROVIDER === "fake"` (set only by the test / e2e env),
`getProvider` returns the deterministic `FakeProvider` (see §12) instead of
`RazorpayProvider` — so the real Razorpay SDK is never called from tests, and
the e2e run against `next dev` exercises the full route + DB + webhook path with
predictable data.

---

## 6. Subscribe flow

### 6.1 `POST /api/subscription/create` — auth (session + unlocked)

Body: `{ tier: "MONTHLY" | "QUARTERLY" | "ANNUAL", offerId?: string }`

1. `getEffectivePlan(userId)` — if not `FREE`, return `409 { error: "already_subscribed" }`.
2. Load `SubscriptionPlan` by tier; require `razorpayPlanId`, `intervalMonths`, `termMonths`. `totalCount = termMonths / intervalMonths`. `amountPaise = Number(offerPrice ?? price) * 100` — this is **only a display snapshot** on the `Subscription` row; the actual charge is fixed by the Razorpay Plan (`razorpayPlanId`). It should equal the Plan's amount — the seed keeps `offerPrice` and the Razorpay Plan in step; if they ever drift, prefer reading the amount back from `provider.createSubscription`'s response.
3. `providerCustomerId = await provider.ensureCustomer(user)` → persist `user.razorpayCustomerId` if newly created. Email = `user.username` when it contains `@`, else omit (X handles have no email — Razorpay customer can be created without email).
4. `created = await provider.createSubscription({ ..., notes: { userId, tier }, offerId })`.
5. Insert `Subscription` row: `provider`, `providerSubscriptionId`, `providerPlanId = razorpayPlanId`, `providerCustomerId`, `status = created`, `totalCount`, `amount = amountPaise`, `currency`, `offerId`, `subscriptionPlanId`.
6. Return `{ checkout: { provider: "razorpay", razorpay: { keyId: NEXT_PUBLIC_RAZORPAY_KEY_ID, subscriptionId, name: "WealthVault" } } }`.

### 6.2 Client (`UpgradeModal` CTA)

- Replace the placeholder `console.info(...) + onClose()` with: `POST /api/subscription/create { tier }` → `startCheckout(res.checkout)`.
- `frontend/src/lib/payments/checkout.ts` `startCheckout(params)`:
  - `provider === "razorpay"`: ensure `checkout.js` is loaded (a `loadRazorpayCheckout()` that injects `<script src="https://checkout.razorpay.com/v1/checkout.js">` once, resolves on load), then `new window.Razorpay({ key: keyId, subscription_id: subscriptionId, name, handler, modal: { ondismiss } }).open()`.
  - `handler(response)` → `POST /api/subscription/verify` → on `{ ok: true }` resolve; caller closes the modal, shows a toast ("Subscription activating — this can take a few seconds"), and refetches `/api/auth/me`.
  - `ondismiss` → reject/no-op; modal stays open.
- `checkout.js` from `checkout.razorpay.com` — no CSP in the app today, so no allowlist change; note it for when a CSP is added.

### 6.3 `POST /api/subscription/verify` — auth

Body: `{ razorpay_payment_id, razorpay_subscription_id, razorpay_signature }`

1. `provider.verifyCheckoutSignature(...)` → `400` on mismatch.
2. Find the `Subscription` by `providerSubscriptionId` **and** `userId` (ownership) → `404` if not found.
3. Set `status = "authenticated"` (optimistic; the webhook confirms `active`).
4. **If this row has `supersedesId`** (a plan change): now cancel the superseded subscription — `provider.cancelAtCycleEnd(oldRow.providerSubscriptionId)`, set `oldRow.cancelAtCycleEnd = true`.
5. Return `{ ok: true }`.

---

## 7. Webhooks & lifecycle

### 7.1 `POST /api/subscription/webhook/[provider]` — PUBLIC

- Middleware: add `/api/subscription/webhook` (prefix) to the public allowlist.
- Read the **raw** body (Next: `await req.text()`), not parsed — signature is over raw bytes.
- `provider.verifyWebhookSignature(rawBody, req.headers["x-razorpay-signature"])` → `400` on mismatch.
- `evt = provider.normalizeWebhookEvent(rawBody)`.
- Idempotency: `ProcessedWebhookEvent.create({ provider, eventId: evt.eventId })` inside a try/catch on the unique constraint — if it already exists, return `200` (already handled).
- `await applySubscriptionEvent(evt)`.
- Return `200` quickly (Razorpay retries non-2xx).

### 7.2 `applySubscriptionEvent(evt)` — `frontend/src/lib/services/SubscriptionService.ts`

```
row = Subscription.findUnique({ where: { providerSubscriptionId: evt.providerSubscriptionId } })
if (!row) return            // unknown sub — log + ignore

update row:
  status           = evt.status
  paidCount        = evt.paidCount ?? row.paidCount           // absolute, idempotent
  currentStart     = evt.currentStart ?? row.currentStart
  currentEnd       = evt.currentEnd ?? row.currentEnd
  chargeAt         = evt.chargeAt ?? row.chargeAt
  cancelAtCycleEnd = evt.cancelAtCycleEnd ?? row.cancelAtCycleEnd
  endedAt          = (status in halted/completed/expired) ? now : row.endedAt

eff = getEffectivePlan(row.userId)     // recomputes across ALL the user's rows
if (eff.subscriptionPlanId !== user.subscriptionPlanId):
  user.update({ subscriptionPlanId: eff.subscriptionPlanId })
  logSubscriptionPeriodIfChanged(row.userId, eff.subscriptionPlanId)
```

| Razorpay `event` | normalized `kind` / `status` | notes |
|---|---|---|
| `subscription.authenticated` | authenticated | mandate approved, first charge pending |
| `subscription.activated` | activated / active | first successful charge; `currentStart/End` set |
| `subscription.charged` | charged / active | renewal; absolute `paid_count` / `current_end` |
| `subscription.pending` | pending / pending | a charge failed, Razorpay retrying → `paymentRetrying` |
| `subscription.halted` | halted / halted | retries exhausted → access ends |
| `subscription.cancelled` | cancelled / cancelled | if `cancel_at_cycle_end`, `current_end` stays in the future |
| `subscription.completed` | completed / completed | `total_count` reached (3-year term) |
| `subscription.updated` | updated / (unchanged) | scheduled plan change applied |
| anything else | ignored | `200`, no-op |

### 7.3 Term completion

`subscription.completed` → status `completed`, `endedAt` now, `currentEnd` unchanged → access continues until `currentEnd` → the next `getEffectivePlan` read after `currentEnd` flips the user to `FREE` + logs a period → the upgrade modal reappears on the dashboard → a fresh subscribe creates a new `Subscription` row against whatever `razorpayPlanId` is set then (new grandfather anchor).

---

## 8. Cancel / change-plan / retry

### 8.1 `POST /api/subscription/cancel` — auth

- Find the user's active/authenticated/pending `Subscription`. `provider.cancelAtCycleEnd(providerSubscriptionId)`. Set `row.cancelAtCycleEnd = true` (status stays until the `subscription.cancelled` webhook). Return `{ ok: true, accessUntil: row.currentEnd }`.

### 8.2 `POST /api/subscription/change-plan` — auth

Body: `{ tier }`.

1. Find current active sub `cur`. Reject if `cur.tier === tier`.
2. Load target `SubscriptionPlan`. `provider.createSubscription({ ..., startAt: unixSeconds(cur.currentEnd) })` → new row, `supersedesId = cur.id`, `status = created`, `startAt = cur.currentEnd`.
3. Return `{ checkout: {...} }` — client runs Checkout again (a **new mandate authorisation** is required; the first charge is deferred to `startAt`).
4. `/api/subscription/verify` for the new sub → on success, cancels `cur` at cycle end (§6.3 step 4). So if the user abandons the new mandate, `cur` keeps running.
5. Webhooks: `cur` → `completed` at its `currentEnd`, new → `authenticated` then `activated` at `startAt`. `getEffectivePlan` returns the new tier once the old lapses.

### 8.3 Retry (pending)

Manage screen shows a **Retry payment** button when `status === 'pending'` → links to the subscription's Razorpay `short_url` (from `providerData` / `provider.fetchSubscription`). Razorpay handles the retry UI + its own reminder emails.

---

## 9. Manage Subscription screen

### 9.1 `GET /api/subscription` — auth

Returns:
```jsonc
{
  "tier": "ANNUAL" | "FREE" | ...,
  "status": "active" | "pending" | "cancelled" | "completed" | null,
  "planName": "Sovereign",
  "amountPerCycle": "₹14,400",            // formatted, from Subscription.amount
  "intervalLabel": "year",
  "nextChargeAt": "2027-08-30T…" | null,
  "priceLockedThrough": "2029-08-30T…" | null,   // subscribe date + termMonths
  "cancelAtCycleEnd": true | false,
  "paymentRetrying": true | false,
  "retryUrl": "https://rzp.io/i/…" | null
}
```

### 9.2 Page — `frontend/src/app/subscription/page.tsx` (server) + a small client section

- Authenticated + vault-unlocked (matches the app shell). Add a link in the sidebar settings popover ("Subscription").
- **FREE:** "You're on the Free plan." + a button that opens the `UpgradeModal` directly (reuse the component with `open` forced; a lightweight wrapper).
- **Paid:** plan name + status badge; "Next charge **₹X** on **`<date>`**"; "Your price is locked through **`<date>`**"; buttons **Change plan** (opens a 3-option picker → `POST /api/subscription/change-plan` → Checkout), **Cancel subscription** (confirm dialog → `POST /api/subscription/cancel` → "Access continues until `<date>`"), and **Retry payment** when `paymentRetrying`.
- A **dismissible AppShell banner** when `paymentRetrying` on any authenticated page: "We couldn't process your renewal. Retry →" linking to `/subscription`.

---

## 10. Middleware, env, dependencies

- **Middleware** (`frontend/src/middleware.ts`): add to the "Always public" list — `pathname.startsWith("/api/subscription/webhook")`. All other `/api/subscription/*` fall through to the existing session + `encryptionKey` checks.
- **Env** (`frontend/.env`, already added except the webhook secret):
  `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_WEBHOOK_SECRET` (set after creating the webhook), `RAZORPAY_PLAN_ID_MONTHLY`, `RAZORPAY_PLAN_ID_QUARTERLY`, `RAZORPAY_PLAN_ID_ANNUAL`.
  Same keys must be added to `tests/` env resolution if any test needs them (the provider is mocked in tests — see §12 — so only the webhook-secret HMAC vectors need a fixed secret; use a test constant, not the real env).
- **Dependency:** `razorpay` (Node SDK) in `frontend/package.json` — server-only import, guarded so it never reaches the client bundle. Pin an exact version in the plan (`~2.9`).
- **`checkout.js`:** loaded lazily from `https://checkout.razorpay.com/v1/checkout.js` by `startCheckout`. No CSP today; note for later.

---

## 11. Files

### New

| File | Responsibility |
|---|---|
| `frontend/src/lib/payments/types.ts` | `PaymentProvider` interface + DTOs |
| `frontend/src/lib/payments/razorpay.ts` | `RazorpayProvider` — SDK wrapper, HMAC verify, event normalisation |
| `frontend/src/lib/payments/index.ts` | `getProvider(name)` registry |
| `frontend/src/lib/payments/checkout.ts` | client `startCheckout()` + `loadRazorpayCheckout()` |
| `frontend/src/lib/services/SubscriptionService.ts` | `getEffectivePlan`, `applySubscriptionEvent`, `totalCountFor`, `buildManageView` |
| `frontend/src/app/api/subscription/create/route.ts` | POST — create Razorpay subscription |
| `frontend/src/app/api/subscription/verify/route.ts` | POST — verify checkout signature, mark authenticated, cancel superseded |
| `frontend/src/app/api/subscription/cancel/route.ts` | POST — cancel at cycle end |
| `frontend/src/app/api/subscription/change-plan/route.ts` | POST — schedule a plan change |
| `frontend/src/app/api/subscription/route.ts` | GET — Manage screen data |
| `frontend/src/app/api/subscription/webhook/[provider]/route.ts` | POST (public) — verify + dispatch |
| `frontend/src/app/subscription/page.tsx` | Manage Subscription screen |
| `frontend/src/components/subscription/ManageSubscription.tsx` | client section of the screen |
| `frontend/src/components/subscription/RenewalBanner.tsx` | AppShell "retry" banner |
| `frontend/prisma/migrations/*` | the schema migration |
| `tests/api/subscription/*.test.ts` | unit + integration (new `subscription` jest suite) |
| `tests/e2e/subscription.spec.ts` | e2e with a stubbed `window.Razorpay` |

### Modified

| File | Change |
|---|---|
| `frontend/prisma/schema.prisma` | `SubscriptionPlan` +3 cols, `User` +2, new `Subscription` + `ProcessedWebhookEvent` |
| `frontend/prisma/seed.ts` | `SubscriptionPlan` rows: new `price` / `offerPrice` (§3), `intervalMonths`, `termMonths`, `razorpayPlanId` from `RAZORPAY_PLAN_ID_*` env |
| `frontend/src/lib/services/UpgradePromptService.ts` | `buildPlanCardView` reads `intervalMonths` + per-cycle `price`/`offerPrice` from the DB (drop the hardcoded `BILLING_MONTHS` map); `getUpgradePromptData` gates on `getEffectivePlan` |
| `frontend/src/components/dashboard/UpgradeModal.tsx` | CTA → `POST /api/subscription/create` → `startCheckout`; success/dismiss handling; a small "activating…" state |
| `frontend/src/app/api/auth/me/route.ts` | `subscription` field from `getEffectivePlan`, not the raw relation |
| `frontend/src/middleware.ts` | `/api/subscription/webhook` public |
| `frontend/src/components/layout/AppShell.tsx` (or Sidebar) | mount `RenewalBanner`; add a "Subscription" settings link |
| `frontend/src/i18n/translations.ts` | new `manageSubscription` + `renewalBanner` keys × 11 locales (flag AI translations) |
| `frontend/package.json` | `razorpay` dependency |
| `tests/helpers/seedReferenceData.ts` | match the new `SubscriptionPlan` shape (interval/term/price per cycle); add `razorpayPlanId` test values |
| `tests/helpers/testUser.ts` | optional `subscription` factory helper (create a `Subscription` row in a given status) |
| `tests/run-tests.ts`, `run-tests.sh` | register the `subscription` suite |

---

## 12. Testing

**tsc baseline:** the frontend has ~89 pre-existing `tsc` errors (stale Prisma client vs the reduced schema — see the upgrade-prompt spec). The Prisma migration **regenerates the client**, so the count will change — re-baseline after the migration task and use "count does not increase / feature files clean" thereafter. `next build` still not run; e2e is the runtime gate.

### Unit (`tests/api/subscription/`, pure — no DB)

- `getEffectivePlan` — a matrix over `(status, currentEnd relative to now, multiple rows incl. a superseding row)` → expected tier + `paymentRetrying`. **The critical test.**
- `RazorpayProvider.verifyCheckoutSignature` / `verifyWebhookSignature` — fixed secret + known payloads → known HMAC (compute the expected value in the test).
- `RazorpayProvider.normalizeWebhookEvent` — one fixture per Razorpay event (`authenticated`/`activated`/`charged`/`pending`/`halted`/`cancelled`/`completed`/`updated`/unknown) → expected `NormalizedWebhookEvent`.
- `totalCountFor({ termMonths, intervalMonths })` → 36 / 12 / 3; guards for null.

### Integration (`tests/api/subscription/`, test DB, **mocked `PaymentProvider`**)

A `FakeProvider` implementing `PaymentProvider` deterministically. `getProvider` is injectable (module-level override for tests, mirroring how `SubscriptionPeriodService` tests lazy-`require`).

- `POST /api/subscription/create`: FREE user → row created, provider called with `plan_id`/`total_count`/`notes`; returns checkout params. Non-FREE user → `409`. Unauthed → `401`.
- `POST /api/subscription/verify`: good signature → status `authenticated`; bad → `400`; wrong user → `404`; with `supersedesId` → old sub cancelled.
- `applySubscriptionEvent` for each `kind`: row fields updated; `User.subscriptionPlanId` + `SubscriptionPeriod` follow `getEffectivePlan`; `pending` keeps tier; `halted` → FREE; `cancelled` at cycle end keeps tier until `currentEnd`.
- Webhook route: missing/invalid signature → `400`; valid → processed; **duplicate `eventId` → `200`, no double-apply** (assert `paidCount` unchanged, no extra period row).
- `cancel` / `change-plan`: provider called correctly; rows/flags set.

### E2E (`tests/e2e/subscription.spec.ts`)

- `page.addInitScript` injects a stub `window.Razorpay` whose `.open()` immediately invokes `options.handler({ razorpay_payment_id, razorpay_subscription_id, razorpay_signature })` with values the **test server accepts** (the e2e run uses a known `RAZORPAY_KEY_SECRET` test constant so `verifyCheckoutSignature` passes; the create route in e2e uses the `FakeProvider`).
- FREE user → dashboard → modal (`?wvUpgradePromptDelayMs=150`) → "Go Sovereign" → stubbed checkout → `/verify` → toast. Then POST a crafted `subscription.activated` to the webhook route (signed with the test secret) → reload → `/api/auth/me` shows `ANNUAL` and the modal no longer appears.
- `/subscription` page: subscribed user sees plan + "Cancel" → confirm → `cancelAtCycleEnd` reflected.
- Register `subscription` in `run-tests.ts` (`runJest("api/subscription")`) and `run-tests.sh` (`API_SUITES` + a "Subscription Tests" entry).

---

## 13. Out of scope / follow-ups

- **FREE-tier data gating** — separate spec (the immediate next one). This spec only produces the correct `tier` + `currentEnd`.
- **Coupon system** — the `offerId` param is wired through `create`; the `coupons` table, "Have a coupon?" field, redemption limits, and admin are a later spec.
- Billing history / invoice / GST screen (Razorpay emails invoices; a screen is later).
- Proration, immediate mid-cycle upgrades (change-plan is deferred-start only).
- Dunning / reminder emails (Razorpay does its own; we only surface a banner).
- Live-mode go-live: KYC, live keys, re-create the 3 Plans in live mode, point the webhook at production. Documented checklist, not built.
- An admin UI to edit `SubscriptionPlan` pricing / `razorpayPlanId` (SQL / seed edit for now).
- **Checkout loading-state polish** (found in Task 12 review): while one plan's checkout is submitting, all 3 CTAs disable but only the clicked one relabels to "Starting…" — the other two just dim with no shared cue, which can read as "the modal froze" rather than "something is loading elsewhere." Non-blocking; a shared status line or a spinner on the active button would read more clearly. Also noted: neither the loading nor the error state uses `aria-busy`/`aria-live`/`role="alert"` — matches this codebase's existing convention (`unlock/page.tsx` has the same gap), so not a regression, but worth a joint a11y pass across both flows later.

---

## 14. Risks / open items

- **Razorpay Subscriptions product activation** — must be enabled on the account (test mode usually is; confirm). Not blocking the build.
- **`subscription.updated` semantics for scheduled plan changes** — confirm against live Razorpay behaviour during implementation which event fires when a deferred `start_at` sub activates and when the superseded one completes; the `getEffectivePlan` recompute is written to be resilient either way.
- **`ensureCustomer` without email** (X-handle users) — confirm Razorpay allows a customer + subscription with no email; if not, prompt those users for an email at subscribe time (small addition).
- **Webhook rawBody in Next 14 App Router** — `await req.text()` before any `req.json()`; the route must not use a body parser. Verify the signature header casing (`x-razorpay-signature`).
- **Clock skew on `getEffectivePlan`** — `currentEnd` comparisons use server time; a few minutes' skew around expiry is acceptable (access granted slightly longer, never shorter).
- **The upgrade-prompt e2e** already asserts prices; changing `SubscriptionPlan.price` units/values (§3) will move those — update `tests/e2e/upgrade-prompt.spec.ts` and `plan-card-view.test.ts` fixtures in the same change (they were written to be offer-window-independent but not price-value-independent).
- **`POST /api/subscription/create` double-submit race** (found in Task 9 review): the `getEffectivePlan` FREE-check and the `Subscription` insert aren't atomic — two concurrent requests can both read FREE and both create a real Razorpay subscription. Low likelihood of actual harm (a lingering `created`-status row grants no access; genuine double-billing needs the user to complete two separate checkout popups) and Task 12's client-side submit-disable narrows it further, but **fix before production go-live**: wrap the check+insert in `prisma.$transaction` with a Postgres advisory lock keyed on `userId` (`pg_advisory_xact_lock(hashtext($1))`) — not a partial unique index, since this repo has no `prisma/migrations/` (uses `db push`) and a raw-SQL index would be fragile to keep across pushes.
- **`/verify`'s supersede-cancel concurrent-call TOCTOU** (found in Task 9 review): two truly simultaneous `/verify` calls for the same new-plan subscription could both read the old subscription's `cancelAtCycleEnd: false` and both call `provider.cancelAtCycleEnd`. Low probability (needs concurrent, not just sequential, double-fire) and low blast radius (idempotent "set desired state" call) — but confirm Razorpay's real API tolerates a duplicate `cancel(id, true)` call before relying on it in production; `FakeProvider`'s no-op can't surface a problem here.
- **`POST /api/subscription/change-plan` double-submit race** (found in Task 10 review — same shape as Task 9's `create` race, worse blast radius here): two concurrent `change-plan` calls both read the same current subscription `cur` and both create a real, independently-live superseding Razorpay subscription. Unlike the `create` race, a lingering duplicate here isn't harmless — if the user completes both checkout popups, one of the two new subscriptions is never cancelled by anything (`verify`'s supersede-cancel only targets `cur`, and only one of the two new rows can ever be "the" chosen one in `getEffectivePlan`/`buildManageView`), leaving an orphaned, still-billing Razorpay subscription the user has no way to see or cancel from the app. **Fix with the same mechanism recommended for the `create` race** (Postgres advisory lock via `pg_advisory_xact_lock(hashtext(userId))` wrapping the check+insert) before production go-live — do both races in one pass, since the fix is identical.
- **`ManageSubscription.tsx` duplicated tier→name map** (found in Task 13 code-quality review, Minor): `SubscriptionService.ts`'s `buildManageView` and `listPaidPlansForChange` each define their own inline `{ MONTHLY: "Reserve", QUARTERLY: "Treasury", ANNUAL: "Sovereign" }` map. Cosmetic duplication only (both are correct and will change together in practice) — extract to one shared module-level constant on next touch of this file, not worth a dedicated pass.
- **`ManageSubscription.tsx` retry-link `window.open` missing `noopener,noreferrer`** (found in Task 13 code-quality review, Minor): `window.open(view.retryUrl!, "_blank")` opens Razorpay's own `short_url` (captured at subscription-creation time from the Razorpay SDK response, never webhook-derived, so not attacker-influenced in practice) without `noopener,noreferrer`. No live exploit path given the trusted source, but cheap defense-in-depth to add on next touch; no existing `window.open` precedent elsewhere in the codebase to match either way.
- **`ManageSubscription.tsx` cancel-confirm body fallback when `currentEnd` is null** (found in Task 13 code-quality review, Minor/nit): falls back to just the confirm title text rather than a body-shaped sentence. Only reachable in an edge case (an active/grantable row with no `currentEnd`); harmless, cosmetic only.
- **Pre-existing flaky e2e — NOT introduced by this feature** (found during Task 15 verification): `tests/e2e/unlock-authenticated.spec.ts` › "uploading an avatar replaces the initials placeholder…" fails ~2 of 3 runs when the whole file runs in order, on `main` as well as this branch (confirmed by re-running on `main`). Root cause is a race in `frontend/src/app/unlock/page.tsx`'s `handleAvatarChange`: `setUser((prev) => prev ? { ...prev, avatar } : prev)` silently drops the uploaded avatar if the page's initial `GET /api/auth/me` hasn't resolved yet (a real user uploading a photo within ~200 ms of page load would hit the same bug). Task 7's extra `getEffectivePlan` call widens that window slightly but does not cause it. Fix belongs in a separate change (the unlock page, or the test): after a successful `PATCH /api/auth/avatar`, re-fetch `/api/auth/me` rather than merging into possibly-null state. Left untouched here to keep this branch surgical.

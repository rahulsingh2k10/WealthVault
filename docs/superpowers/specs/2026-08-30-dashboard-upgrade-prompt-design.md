# Dashboard Upgrade Prompt — Design

**Date:** 2026-08-30
**Status:** Approved for planning
**Visual reference:** `.superpowers/brainstorm/mockup-upgrade-sheet-v10.html` (open in a browser; toolbar has "Show now", "Offer: ON/OFF", "Phone width", "Light / dark")

---

## 1. Summary

Six seconds after the dashboard mounts, a centered modal slides in over a dimmed/blurred
dashboard, presenting the three paid subscription plans and inviting the user to upgrade.
It is shown **only to `FREE`-tier users**, **once per browser session**, and is
**presentational only** — no payment, no plan change, no checkout. Choosing a plan or
dismissing simply closes it and suppresses it for the rest of the session.

The selected plan card is highlighted with an animated **border beam** (the component
supplied in the task), coloured from the app's existing accent tokens so it flips with
light/dark automatically.

---

## 2. Behaviour & triggering

### Server-side gate (`frontend/src/app/dashboard/page.tsx`)

`dashboard/page.tsx` is already a server component that reads the session and redirects to
`/unlock` when the vault is locked. It gains one call:

```ts
const prompt = await getUpgradePromptData(session.userId)
// ...
<AppShell title="Dashboard">
  {prompt && <UpgradePrompt {...prompt} />}
</AppShell>
```

`getUpgradePromptData(userId)` (new, in `UpgradePromptService.ts`) returns `null` — so the
client component is never rendered or shipped — unless **all** of:

- `userId` is present,
- a `User` row with that id exists,
- `user.subscriptionPlan.tier === 'FREE'`.

When non-null it returns `{ plans: PlanCardView[], memberCount: number | null }`.

Because the gate is server-side, paid users never receive the modal code path, and the
existing `tests/api/dashboard/dashboard.test.ts` case that uses a **non-existent** userId
still gets a `200` (user lookup → `null` → `getUpgradePromptData` → `null` → page renders
without the prompt).

### Client controller (`UpgradePrompt.tsx`, `"use client"`)

Props: `{ plans, memberCount }`. Responsibilities, and nothing else:

- On mount: if `sessionStorage['wv:upgrade-prompt:dismissed']` is set → do nothing, ever.
- Otherwise `setTimeout(() => setOpen(true), DELAY_MS)` where
  `DELAY_MS = Number(process.env.NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS) || 6000`
  (same env-var convention as `InactivityLock`).
- Clear the timer on unmount (user navigated away before it fired → no modal).
- `close()` = `sessionStorage.setItem('wv:upgrade-prompt:dismissed', '1')` then `setOpen(false)`.
- Renders `<UpgradeModal open={open} plans={plans} memberCount={memberCount} onClose={close} />`.

**Every** dismissal path calls `close()`: the X button, backdrop click, `Escape`,
"Maybe later", and any plan's CTA button. Once dismissed it will not reappear until a new
browser session (new tab / browser restart) — `sessionStorage`, not `localStorage`.

### Presentational CTAs

Each card has its own CTA ("Start with Reserve" / "Choose Treasury" / "Go Sovereign").
Clicking one logs intent (a single `console.info` placeholder / future analytics hook) and
calls `onClose()`. No network request, no navigation, no DB write. Wiring real checkout is
a separate future task.

---

## 3. Plans, pricing & offers

### Source of truth

Pricing lives in the existing `SubscriptionPlan` table. No new API route — the server
component reads it directly via `@/lib/prisma` and passes a serialised view model to the
client (Prisma `Decimal` → `number`).

| Column | Meaning here |
|---|---|
| `price` | Amount charged **per billing period**, whole INR (Decimal) |
| `offerPrice` | Discounted amount per billing period, or `null` (no offer) |
| `offerStartDate` / `offerEndDate` | Offer window, either nullable |
| `currency` | `'INR'` |
| `isActive` | Only `isActive` non-`FREE` plans are shown |

Billing-period length is derived from the tier (the enum name is the contract):

```
MONTHLY → 1 month     QUARTERLY → 3 months     ANNUAL → 12 months
```

### View model

```ts
type PaidTier = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

interface PlanCardView {
  tier: PaidTier
  billingMonths: 1 | 3 | 12
  currency: string          // 'INR'
  basePerPeriod: number     // price
  effectivePerPeriod: number// offerPrice when the offer is live, else price
  offerActive: boolean
  discountPercent: number   // round((1 - effective/base) * 100); 0 when no offer
  offerEndsAt: string | null// ISO date, for "ends 30 Sep" (client formats per locale)
}
```

`getUpgradePromptData` evaluates offers against `new Date()` at request time. A pure helper
`buildPlanCardView(plan, now: Date): PlanCardView` does the offer-window evaluation (pure so
it is unit-testable without a clock):

```
offerActive =
  offerPrice != null &&
  (offerStartDate == null || now >= offerStartDate) &&
  (offerEndDate   == null || now <= offerEndDate)
```

The client derives the headline per-month figure: `round(effectivePerPeriod / billingMonths)`,
formatted with `Intl.NumberFormat(locale, { style:'currency', currency, maximumFractionDigits:0 })`
(a small `formatMoney(amount, currency, locale)` helper — the existing `formatINR` forces 2
decimals, which we don't want here).

### Card content (from mockup v10)

| Tier | Display name | Tagline (placeholder) | Chip | CTA (placeholder) |
|---|---|---|---|---|
| MONTHLY | **Reserve** | "Month-to-month, cancel anytime" | — | "Start with Reserve" |
| QUARTERLY | **Treasury** | "Pay quarterly, save more" | `SAVE {discountPercent}%` — **only while `offerActive`** | "Choose Treasury" |
| ANNUAL | **Sovereign** | "Our lowest monthly rate" | `BEST VALUE` — **always** | "Go Sovereign" |

- Display names are **brand names — identical in every locale** (not translated).
- When `offerActive`, the card shows the struck-through base per-month price above the
  effective per-month price, plus a caption `🎁 {discountPercent}% off · ends {date}`.
- An **offer banner** appears at the top of the plan area whenever **any** plan's offer is
  live: "Launch offer — {discountPercent}% off · ends {date}" with a pulsing dot.
  (If plans have different discounts, the banner uses the largest.)

### Selection

- Default selected: **Sovereign** (ANNUAL). If ANNUAL is absent, the plan with the largest
  `billingMonths`.
- Select by clicking anywhere on a card, or via the segmented control (desktop only —
  Tailwind `hidden sm:flex`, i.e. hidden below 640px). The two stay in sync.
- Selected card: accent border + soft glow + **animated border beam** + its CTA becomes the
  filled gradient button; the other CTAs are outline style.
- `BEST VALUE` / `SAVE %` chips are **static per card and independent of selection** — they
  never move when the selection changes.

---

## 4. Social proof

`getUpgradePromptData` also runs:

```ts
const paid = await prisma.user.count({ where: { subscriptionPlan: { tier: { not: 'FREE' } } } })
const memberCount = paid > 100 ? Math.floor(paid / 100) * 100 : null
```

The modal shows `t.upgrade.social` ("Join {count}+ people tracking their net worth
privately") **only when `memberCount != null`** — i.e. once the product genuinely has more
than 100 paying members. Below that threshold the line is omitted entirely. The number is
floored to a round hundred so it reads as "100+", "3,200+", never a precise count.

---

## 5. Border-beam component integration

- The project has **Tailwind CSS** (`tailwind.config.ts`, `darkMode: "class"`), **TypeScript**,
  and `cn` at `@/lib/utils`. It is **not** a full shadcn project (no `components.json`,
  no `class-variance-authority`), but it follows the shadcn convention: a
  `frontend/src/components/ui/` folder already exists and `cn` is present.
- **`border-beam.tsx` depends only on `cn` + React.** It drops into
  `frontend/src/components/ui/border-beam.tsx` **verbatim** — no shadcn CLI, no Tailwind or
  TS setup, no new dependencies.
- It is `"use client"` and injects a `<style>` block (`@property --angle` + keyframes) into
  `<head>` once via a `useGlobalStyles` helper. Fine as-is.

### Colouring it with our theme

The app already defines, in `globals.css`, accent tokens that flip under `.dark`:

| Token | Light | Dark |
|---|---|---|
| `--ui-accent` | `#6B21A8` | `#F5C842` |
| `--ui-accent-warm` | `#BE4B03` | `#FFA040` |

In `UpgradeModal`, the selected card renders:

```tsx
<BorderBeam
  colorFrom="var(--ui-accent)"
  colorTo="var(--ui-accent-warm)"
  borderWidth={2}
  duration={6}
/>
```

The component pipes `colorFrom`/`colorTo` into `--color-from`/`--color-to` and uses those in
the gradient, so CSS-variable indirection resolves them to the live theme values — the beam
recolours on theme switch with **no extra code**.

### Reduced motion

The supplied component has no `prefers-reduced-motion` handling. `UpgradeModal` will check
`useReducedMotion()` (framer-motion, already a dependency) and, when reduced motion is
preferred, **not render `<BorderBeam>`** — the selected card keeps its static accent border
and glow.

### `demo.tsx`

Not copied into the app — it's just usage documentation. Its pattern (a `settings` object
merged with props) is not needed.

---

## 6. Components & files

### New

| File | Type | Purpose |
|---|---|---|
| `frontend/src/components/ui/border-beam.tsx` | client | Pasted verbatim from the task |
| `frontend/src/components/dashboard/UpgradePrompt.tsx` | client | Timer + `sessionStorage` suppression; renders `UpgradeModal` |
| `frontend/src/components/dashboard/UpgradeModal.tsx` | client | The modal UI (backdrop, panel, segmented control, cards, features, trust row) |
| `frontend/src/lib/services/UpgradePromptService.ts` | server | `getUpgradePromptData(userId)`, `buildPlanCardView(plan, now)`, view-model types |

### Modified

| File | Change |
|---|---|
| `frontend/src/app/dashboard/page.tsx` | Call `getUpgradePromptData`, render `<UpgradePrompt>` when non-null |
| `frontend/src/i18n/translations.ts` | Add `upgrade` namespace to the `Translations` interface and to all 11 locale objects |
| `frontend/prisma/seed.ts` | Replace placeholder `subscriptionPlan.createMany` with the numbers below + an active launch offer |
| `frontend/src/lib/utils.ts` | Add `formatMoney(amount, currency, locale)` (whole-unit currency formatting) |
| `tests/helpers/seedReferenceData.ts` | Match the seed's prices; add offer fields to QUARTERLY/ANNUAL |
| `tests/helpers/testUser.ts` | Optional `tier?: PaidTier \| 'FREE'` option (default `FREE`) |
| `tests/run-tests.ts` | Register an `upgrade-prompt` Jest suite |
| `run-tests.sh` | Add "Upgrade Prompt Tests" to the **API Testing** group |
| `tests/playwright.config.ts` | `webServer.env`: `NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS: "300"` so e2e isn't slow |

---

## 7. Styling & theming

- **Layout / spacing / responsive**: Tailwind utilities. Generous spacing per mockup v10
  (card padding ~18px, clear gaps between name / tagline / price / offer / CTA).
- **Accent colour** (selected border, beam, gradient CTA, chips, offer text): sourced from
  `--ui-accent` / `--ui-accent-warm` via inline `style`, matching how
  `components/landing/FeatureCarousel.tsx` already consumes these tokens. One source of
  truth, automatic light/dark.
- **Surfaces**: the `--ui-*` tokens (`--ui-modal-bg`, `--ui-modal-shadow`, `--ui-card-border`,
  `--ui-text-pri` / `-sec` / `-muted`, `--ui-subtle-bg`) — the modal is a "warm"-aesthetic
  surface like the unlock/landing screens, so it uses their token set rather than the
  `dark:slate-*` classes used inside the authenticated shell.
- **Enter / exit**: framer-motion `AnimatePresence` — backdrop fades; panel does
  opacity + `translateY(14px)→0` + `scale(.94)→1`, ~0.42s. The dashboard behind gets
  `blur(3px)` + slight dim while open.
- **Structure** (robust, per mockup v10): panel is `flex flex-col`,
  `max-h-[calc(100dvh-3rem)]`, with an inner `overflow-y-auto` region so on a phone the
  hero stays put and the plans/features/trust scroll. Each card is
  `card-top → card-mid → offer → cta` stacked blocks; on mobile `card-mid` is a flex row
  (identity left, price right) and `offer` + `cta` are full-width blocks below — nothing can
  overlap regardless of how a tagline wraps.
- Body scroll lock while open (`document.body.style.overflow = 'hidden'`, restored on close)
  — same as `EditModal`.
- `max-width` ~730px; centered; safe-area-aware padding.
- Rendered through a **`createPortal` to `document.body`** so the fixed-position backdrop
  and panel are not affected by any transform/stacking context created by `AppShell` /
  `WarmBackground` (which sit behind the dashboard content). SSR-guard the portal
  (`useEffect`-mounted flag) since `UpgradeModal` is a client component under a server page.

---

## 8. i18n

New `upgrade` namespace, added to the `Translations` interface and **all 11 locales** in
`translations.ts`. Keys:

```
upgrade: {
  title:              string  // "Your wealth, fully unlocked"
  subtitle:           string  // privacy line
  social:             string  // "Join {count}+ people tracking their net worth privately"
  feature1..feature4: string  // the 4 checklist bullets
  reserveTagline / treasuryTagline / sovereignTagline: string
  billedMonthly / billedQuarterly / billedYearly: string   // "Billed monthly" ...
  perMonthSuffix:    string   // "/mo"
  everyMonth / everyQuarter / everyYear: string  // "{amount} every month" / "{amount} billed quarterly" / "{amount} billed yearly"
  chipBestValue:     string   // "BEST VALUE"
  chipSave:          string   // "SAVE {percent}%"
  offerBanner:       string   // "Launch offer — {percent}% off · ends {date}"
  offerCaption:      string   // "🎁 {percent}% off · ends {date}"
  ctaReserve / ctaTreasury / ctaSovereign: string
  maybeLater:        string   // "Maybe later"
  trustEncrypted:    string   // "End-to-end encrypted"
  trustCancel:       string   // "Cancel anytime"
  trustMoneyBack:    string   // "7-day money-back"
}
```

- **Plan display names** (`Reserve` / `Treasury` / `Sovereign`) are **not** in the
  translation table — they're brand constants in `UpgradeModal`.
- `{count}`, `{percent}`, `{amount}`, `{date}` are interpolated client-side. `{date}` is
  `offerEndsAt` formatted with `Intl.DateTimeFormat(locale, { day:'numeric', month:'short' })`.
- ⚠️ **Non-English translations will be machine-generated and need native-speaker review.**
  English is authoritative; a `// TODO(i18n): review upgrade.* translations` note goes above
  the namespace.

---

## 9. Seed changes

`frontend/prisma/seed.ts` — replace the current placeholder block:

```ts
// Placeholder pricing — NOT finalised. `price` / `offerPrice` are per billing period,
// whole INR. Launch offer (20% off Treasury & Sovereign) is placeholder too.
const offerStart = new Date('2026-08-01T00:00:00Z');
const offerEnd   = new Date('2026-09-30T23:59:59Z');
await prisma.subscriptionPlan.createMany({
  data: [
    { tier: 'FREE',      price: 0,     offerPrice: null,  currency: 'INR', isActive: true },
    { tier: 'MONTHLY',   price: 3000,  offerPrice: null,  currency: 'INR', isActive: true },                                             // Reserve   ₹3,000/mo
    { tier: 'QUARTERLY', price: 6000,  offerPrice: 4800,  currency: 'INR', isActive: true, offerStartDate: offerStart, offerEndDate: offerEnd }, // Treasury  ₹2,000/mo → ₹1,600/mo (20% off)
    { tier: 'ANNUAL',    price: 18000, offerPrice: 14400, currency: 'INR', isActive: true, offerStartDate: offerStart, offerEndDate: offerEnd }, // Sovereign ₹1,500/mo → ₹1,200/mo (20% off)
  ],
});
```

`tests/helpers/seedReferenceData.ts` — update `ensureReferenceData` to upsert the same
prices and offer fields for QUARTERLY/ANNUAL, so e2e and integration tests see consistent
numbers. FREE stays `price: 0`.

---

## 10. Testing

### `tests/api/upgrade-prompt/upgradePrompt.test.ts` (Jest)

- `buildPlanCardView(plan, now)` — pure, no DB:
  - offer inside the window → `offerActive`, `effectivePerPeriod === offerPrice`,
    `discountPercent` correct and rounded.
  - `now` before `offerStartDate` / after `offerEndDate` → not active, effective = base,
    `discountPercent === 0`.
  - `offerPrice === null` → not active regardless of dates.
  - null `offerStartDate` and/or null `offerEndDate` → open-ended window behaves correctly.
- `getUpgradePromptData(userId)` — integration (test DB, `ensureReferenceData` + `createTestUser`):
  - FREE user → returns `plans` (3 paid tiers, MONTHLY/QUARTERLY/ANNUAL order) and
    `memberCount === null` (test DB has < 100 paid users).
  - `createTestUser({ tier: 'ANNUAL' })` → returns `null`.
  - unknown userId / `undefined` → `null`.

Registered as its own suite in `run-tests.ts` (`runJest("api/upgrade-prompt")`) and in
`run-tests.sh` under the **API Testing** group ("Upgrade Prompt Tests", SUITE 4 of 4).

### `tests/e2e/upgrade-prompt.spec.ts` (Playwright)

With `NEXT_PUBLIC_UPGRADE_PROMPT_DELAY_MS=300` (set in `playwright.config.ts` webServer env):

- **FREE user, unlocked vault** → visit `/dashboard` → modal appears → assert the three
  plan names, the Sovereign offer price (`₹1,200`) and the offer caption are visible →
  click "Maybe later" → modal gone → `page.reload()` → modal does **not** reappear (same
  context ⇒ same `sessionStorage`).
- **Paid user (`createTestUser({ tier: 'ANNUAL' })`), unlocked vault** → visit `/dashboard`
  → wait ~1s (> delay) → modal never appears.
- Selecting a non-default card moves the border-beam / `aria-checked` to it and the
  segmented control follows.

### Regression checks

- `tests/api/dashboard/dashboard.test.ts` — the "200 with non-existent userId" case must
  still pass (user lookup → `null` → no prompt → page still renders `200`).
- `tests/e2e/dashboard.spec.ts` — `createTestUser()` is FREE, so after 300ms (e2e delay)
  the modal would appear; that file's assertions run immediately after `goto`, so they
  still pass. No change needed, but noted.

Full suite (`./run-tests.sh`) green before and after.

---

## 11. Out of scope

- Real payment / checkout / Stripe / Razorpay wiring.
- Any change to the user's actual plan or `subscription_periods`.
- A manual entry point (sidebar "Upgrade" button, a `/pricing` page, settings screen).
- Trials, proration, coupon codes, seat management.
- Analytics/telemetry beyond a single placeholder `console.info` hook on CTA click.
- Localisation review by native speakers (flagged, separate task).
- Finalising real prices and the real offer window (placeholders, owner to set).

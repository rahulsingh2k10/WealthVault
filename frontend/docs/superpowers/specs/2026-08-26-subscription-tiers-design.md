# Subscription tiers — schema rename & field additions

## Context

The `User` model currently has a `plan` column (`Plan` enum: `FREE` / `PRO` / `MAX`), shown
cosmetically in the sidebar. There is no per-tier item-limit enforcement anywhere in the
codebase, and no billing/payment integration.

The product direction is a subscription model with four tiers — Free, Monthly, Quarterly,
Annual — following the common SaaS pattern. On Free, users will eventually be limited to 2
items per portfolio section (Equity, Mutual Funds, Crypto, etc.).

## Scope

This change covers **only** the database schema and the mechanical rename of every code
reference from `plan` to `subscription`. It does not include:
- Enforcing the 2-items-per-section limit on Free
- Any billing/payment integration for Monthly/Quarterly/Annual
- Any UI for choosing/upgrading a subscription

Those are follow-up work, tracked separately.

## Schema changes

Applied identically to `frontend/prisma/schema.prisma` and `backend/prisma/schema.prisma`
(the two schemas are kept in sync; `backend/` has no other logic referencing `User`).

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

model User {
  ...
  subscription           Subscription @default(FREE)
  subscriptionStartedAt  DateTime?
  subscriptionExpiresAt  DateTime?
  ...
}
```

Replaces the existing `enum Plan { FREE PRO MAX }` and `plan Plan @default(FREE)` column.
`PRO` and `MAX` are dropped — no longer part of the product's tier model.

`subscriptionStartedAt` / `subscriptionExpiresAt` are nullable `DateTime` fields, unused by
any logic yet, added now to avoid a second migration when renewal/expiry logic is built.

## Code touchpoints

All references to `plan` renamed to `subscription`, value `"FREE"` unchanged as the default:

- `frontend/src/app/api/auth/google/callback/route.ts` — `plan: "FREE"` → `subscription: "FREE"`
- `frontend/src/app/api/auth/apple/callback/route.ts` — same
- `frontend/src/app/api/auth/x/callback/route.ts` — same
- `frontend/src/app/api/auth/linkedin/callback/route.ts` — same
- `frontend/src/lib/repositories/UserRepository.ts` — `plan: 'FREE'` → `subscription: 'FREE'`
- `frontend/src/app/api/auth/me/route.ts` — `plan: dbUser.plan` → `subscription: dbUser.subscription`
- `frontend/src/components/layout/Sidebar.tsx`:
  - `PLAN_LABELS` map renamed to `SUBSCRIPTION_LABELS`, keys become
    `FREE: "freeSubscription"`, `MONTHLY: "monthlySubscription"`,
    `QUARTERLY: "quarterlySubscription"`, `ANNUAL: "annualSubscription"`
  - `UserInfo.plan` → `UserInfo.subscription`
  - `planKey`/`planLabel` variables renamed accordingly
- `frontend/src/i18n/translations.ts`:
  - `Translations.sidebar` interface: `plan` → `subscription`, `freePlan`/`proPlan`/`maxPlan`
    → `freeSubscription`/`monthlySubscription`/`quarterlySubscription`/`annualSubscription`
  - Same rename applied across all 11 locale blocks (`en-US`, `fr-FR`, `de-DE`, `hi-IN`,
    `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `pt-BR`, `es-419`, `es-ES`), with each locale's
    existing translated string kept for `freeSubscription` and a reasonable native
    translation added for the three new labels (`monthlySubscription`,
    `quarterlySubscription`, `annualSubscription`)

`IUserRepository.ts` / `OAuthProfile` are untouched — `plan` isn't part of that interface,
it's hardcoded per-route at user creation.

## Database migration

No `prisma/migrations` folder exists in this project — schema changes have been applied via
`prisma db push` directly against the Railway Postgres instance configured in
`frontend/.env`. This change will be applied the same way: after editing `schema.prisma`,
run `prisma db push` against that live database. Confirmed with the user this is acceptable
(no production user data at risk currently).

## Verification

- `npx tsc --noEmit` in `frontend/` passes (no leftover references to the old `plan` field/type)
- `npx prisma db push` completes without error against the Railway DB
- Dev server starts; sidebar renders "Free subscription" label for a test user without error

# Subscription plan pricing table

## Context

`User.subscription` (see `2026-08-26-subscription-tiers-design.md`) stores which tier a
user is on (`FREE` / `MONTHLY` / `QUARTERLY` / `ANNUAL`), but there is nowhere in the
schema that records what each tier actually costs. There is currently no pricing page, no
checkout flow, and no code anywhere that reads a price. This change adds a reference table
holding that pricing data so it exists to be read by pricing/checkout UI later.

## Scope

This change covers **only**:
- A new `SubscriptionPlan` reference table (one row per tier)
- Placeholder seed data for all four tiers

It does **not** include:
- Any API route to read this table
- Any pricing page or checkout UI
- Wiring this table into the existing upgrade/subscription flow
- Real price values (placeholders only — actual pricing not finalized yet)

Those are follow-up work, tracked separately.

## Schema changes

Applied identically to `frontend/prisma/schema.prisma` and `backend/prisma/schema.prisma`
(the two schemas are kept in sync).

```prisma
model SubscriptionPlan {
  id             Int           @id @default(autoincrement())
  tier           Subscription  @unique
  price          Decimal
  offerPrice     Decimal?
  currency       String        @default("INR")
  offerStartDate DateTime?
  offerEndDate   DateTime?
  isActive       Boolean       @default(true)
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  @@map("subscription_plans")
}
```

Notes:
- `tier` reuses the existing `Subscription` enum; `@unique` enforces one row per tier.
- `FREE` gets a row too (`price: 0`), for a complete/uniform reference table, per user
  decision during design.
- `price`/`offerPrice` use `Decimal` (Postgres `numeric`), not `Float`, since this is
  money — avoids binary floating-point rounding error. This is the first `Decimal` field
  in either schema; no existing convention to follow here.
- `offerPrice` is nullable — a tier without an active promotion has no offer price.
- `currency` defaults to `"INR"` as a placeholder (the app's existing instruments — NPS,
  PPF, Post Office schemes — are India-specific); change per-row later if needed.
- `isActive` lets a plan be hidden from future pricing UI without deleting its row.
- Modeled as a plain reference table (`id Int @default(autoincrement())`, no
  `encryptedData` blob), matching `AppConfig`/`NavConfig` — this is global config data,
  not per-user financial data, so it doesn't go through the app's client-side encryption
  path the way holdings do.

## Seed data

Added to `frontend/prisma/seed.ts`, alongside the existing `navConfig.createMany` block
(also global, non-encrypted reference data):

```typescript
await prisma.subscriptionPlan.createMany({
  data: [
    { tier: 'FREE',      price: 0, offerPrice: null, currency: 'INR', isActive: true },
    { tier: 'MONTHLY',   price: 0, offerPrice: null, currency: 'INR', isActive: true },
    { tier: 'QUARTERLY', price: 0, offerPrice: null, currency: 'INR', isActive: true },
    { tier: 'ANNUAL',    price: 0, offerPrice: null, currency: 'INR', isActive: true },
  ],
});
```

All prices are `0` placeholders — real pricing has not been finalized. A
`prisma.subscriptionPlan.deleteMany()` call is added to the seed's existing "clear all
existing data" block so the seed script stays idempotent on repeat runs.

## Database migration

No `prisma/migrations` folder exists in this project — schema changes are applied via
`prisma db push` directly against the Railway Postgres instance configured in
`frontend/.env` (confirmed: `DATABASE_URL` points at Railway, not a local Postgres — there
is no separate local/dev database in this project). This change will be applied the same
way: after editing `schema.prisma`, run `prisma db push` against that live database. This
is purely additive (a new table; no existing columns touched), but push will not run
without explicit confirmation at implementation time, consistent with how the prior
subscription-tiers schema change was handled.

## Verification

- `npx tsc --noEmit` in `frontend/` passes
- `npx prisma db push` completes without error against the Railway DB
- `npx prisma generate` succeeds and `prisma.subscriptionPlan` is available on the client
- Seed script runs without error and produces exactly 4 rows in `subscription_plans`
  (one per `Subscription` enum value)

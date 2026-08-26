# Subscription Plan Pricing Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `SubscriptionPlan` reference table (one row per `Subscription` tier) holding placeholder pricing data, mirrored across both Prisma schemas and seeded in dev.

**Architecture:** A new plain Prisma model `SubscriptionPlan` (`@@map("subscription_plans")`), added identically to `frontend/prisma/schema.prisma` and `backend/prisma/schema.prisma` (these two files must stay byte-identical per the warning comment at the top of the backend schema). Seeded with 4 placeholder rows (one per `Subscription` enum value) via `frontend/prisma/seed.ts`, the only seed script in the repo. No API route or UI reads this table yet — out of scope per the design spec.

**Tech Stack:** Prisma 5, PostgreSQL (Railway), TypeScript, ts-node (for the seed script)

**Spec:** `docs/superpowers/specs/2026-08-26-subscription-plan-pricing-table-design.md`

---

### Task 1: Add the `SubscriptionPlan` model to both Prisma schemas

**Files:**
- Modify: `frontend/prisma/schema.prisma:196-198` (between the `enum Subscription` block and `model User`)
- Modify: `backend/prisma/schema.prisma:196-203` (same location)

- [ ] **Step 1: Add the model to `frontend/prisma/schema.prisma`**

Insert this block between the closing `}` of `enum Subscription` and `model User`:

```prisma
model SubscriptionPlan {
  id             Int          @id @default(autoincrement())
  tier           Subscription @unique
  price          Decimal
  offerPrice     Decimal?
  currency       String       @default("INR")
  offerStartDate DateTime?
  offerEndDate   DateTime?
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("subscription_plans")
}
```

The full surrounding context should read:

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

model SubscriptionPlan {
  id             Int          @id @default(autoincrement())
  tier           Subscription @unique
  price          Decimal
  offerPrice     Decimal?
  currency       String       @default("INR")
  offerStartDate DateTime?
  offerEndDate   DateTime?
  isActive       Boolean      @default(true)
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@map("subscription_plans")
}

model User {
  id                    String       @id @default(cuid())
  ...
```

- [ ] **Step 2: Add the identical model to `backend/prisma/schema.prisma`**

Insert the exact same `model SubscriptionPlan { ... }` block (copy verbatim from Step 1) between `enum Subscription` and `model User` in `backend/prisma/schema.prisma`.

- [ ] **Step 3: Verify both schemas are byte-identical apart from the header comment**

Run:

```bash
diff <(tail -n +6 backend/prisma/schema.prisma) <(cat frontend/prisma/schema.prisma)
```

Expected: no output (empty diff). `backend/prisma/schema.prisma` has a 5-line warning comment at the top that `frontend/prisma/schema.prisma` doesn't have — `tail -n +6` skips it so the rest can be compared line-for-line.

- [ ] **Step 4: Validate the schema syntax**

Run:

```bash
cd frontend && npx prisma validate
```

Expected output: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Generate the Prisma client and type-check**

Run:

```bash
cd frontend && npx prisma generate && npx tsc --noEmit
```

Expected: both commands exit 0 with no errors. This confirms `prisma.subscriptionPlan` is now available on the generated client and nothing else in the codebase broke.

- [ ] **Step 6: Commit**

```bash
git add frontend/prisma/schema.prisma backend/prisma/schema.prisma
git commit -m "Add SubscriptionPlan model to both Prisma schemas"
```

---

### Task 2: Seed placeholder pricing rows

**Files:**
- Modify: `frontend/prisma/seed.ts:17-28` (add `subscriptionPlan.deleteMany()` to the clear-data block)
- Modify: `frontend/prisma/seed.ts:30-47` (add `subscriptionPlan.createMany()` after the `navConfig` block)

- [ ] **Step 1: Add the delete call to the existing "clear all existing data" block**

In `frontend/prisma/seed.ts`, the block currently reads:

```typescript
  // Clear all existing data
  await prisma.navConfig.deleteMany();
  await prisma.appConfig.deleteMany();
```

Change it to:

```typescript
  // Clear all existing data
  await prisma.navConfig.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.appConfig.deleteMany();
```

- [ ] **Step 2: Add the seed call after the `navConfig.createMany` block**

Immediately after this existing block (ends with `console.log("✅ Nav config seeded");`):

```typescript
  await prisma.navConfig.createMany({
    data: [
      ...
    ],
  });
  console.log("✅ Nav config seeded");
```

Add:

```typescript
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

- [ ] **Step 3: Type-check the seed script**

Run:

```bash
cd frontend && npx tsc --noEmit
```

Expected: exits 0, no errors. (The seed script is included in the project's TypeScript compilation; a typo in field names or an invalid enum value here would surface as a type error, e.g. `Object literal may only specify known properties`.)

- [ ] **Step 4: Commit**

```bash
git add frontend/prisma/seed.ts
git commit -m "Seed placeholder pricing rows for each subscription tier"
```

---

### Task 3: Apply the schema change and seed data to the live database

> This task writes to the Railway Postgres database configured in `frontend/.env` — there
> is no separate local/dev database in this project (confirmed: `DATABASE_URL` points at
> Railway). Confirm with the user before running Step 1 or Step 3, the same way the prior
> `Subscription` enum migration was confirmed before pushing.

**Files:** none (database operations only)

- [ ] **Step 1: Confirm with the user, then push the schema**

After getting explicit go-ahead, run:

```bash
cd frontend && npx prisma db push
```

Expected output includes: `Your database is now in sync with your Prisma schema.` This creates the new `subscription_plans` table. It does not touch any existing table — `SubscriptionPlan` is a brand-new model, not a modification of `User` or anything else.

- [ ] **Step 2: Verify the table exists with the right shape**

Run:

```bash
cd frontend && npx prisma studio
```

Open the `subscription_plans` model in the browser tab Prisma Studio opens and confirm the columns match: `id`, `tier`, `price`, `offerPrice`, `currency`, `offerStartDate`, `offerEndDate`, `isActive`, `createdAt`, `updatedAt`. Close the tab and stop the process (Ctrl+C) when done — don't leave Prisma Studio running in the background.

- [ ] **Step 3: Confirm with the user, then run the seed script**

> Re-confirm before this step specifically: the seed script's "clear all existing data" block deletes rows from `navConfig`, `appConfig`, and every holdings table, not just `subscriptionPlan`. Running it against the live Railway database wipes existing seeded data, not just adds to it.

After explicit go-ahead, run:

```bash
cd frontend && npm run db:seed
```

(This is `npx tsx prisma/seed.ts` per the `db:seed` script in `frontend/package.json:11` — there's no `prisma.seed` config for the `npx prisma db seed` shortcut in this project.)

Expected output includes: `✅ Subscription plans seeded (placeholder pricing)` among the other seed confirmation lines, ending with `🎉 Database seeded successfully with encrypted data!`.

- [ ] **Step 4: Verify exactly 4 rows exist, one per tier**

Run:

```bash
cd frontend && npx prisma studio
```

In the `subscription_plans` table, confirm there are exactly 4 rows with `tier` values `FREE`, `MONTHLY`, `QUARTERLY`, `ANNUAL` (no duplicates — the `@unique` constraint on `tier` should make duplicates impossible, but confirm the seed only ran once). Close the tab and stop the process when done.

---

## Verification Summary (from the design spec)

- [x] `npx tsc --noEmit` in `frontend/` passes — covered in Task 1 Step 5 and Task 2 Step 3
- [ ] `npx prisma db push` completes without error against the Railway DB — Task 3 Step 1
- [x] `npx prisma generate` succeeds and `prisma.subscriptionPlan` is available on the client — Task 1 Step 5
- [ ] Seed script runs without error and produces exactly 4 rows in `subscription_plans` — Task 3 Steps 3–4

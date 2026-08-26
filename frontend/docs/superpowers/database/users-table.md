# Database: `users` Table

> Source of truth: `prisma/schema.prisma` (frontend). `backend/prisma/schema.prisma` is
> kept byte-identical for this model — the backend service has no logic of its own that
> touches `users`, it just needs a matching schema against the same database.

## Overview

- **Prisma model name:** `User`
- **Table name:** `users` (via `@@map("users")`)
- **Database:** PostgreSQL, hosted on Railway (`DATABASE_URL` in `frontend/.env`)
- **Migration strategy:** no `prisma/migrations` history exists for this project — schema
  changes are applied directly with `prisma db push`. There is currently no production
  user data, which is why this has been safe to do.
- One row per person who has ever signed in, across any of the four supported OAuth
  providers (Google, Apple, X, LinkedIn).

---

## Column reference

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `String` | No | `cuid()` | Primary key. Not referenced as a foreign key from anywhere today — see **Relationships** below for the tables that referenced it by convention until they were dropped. |
| `fullName` | `String` | No | — | Display name, sourced from the OAuth provider's profile. Refreshed on every login. |
| `username` | `String` | No | — | **Unique.** The cross-provider identity key. An email address for Google/Apple/LinkedIn; a bare handle (no `@`) for X. See **Identity key design** below. |
| `platform` | `String` | No | — | Which provider the account was created/last used with: `"Google"`, `"Apple"`, `"X"`, or `"LinkedIn"`. Not a Prisma enum — a free-form string, so nothing at the DB level stops a typo'd value. |
| `avatar` | `String?` | Yes | — | Either the OAuth provider's profile picture URL, or a user-uploaded base64 JPEG data URL (set via `PATCH /api/auth/avatar`). `NULL` for Apple sign-ins that never uploaded a photo. |
| `subscription` | `Subscription` (enum) | No | `FREE` | The user's current billing tier. **Foreign key** into `subscription_plans.tier` as of 2026-08-26 — see **`Subscription` enum** below and `database/subscription-plans-table.md`. |
| `subscriptionStartDate` | `DateTime?` | Yes | — | When the current `subscription` period began. Currently unused by any code — no route reads or writes it yet. Reserved for the billing work that comes after this. |
| `subscriptionEndDate` | `DateTime?` | Yes | — | When the current `subscription` period ends/renews. Same status as above — schema-only, not yet wired to any logic. |
| `verifier` | `String?` | Yes | — | AES-256-GCM–encrypted verifier blob, derived from the user's vault passphrase (`encrypt("PORTFOLIO_APP_V1", derivedKey)`). `NULL` means the user has never set a passphrase (first-time vault setup pending). **The passphrase itself is never stored** — only this verifier, which can confirm a correct passphrase without revealing it. Written by `POST /api/auth/unlock`. |
| `createdAt` | `DateTime` | No | `now()` | Row creation timestamp, set once. |
| `updatedAt` | `DateTime` | No | auto | Updated automatically by Prisma on every write to the row (`@updatedAt`). |

### Full current model (for reference)

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

model User {
  id                    String           @id @default(cuid())
  fullName              String
  username              String           @unique
  platform              String
  avatar                String?
  subscription          Subscription     @default(FREE)
  subscriptionPlan      SubscriptionPlan @relation(fields: [subscription], references: [tier])
  subscriptionStartDate DateTime?
  subscriptionEndDate   DateTime?
  verifier              String?
  createdAt             DateTime         @default(now())
  updatedAt             DateTime         @updatedAt

  @@map("users")
}
```

---

## `Subscription` enum

| Value | Meaning | Set by |
|---|---|---|
| `FREE` | Default tier for every new sign-up. Intended limit (not yet enforced in code): 2 items per portfolio section. | Every OAuth callback route, on first-time account creation |
| `MONTHLY` | Paid, billed monthly. | Not yet — no billing integration exists yet |
| `QUARTERLY` | Paid, billed quarterly. | Not yet |
| `ANNUAL` | Paid, billed annually. | Not yet |

No code path currently sets a user to anything other than `FREE`, and no code path
currently *reads* `subscription` to gate or limit behavior — the Sidebar UI displays it
(see `frontend/src/components/layout/Sidebar.tsx`), but nothing enforces item limits or
checks `subscriptionEndDate` for expiry yet. This table is groundwork for that future work,
tracked in `docs/superpowers/specs/2026-08-26-subscription-tiers-design.md`.

As of 2026-08-26, each value here also corresponds to a row in `subscription_plans` (see
`database/subscription-plans-table.md`) holding that tier's price — `users.subscription` is
now a foreign key into `subscription_plans.tier`, not just a bare enum column. See
**Relationships** below.

---

## Constraints & indexes

- **Primary key:** `id` (`cuid()`, generated by Prisma, not the database)
- **Unique constraint:** `username` — this is what every `upsert` in the OAuth callback
  routes keys off of (`where: { username: ... }`), so two different providers can never
  silently collide into the same row unless they'd resolve to the identical `username`
  string (which the identity-key design below is built to prevent).
- **Foreign key:** `subscription` → `subscription_plans.tier` (constraint
  `users_subscription_fkey`, added 2026-08-26) — see **Relationships** below.
- No other indexes are defined.

---

## Identity key design (`username`)

A single person could in theory sign in with more than one provider. WealthVault does
**not** merge those into one account — each provider produces its own `username`, so
signing in with Google and then with X creates two separate `users` rows. The scheme is
designed so that different providers can never accidentally collide on the same
`username`:

- Google / Apple / LinkedIn → the real email address (e.g. `rahul@gmail.com`)
- X → the bare handle, no `@` or domain (e.g. `rahulsingh2k10`)

Since email addresses always contain `@` and X handles never do, there's no possible
string collision between an email-based identity and an X handle — this is why `platform`
doesn't need to be part of the uniqueness constraint.

---

## Relationships

**`users.subscription` → `subscription_plans.tier`** (foreign key, added 2026-08-26): every
user's `subscription` value must match an existing `tier` row in `subscription_plans`.
Postgres enforces this at the database level (constraint name `users_subscription_fkey`),
not just at the application/type level. No `onDelete`/`onUpdate` modifier was set, so
Postgres's default (`NO ACTION`) applies — a `subscription_plans` row can't be deleted while
any user still references its `tier`. See `database/subscription-plans-table.md` for the
full relationship writeup, including the reverse `SubscriptionPlan.users User[]` accessor.

**Historical note:** until 2026-08-26, `users.id` was also referenced *by convention* (not a
real foreign key) from ~17 asset/holding tables (`EquityHolding`, `MutualFund`,
`CryptoHolding`, `BankAccount`, `Liability`, and so on), each via its own `userId String`
column with no `@relation`. All of those tables — along with `AppConfig` and `NavConfig` —
were subsequently dropped from both the schema and the live database, leaving `users` and
`subscription_plans` as the only two tables. The application code that referenced those
models (~16 API routes under `frontend/src/app/api/*`, the dashboard page, `seed.ts`, and
`UserRepository`) was intentionally left in place and is currently broken
(`tsc --noEmit` fails) — it has not been updated or removed to match.

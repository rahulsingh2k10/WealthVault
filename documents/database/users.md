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

| Column               | Type       | Nullable | Default  | Notes                                  |
|----------------------|------------|----------|----------|----------------------------------------|
| `id`                 | `String`   | No       | `uuid()` | Primary key                            |
| `fullName`           | `String`   | No       | —        | Display name from the OAuth provider   |
| `username`           | `String`   | No       | —        | Unique cross-provider identity key     |
| `auth_platformId`    | `String`   | No       | —        | Foreign key to `auth_platforms.id`     |
| `avatar`             | `String?`  | Yes      | —        | Provider photo URL or uploaded image   |
| `subscriptionPlanId` | `String`   | No       | —        | Foreign key to `subscription_plans.id` |
| `verifier`           | `String?`  | Yes      | —        | Encrypted passphrase verifier          |
| `createdAt`          | `DateTime` | No       | `now()`  | Row creation timestamp                 |
| `updatedAt`          | `DateTime` | No       | auto     | Auto-updated on write                  |

### Column details

- **`id`** — Not referenced as a foreign key from any other table.
- **`fullName`** — Sourced from the OAuth provider's profile. Refreshed on every login.
- **`username`** — The cross-provider identity key. An email address for Google/Apple/LinkedIn; a bare handle (no `@`) for X. See **Identity key design** below.
- **`auth_platformId`** — The provider name is read via the relation (`user.authPlatform.platform`), not stored directly on `User`. See **Relationships** below and `auth-platforms.md`.
- **`avatar`** — Either the OAuth provider's profile picture URL, or a user-uploaded base64 JPEG data URL (set via `PATCH /api/auth/avatar`). `NULL` for Apple sign-ins that never uploaded a photo.
- **`subscriptionPlanId`** — The tier name is read via the relation (`user.subscriptionPlan.tier`), not stored directly on `User`. See **Relationships** below and `subscription-plans.md`.
- **`verifier`** — AES-256-GCM–encrypted verifier blob, derived from the user's vault passphrase (`encrypt("PORTFOLIO_APP_V1", derivedKey)`). `NULL` means the user has never set a passphrase (first-time vault setup pending). **The passphrase itself is never stored** — only this verifier, which can confirm a correct passphrase without revealing it. Written by `POST /api/auth/unlock` on first-time setup only; read (never rewritten) on every subsequent unlock. Full request/response details in `../api/unlock-api.md`.
- **`createdAt`** — Set once, at row creation.
- **`updatedAt`** — Updated automatically by Prisma on every write to the row (`@updatedAt`).

### Full current model (for reference)

```prisma
enum Subscription {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL
}

enum Platform {
  GOOGLE
  APPLE
  X
  LINKEDIN
}

model User {
  id                  String               @id @default(uuid())
  fullName            String
  username            String               @unique
  auth_platformId     String
  authPlatform        AuthPlatform         @relation(fields: [auth_platformId], references: [id])
  avatar              String?
  subscriptionPlanId  String
  subscriptionPlan    SubscriptionPlan     @relation(fields: [subscriptionPlanId], references: [id])
  subscriptionPeriods SubscriptionPeriod[]
  verifier            String?
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt

  @@map("users")
}
```

---

## `Subscription` enum

This enum appears on `SubscriptionPlan.tier` (see `subscription-plans.md`). A user's
tier is read by joining through `subscriptionPlanId` (`user.subscriptionPlan.tier`), not
stored on `User` directly.

| Value | Meaning | Set by |
|---|---|---|
| `FREE` | Default tier for every new sign-up. Intended limit (not yet enforced in code): 2 items per portfolio section. | Every OAuth callback route, on first-time account creation — via `subscriptionPlanId: freePlan.id`, looked up by `tier: "FREE"` |
| `MONTHLY` | Paid, billed monthly. | Not yet — no billing integration exists yet |
| `QUARTERLY` | Paid, billed quarterly. | Not yet |
| `ANNUAL` | Paid, billed annually. | Not yet |

No code path currently sets a user to anything other than `FREE`, and no code path
reads the tier to gate or limit behavior — `GET /api/auth/me` joins through
`subscriptionPlan` and returns the tier as `subscription: "FREE"` in its JSON response,
and the Sidebar UI displays that (see `frontend/src/components/layout/Sidebar.tsx`), but
nothing enforces item limits. Subscription period tracking lives in `subscription_periods`
— see `subscription-periods.md`.

See **Relationships** below for the full `subscriptionPlanId` foreign key design.

---

## `Platform` enum

This enum appears on `AuthPlatform.platform` (see `auth-platforms.md`). A user's sign-in
provider is read by joining through `auth_platformId` (`user.authPlatform.platform`), not
stored on `User` directly.

| Value | Meaning | Set by |
|---|---|---|
| `GOOGLE` | Signed in via Google OAuth | `google/callback/route.ts`, via `auth_platformId: googlePlatform.id`, looked up by `platform: "GOOGLE"` |
| `APPLE` | Signed in via Apple OAuth | `apple/callback/route.ts`, same pattern |
| `X` | Signed in via X (Twitter) OAuth | `x/callback/route.ts`, same pattern |
| `LINKEDIN` | Signed in via LinkedIn OAuth | `linkedin/callback/route.ts`, same pattern |

`GET /api/auth/me` joins through `authPlatform` and returns the provider as
`platform: "GOOGLE"` (etc.) in its JSON response. Nothing currently reads this value
beyond that pass-through — no UI component displays it.

See **Relationships** below for the full `auth_platformId` foreign key design.

---

## Constraints & indexes

- **Primary key:** `id` (`uuid()`, generated by Prisma, not the database)
- **Unique constraint:** `username` — this is what every `upsert` in the OAuth callback
  routes keys off of (`where: { username: ... }`), so two different providers can never
  silently collide into the same row unless they'd resolve to the identical `username`
  string (which the identity-key design below is built to prevent).
- **Foreign key:** `auth_platformId` → `auth_platforms.id` (constraint
  `users_auth_platformId_fkey`) — see **Relationships** below.
- **Foreign key:** `subscriptionPlanId` → `subscription_plans.id` (constraint
  `users_subscriptionPlanId_fkey`) — see **Relationships** below.
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
string collision between an email-based identity and an X handle — this is why
`auth_platformId` doesn't need to be part of the uniqueness constraint.

---

## Relationships

**`users.auth_platformId` → `auth_platforms.id`** (foreign key): every user's `auth_platformId` must
match an existing row's `id` in `auth_platforms`. Postgres enforces this at the database
level (constraint name `users_auth_platformId_fkey`, `ON DELETE RESTRICT`, `ON UPDATE CASCADE`
— verified via `pg_constraint`). See `auth-platforms.md` for the full relationship
writeup, including the reverse `AuthPlatform.users User[]` accessor.

**`users.subscriptionPlanId` → `subscription_plans.id`** (foreign key): every user's
`subscriptionPlanId` must match an existing row's `id` in `subscription_plans`. Postgres
enforces this at the database level (constraint name `users_subscriptionPlanId_fkey`,
`ON DELETE RESTRICT`, `ON UPDATE CASCADE`) — a `subscription_plans` row can't be deleted
while any user still references its `id`, but updating its `id` cascades automatically.
See `subscription-plans.md` for the full relationship writeup, including the reverse
`SubscriptionPlan.users User[]` accessor.

**`subscription_periods.userId` → `users.id`** (foreign key, reverse direction): each
`subscription_periods` row belongs to one user. See `subscription-periods.md`.

`users`, `subscription_plans`, `auth_platforms`, and `subscription_periods` are the four
tables in the database. Several application files (~16 API routes under
`frontend/src/app/api/*`, the dashboard page, `seed.ts`, and `UserRepository`) reference
Prisma models that do not exist in the current schema (e.g. `EquityHolding`,
`MutualFund`, `AppConfig`) and fail to type-check (`tsc --noEmit`); they are
non-functional.

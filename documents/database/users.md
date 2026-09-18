# Database: `users` Table

> Source of truth: `prisma/schema.prisma` (frontend). `backend/prisma/schema.prisma` is
> kept byte-identical for this model — the backend service has no logic of its own that
> touches `users`, it just needs a matching schema against the same database.

## Overview

- **Prisma model name:** `User`
- **Table name:** `users` (via `@@map("users")`)
- **Database:** PostgreSQL, hosted on Railway (`DATABASE_URL` in `frontend/.env`)
- **Migration strategy:** no `prisma/migrations` history exists for this project — schema
  changes are applied directly with `prisma db push`.
- One row per person who has ever signed in, across any of the four supported OAuth
  providers (Google, Apple, X, LinkedIn).

---

## Column reference

| Column               | Type       | Nullable | Default  | Notes                                  |
|----------------------|------------|----------|----------|----------------------------------------|
| `id`                 | `String`   | No       | `uuid()` | Primary key                            |
| `fullName`           | `String`   | No       | —        | Display name from the OAuth provider   |
| `username`           | `String`   | No       | —        | Unique cross-provider identity key     |
| `avatar`             | `String?`  | Yes      | —        | Provider photo URL or uploaded image   |
| `auth_platformId`    | `String`   | No       | —        | Foreign key to `auth_platforms.id`     |
| `subscriptionPlanId` | `String`   | No       | —        | Foreign key to `subscription_plans.id` |
| `razorpayCustomerId` | `String?`  | Yes      | —        | Razorpay Customer ID, set on first checkout |
| `verifier`           | `String?`  | Yes      | —        | Encrypted passphrase verifier          |
| `createdAt`          | `DateTime` | No       | `now()`  | Row creation timestamp                 |
| `updatedAt`          | `DateTime` | No       | auto     | Auto-updated on write                  |

### Column details

- **`id`** — Not referenced as a foreign key from any other table.
- **`fullName`** — Sourced from the OAuth provider's profile. Refreshed on every login.
- **`username`** — The cross-provider identity key. An email address for Google/Apple/LinkedIn; a bare handle (no `@`) for X. See **Identity key design** below.
- **`avatar`** — Either the OAuth provider's profile picture URL, or a user-uploaded base64 JPEG data URL (set via `PATCH /api/auth/avatar`). `NULL` for Apple sign-ins that never uploaded a photo.
- **`auth_platformId`** — The provider name is read via the relation (`user.authPlatform.platform`), not stored directly on `User`. See **Relationships** below and `auth-platforms.md`.
- **`subscriptionPlanId`** — The tier name is read via the relation (`user.subscriptionPlan.tier`), not stored directly on `User`. See **Relationships** below and `subscription-plans.md`.
- **`razorpayCustomerId`** — The Razorpay Customer ID backing this user's paid-plan checkout. `NULL` until the user's first checkout attempt (`POST /api/subscription/create`), which calls `provider.ensureCustomer(...)` and persists the ID it returns; `POST /api/subscription/change-plan` reuses the same stored ID on subsequent checkouts rather than creating a new Razorpay customer each time. Not referenced as a foreign key from any other table — see `../payments/subscription-reconciliation.md` for the surrounding checkout/upgrade flow.
- **`verifier`** — AES-256-GCM–encrypted verifier blob, derived from the user's vault passphrase (`encrypt("PORTFOLIO_APP_V1", derivedKey)`). `NULL` means the user has never set a passphrase (first-time vault setup pending). **The passphrase itself is never stored** — only this verifier, which can confirm a correct passphrase without revealing it. Written by `POST /api/auth/unlock` on first-time setup only; read (never rewritten) on every subsequent unlock. Full request/response details in `../api/unlock-api.md`.
- **`createdAt`** — Set once, at row creation.
- **`updatedAt`** — Updated automatically by Prisma on every write to the row (`@updatedAt`).

### Full current model (for reference)

```prisma
enum Tier {
  FREE
  MONTHLY
  QUARTERLY
  ANNUAL

  @@map("Subscription")
}

enum Platform {
  GOOGLE
  APPLE
  X
  LINKEDIN
}

model User {
  id                      String                    @id @default(uuid())
  fullName                String
  username                String                    @unique
  avatar                  String?
  auth_platformId         String
  authPlatform            AuthPlatform              @relation(fields: [auth_platformId], references: [id])
  subscriptionPlanId      String
  subscriptionPlan        SubscriptionPlan          @relation(fields: [subscriptionPlanId], references: [id])
  subscriptionPlanHistory SubscriptionPlanHistory[]
  razorpayCustomerId      String?
  subscriptions           Subscription[]
  userPreferences         UserPreference[]
  verifier                String?
  createdAt               DateTime                  @default(now())
  updatedAt               DateTime                  @updatedAt

  @@map("users")
}
```

---

## `Tier` enum

This enum appears on `SubscriptionPlan.tier` (see `subscription-plans.md`). A user's
tier is read by joining through `subscriptionPlanId` (`user.subscriptionPlan.tier`), not
stored on `User` directly. The Prisma model is named `Tier`; the enum carries
`@@map("Subscription")`, so the underlying Postgres enum type is still named `Subscription`.

| Value | Meaning | Set by |
|---|---|---|
| `FREE` | Default tier for every new sign-up. | Every OAuth callback route, on first-time account creation — via `subscriptionPlanId: freePlan.id`, looked up by `tier: "FREE"` |
| `MONTHLY` | Paid tier, billed monthly. | — |
| `QUARTERLY` | Paid tier, billed quarterly. | — |
| `ANNUAL` | Paid tier, billed annually. | — |

Subscription plan history tracking lives in `subscription_plan_history` — see `subscription-plan-history.md`.

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

**`subscription_plan_history.userId` → `users.id`** (foreign key, reverse direction): each
`subscription_plan_history` row belongs to one user. See `subscription-plan-history.md`.

**`subscriptions.userId` → `users.id`** (foreign key, reverse direction): each Razorpay-backed
`subscriptions` row belongs to one user, via the reverse relation `User.subscriptions
Subscription[]`. See `../payments/subscription-reconciliation.md` for the full design —
the `subscriptions` table does not yet have a dedicated file in this `database/` folder.

**`user_preference.userId` → `users.id`** (foreign key, reverse direction): each
`user_preference` row (country/locale/theme) belongs to one user, via the reverse relation
`User.userPreferences UserPreference[]`. See `user-preference.md`.

`users`, `subscription_plans`, `auth_platforms`, `subscription_plan_history`, `subscriptions`,
`processed_webhook_events`, `user_preference`, and `nav_config` are the eight tables in the
database. Of these, `subscriptions` and `processed_webhook_events` are documented by design
in `../payments/subscription-reconciliation.md` rather than as standalone table-reference
files here.

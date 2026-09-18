# Unlock / Passphrase API

> Read `../screens/02 Passphrase.md` for the full UI flow this endpoint drives. This doc
> covers the API surface only, in the same Swagger-UI-style layout as `user-creation-api.md`.

**Base path:** `/api/auth`
**Tags:** `Unlock`

---

## Scope note

WealthVault has no separate "sign up with a passphrase" and "log in with a passphrase"
endpoint — there is exactly **one** route, `POST /api/auth/unlock`, and it silently
branches into a first-time (create) or returning (verify) path based on whether the
signed-in user's `verifier` column is currently `NULL`. The client cannot request one
path or the other — the server decides, and tells the client which one happened via the
`firstTime` field in the response.

This route runs *after* OAuth sign-in (see `user-creation-api.md`) — it requires an
existing session (`session.userId`), not a fresh identity. It is the second of two
distinct authentication steps: OAuth proves *who you are*, this endpoint proves *you know
the vault passphrase*.

---

## Paths

### `POST /api/auth/unlock`

**Summary:** Verify a returning user's passphrase, or establish a first-time user's passphrase
**Tags:** `Unlock`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie; must contain `userId` (set by any OAuth callback route). Missing or expired → `401`. |

**Request body** — `application/json`

| Field | Type | Required | Description |
|---|---|---|---|
| `passphrase` | string | yes | The vault passphrase, plaintext, sent once over HTTPS. Never persisted as plaintext anywhere — see **Schemas**. |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | `{ "success": true, "firstTime": boolean }` | Passphrase accepted — see [`UnlockResult` schema](#unlockresult-schema) for what `firstTime` means and what was written |
| `400` | `{ "error": "Passphrase required" }` | Request body had no `passphrase` field (or it was falsy) |
| `400` | `{ "error": "<first failed rule's message>" }` | **First-time only** — the passphrase failed server-side strength validation. See [Passphrase strength errors](#passphrase-strength-errors) |
| `401` | `{ "error": "Unauthorized" }` | No valid session (`session.userId` missing) |
| `401` | `{ "error": "Invalid passphrase" }` | **Returning user only** — the derived key didn't match the stored verifier |
| `404` | `{ "error": "User not found" }` | `session.userId` doesn't correspond to any row in `users` (stale session after account deletion) |
| `500` | `{ "error": "Failed to unlock" }` | Any unhandled exception (top-level `try/catch` in the route) |

---

## Passphrase strength errors

Only checked server-side on the **first-time** path (a returning user's passphrase is
compared against the verifier, never re-validated for strength). The `400` response's
`error` field is the *first* of these that fails, in this order:

| Rule | Error message |
|---|---|
| At least 12 characters | `Passphrase must be at least 12 characters` |
| Contains a letter and a number | `Passphrase must contain a letter and a number` |
| At least 2 uppercase letters | `Passphrase must contain at least two uppercase letters` |
| At least 2 special (non-alphanumeric) characters | `Passphrase must contain at least two special characters` |
| 256 characters or fewer | `Passphrase must be 256 characters or fewer` |

The client-side UI (`src/app/unlock/page.tsx`) enforces the identical five rules live as
the user types and disables the submit button until all pass — so in normal use this
`400` is unreachable through the UI. It only fires if something bypasses the client check
(a direct API call, or a client/server validation-logic drift, since the two are
maintained as separate parallel implementations — see `../screens/02 Passphrase.md`).

---

## Schemas

### `UnlockResult` schema

```typescript
// Always present on 200:
{ success: true, firstTime: boolean }
```

`firstTime` reflects the state of `user.verifier` **before** this request (`!user.verifier`
evaluated on the row fetched at the start of the handler) — not whether the row was *just*
created. It is `true` exactly once per user: the very first successful unlock. Every
subsequent unlock for that user returns `firstTime: false`.

### Key derivation and verifier mechanics

Neither the passphrase nor a directly-reusable key is ever stored. What actually happens,
in `src/lib/services/EncryptionService.ts` (thin wrapper around `src/lib/encryption.ts`):

```typescript
const keyHex = deriveKey(passphrase)        // scrypt-derived key, hex-encoded

// First-time only:
const verifier = encrypt("PORTFOLIO_APP_V1", keyHex)   // AES-256-GCM
// → written to users.verifier

// Returning only:
const isMatch = decrypt(user.verifier, keyHex) === "PORTFOLIO_APP_V1"
// → true/false; decrypt() returning garbage or throwing both count as false
```

`keyHex` — the derived key, not the passphrase — is written to `session.encryptionKey`
(the iron-session cookie) on success, in both the first-time and returning cases. This is
the "vault unlock" state the rest of the app checks for. It expires with the session
(8 hours) or on sign-out (`session.destroy()`), whichever comes first.

---

## Database effect

This is the answer to "does this endpoint touch the database, and does the schema need to
change": **yes, it touches the database, and no, the schema does not need to change** —
`users.verifier` already exists for exactly this purpose and required no modification.

| Case | Database write |
|---|---|
| First-time, valid passphrase | `UPDATE users SET verifier = <new AES-256-GCM blob> WHERE id = :userId` |
| First-time, invalid passphrase (400) | None — fails before the update |
| Returning, correct passphrase | None — `verifier` is read and compared, never rewritten |
| Returning, wrong passphrase (401) | None |
| Any error path (401/404/500) | None |

No other column on `users` is touched by this route, and it does **not** touch
`auth_platformId`, `subscriptionPlanId`, `subscription_plans`, `auth_platforms`, or
`subscription_plan_history` — those are unrelated to passphrase/vault state. There is no
database transaction wrapping the `verifier` write itself; it's a single statement, so
there's no partial-write case to worry about for that column.

**Subscription reconciliation, on every successful unlock (200 only):** after
`session.encryptionKey` is set — both the first-time and returning-user paths —
this route also calls `reconcileSupersedingSubscriptions({ userId })`
(`src/lib/services/SubscriptionService.ts`), which can read and conditionally write the
`subscriptions` table (resolving a pending plan-change row whose `startAt` has passed) and
call out to the Razorpay API. This does not affect the `200` response body or timing
contract described above — it runs synchronously before the response is returned, so a
resolved plan state is guaranteed visible on the very next page load. See
`../payments/subscription-reconciliation.md` (Part 4) for the full design; this is *not*
run on any error path (400/401/404/500), only on a successful unlock.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/auth/unlock/route.ts` | `POST /api/auth/unlock` |
| `src/lib/services/EncryptionService.ts` | `deriveKey`/`createVerifier`/`verifyKey` — thin wrapper around `src/lib/encryption.ts` |
| `src/lib/validation/passphraseValidation.ts` | `validatePassphrase()` — the five server-side strength rules |
| `src/lib/services/SubscriptionService.ts` | `reconcileSupersedingSubscriptions()` — called on every successful unlock, see **Database effect** |
| `src/lib/session.ts` | `getSession()` — reads `userId`, writes `encryptionKey` on success |
| `src/app/unlock/page.tsx` | The screen that calls this route — see `../screens/02 Passphrase.md` |

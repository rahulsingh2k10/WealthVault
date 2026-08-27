# User Creation API (OAuth Sign-In)

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Parameters →
> Responses → Schemas) even though no `openapi.yaml` exists for it. See **Scope note**.

**Base path:** `/api/auth`
**Tags:** `Google` · `Apple` · `X (Twitter)` · `LinkedIn` · `Related`

---

## Scope note

WealthVault does not expose a single conventional JSON endpoint for "create a user."
Instead, a user row is created (or updated, on repeat login) as a side effect of a
successful OAuth sign-in — the callback route for whichever provider the user signed in
with performs a Prisma `upsert` directly against the `users` table. This document treats
the eight routes below (four "initiate" + four "callback") as the API surface that
ultimately adds a user to the database.

If you meant a different endpoint, see **Related endpoints** at the bottom.

---

## Overview

```
User clicks "Sign in with <Provider>"
  │
  ▼
GET /api/auth/<provider>            ← builds the provider's OAuth URL, sets oauth_state cookie
  │                                    (X also sets a PKCE x_code_verifier cookie)
  ▼
Browser redirects to <provider>'s consent screen
  │
  ▼
Provider redirects back to /api/auth/<provider>/callback
  │                                    (Apple posts here as multipart form data; the
  │                                     other three arrive as a GET with query params)
  ▼
1. Verify CSRF state cookie matches the state param
2. Exchange the authorization code for an access/id token
3. Fetch the user's profile from the provider
4. prisma.user.upsert(...)           ← THE operation that adds/updates the users row
5. Write session.userId / userName / userEmail / userAvatar, session.save()
6. Delete the oauth_state (and x_code_verifier) cookie
  │
  ▼
302 redirect to /unlock
```

All four providers follow the same shape. The four callback routes call
`prisma.user.upsert(...)` **directly** — none of them go through
`src/lib/repositories/UserRepository.ts`, even though that class implements the same
`upsert` operation. `UserRepository` currently has no callers anywhere in the app except
its own test (`__tests__/repositories/UserRepository.test.ts`); it's effectively dead code
today. Worth knowing if you're about to "fix a bug" in `UserRepository` expecting it to
affect login — it won't.

---

## Paths

### `GET /api/auth/google`

**Summary:** Start Google OAuth sign-in
**Tags:** `Google`

| Parameters | — none — |
|---|---|

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Redirect to Google's consent screen | `Set-Cookie: oauth_state=<token>; HttpOnly; Max-Age=600` |

---

### `GET /api/auth/google/callback`

**Summary:** Complete Google OAuth sign-in and upsert the user row
**Tags:** `Google`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `code` | query | string | yes | Authorization code from Google |
| `state` | query | string | yes | Must match the `oauth_state` cookie (CSRF check) |
| `error` | query | string | no | Present if the user declined consent |
| `oauth_state` | cookie | string | yes | Set by `GET /api/auth/google` |

**Profile fetch (server-side, not client-visible):** `GET https://www.googleapis.com/oauth2/v3/userinfo` → `email` (→ `username`), `given_name`/`family_name` (→ `fullName`), `picture` (→ `avatar`)

**Database effect:** see [`UpsertUserInput`](#upsertuserinput-schema) — `platformId` set to the `GOOGLE` row's id, `avatar` set.

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Success → redirect to `/unlock` | See [Success response](#success-response-all-callback-routes) |
| `302` | Failure → redirect to `/?error=<code>` | See [Error codes](#error-codes-all-callback-routes) |

---

### `GET /api/auth/apple`

**Summary:** Start Apple OAuth sign-in
**Tags:** `Apple`

| Parameters | — none — |
|---|---|

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Redirect to Apple's consent screen (`response_mode=form_post`) | `Set-Cookie: oauth_state=<token>; HttpOnly; Max-Age=600` |

---

### `POST /api/auth/apple/callback`

**Summary:** Complete Apple OAuth sign-in and upsert the user row
**Tags:** `Apple`

> Apple is the one provider that calls its callback with `POST` + form-encoded body
> instead of a `GET` + query string, per Apple's `response_mode=form_post` requirement.

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `oauth_state` | cookie | string | yes | Set by `GET /api/auth/apple` |

**Request body** — `application/x-www-form-urlencoded`

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | string | yes | Authorization code from Apple |
| `state` | string | yes | Must match the `oauth_state` cookie |
| `error` | string | no | Present if the user declined consent |
| `user` | string (JSON) | no | Sent **only on the user's first-ever authorization**; contains `name.firstName`/`name.lastName` |

**Profile fetch:** decoded `id_token` JWT `email` claim (→ `username`, falls back to `apple_{sub}@apple.com` since Apple omits `email` on repeat logins) + the one-time `user` field (→ `fullName`, first login only)

**Database effect:** see [`UpsertUserInput`](#upsertuserinput-schema) — `platformId` set to the `APPLE` row's id, `avatar` **never** set (Apple exposes no profile picture).

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Success → redirect to `/unlock` | See [Success response](#success-response-all-callback-routes) |
| `302` | Failure → redirect to `/?error=<code>` | See [Error codes](#error-codes-all-callback-routes) |

---

### `GET /api/auth/x`

**Summary:** Start X (Twitter) OAuth sign-in
**Tags:** `X (Twitter)`

| Parameters | — none — |
|---|---|

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Redirect to X's consent screen | `Set-Cookie: oauth_state=<token>; HttpOnly; Max-Age=600`<br>`Set-Cookie: x_code_verifier=<verifier>; HttpOnly; Max-Age=600` (PKCE, S256) |

---

### `GET /api/auth/x/callback`

**Summary:** Complete X OAuth sign-in and upsert the user row
**Tags:** `X (Twitter)`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `code` | query | string | yes | Authorization code from X |
| `state` | query | string | yes | Must match the `oauth_state` cookie |
| `error` | query | string | no | Present if the user declined consent |
| `oauth_state` | cookie | string | yes | Set by `GET /api/auth/x` |
| `x_code_verifier` | cookie | string | yes | PKCE verifier; request fails without it |

**Profile fetch:** `GET https://api.twitter.com/2/users/me` → `username` handle (→ `username`, **not** an email), `name` (→ `fullName`), `profile_image_url` (→ `avatar`)

**Database effect:** see [`UpsertUserInput`](#upsertuserinput-schema) — `platformId` set to the `X` row's id, `avatar` set. Note `username` is the bare X handle here, not an email, since X's API doesn't expose the account's email address.

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Success → redirect to `/unlock` | See [Success response](#success-response-all-callback-routes) |
| `302` | Failure → redirect to `/?error=<code>` | See [Error codes](#error-codes-all-callback-routes) |

---

### `GET /api/auth/linkedin`

**Summary:** Start LinkedIn OAuth sign-in
**Tags:** `LinkedIn`

| Parameters | — none — |
|---|---|

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Redirect to LinkedIn's consent screen | `Set-Cookie: oauth_state=<token>; HttpOnly; Max-Age=600` |

---

### `GET /api/auth/linkedin/callback`

**Summary:** Complete LinkedIn OAuth sign-in and upsert the user row
**Tags:** `LinkedIn`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `code` | query | string | yes | Authorization code from LinkedIn |
| `state` | query | string | yes | Must match the `oauth_state` cookie |
| `error` | query | string | no | Present if the user declined consent |
| `oauth_state` | cookie | string | yes | Set by `GET /api/auth/linkedin` |

**Profile fetch:** `GET https://api.linkedin.com/v2/userinfo` (OIDC) → `email` (→ `username`), `given_name`/`family_name` (→ `fullName`), `picture` (→ `avatar`)

**Database effect:** see [`UpsertUserInput`](#upsertuserinput-schema) — `platformId` set to the `LINKEDIN` row's id, `avatar` set.

**Responses**

| Status | Description | Headers |
|---|---|---|
| `302` | Success → redirect to `/unlock` | See [Success response](#success-response-all-callback-routes) |
| `302` | Failure → redirect to `/?error=<code>` | See [Error codes](#error-codes-all-callback-routes) |

---

## Common responses

### Success response (all callback routes)

```
HTTP/1.1 302 Found
Location: /unlock
Set-Cookie: portfolio_session=<sealed iron-session token>; HttpOnly; SameSite=Lax; Max-Age=28800
Set-Cookie: oauth_state=; Max-Age=0                 ← cookie cleared
Set-Cookie: x_code_verifier=; Max-Age=0             ← X only, cookie cleared
```

The session cookie (via `src/lib/session.ts`) encodes:

```typescript
{
  userId:     string   // the User.id of the row just created/updated
  userName:   string   // User.fullName
  userEmail:  string   // User.username
  userAvatar: string   // provider avatar URL, or "" for Apple/X-without-image
}
```

`subscription` is **not** placed in the session — the client reads the current
subscription tier separately, via `GET /api/auth/me`.

### Error codes (all callback routes)

On any failure, every callback route redirects — still a `302`, never a JSON error body.
In every case below, **no row is created or modified**: the `upsert` call is never
reached, or its result is discarded because the route already returned.

| Redirect target | When |
|---|---|
| `/?error=access_denied` (or whatever code the provider sent) | User declined consent on the provider's screen |
| `/?error=missing_params` | Callback arrived without `code` or `state` |
| `/?error=invalid_state` | `state` didn't match the `oauth_state` cookie (CSRF check failed), or X's `x_code_verifier` cookie was missing |
| `/?error=token_exchange_failed` | The provider rejected the authorization code |
| `/?error=invalid_user_info` | The provider's profile endpoint didn't return the required fields (Google/X/LinkedIn only — Apple has no equivalent check) |
| `/?error=server_error` | Any unhandled exception, including a failed `prisma.user.upsert` |

---

## Schemas

### `UpsertUserInput` schema

Each callback route first looks up its own fixed `AuthPlatform` row and the `FREE`
`SubscriptionPlan` row by their unique enum value (not a hardcoded id, since ids aren't
guaranteed stable across reseeds), then makes the same shape of `upsert` call:

```typescript
const freePlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { tier: "FREE" } });
const platform = await prisma.authPlatform.findUniqueOrThrow({ where: { platform: "<PROVIDER>" } });

const user = await prisma.user.upsert({
  where: { username: <provider-derived identity string> },
  update: { fullName, platformId: platform.id, avatar /* Google/LinkedIn/X only */ },
  create: {
    username: <provider-derived identity string>,
    fullName,
    platformId: platform.id,         // FK to auth_platforms.id
    avatar,                          // omitted entirely for Apple
    subscriptionPlanId: freePlan.id, // every new user starts on the Free tier
  },
})
```

**On `create`** (new `username`, i.e. first time this identity has signed in):

| Column | Value on creation |
|---|---|
| `id` | auto-generated `uuid()` |
| `fullName` | from the provider profile |
| `username` | the provider-derived identity string (email, or X handle) |
| `platformId` | FK to `auth_platforms.id`, resolved from `"GOOGLE"` / `"APPLE"` / `"X"` / `"LINKEDIN"` |
| `avatar` | provider's profile picture URL, or `undefined` (omitted) — Apple never sets this |
| `subscriptionPlanId` | FK to `subscription_plans.id`, always the `FREE` row — no route ever creates a user on a paid tier |
| `verifier` | not set — remains `NULL` (first-time vault setup happens later, in `/api/auth/unlock`) |
| `createdAt` / `updatedAt` | set automatically by Prisma |

**On `update`** (returning user, `username` already exists) — only `fullName`, `platformId`,
and (for Google/LinkedIn/X) `avatar` are refreshed. `subscriptionPlanId` is **not** touched
on update, so a returning user keeps whatever tier they're on — logging in again never
resets a paid subscription back to Free.

---

## Related endpoints

Out of scope for this doc, but adjacent to the flow above:

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/auth/me` | Reads the current user (including `subscription`) for the frontend; does not write to the `users` table. |
| `POST` | `/api/auth/unlock` | Writes the `verifier` column onto an *existing* user row (first-time passphrase setup) or verifies it (returning user). Fully documented in `api/unlock-api.md` and `screens/02 Passphrase.md`. Closest thing in the app to a traditional "set credentials" endpoint. |
| `PATCH` | `/api/auth/avatar` | Updates `user.avatar` after initial signup. |
| `POST` | `/api/auth/signout` | Clears the session cookie; no DB write. |

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/auth/google/route.ts` | `GET /api/auth/google` |
| `src/app/api/auth/google/callback/route.ts` | `GET /api/auth/google/callback` |
| `src/app/api/auth/apple/route.ts` | `GET /api/auth/apple` |
| `src/app/api/auth/apple/callback/route.ts` | `POST /api/auth/apple/callback` |
| `src/app/api/auth/x/route.ts` | `GET /api/auth/x` |
| `src/app/api/auth/x/callback/route.ts` | `GET /api/auth/x/callback` |
| `src/app/api/auth/linkedin/route.ts` | `GET /api/auth/linkedin` |
| `src/app/api/auth/linkedin/callback/route.ts` | `GET /api/auth/linkedin/callback` |
| `src/lib/session.ts` | iron-session config used to set the post-login session cookie |
| `src/lib/prisma.ts` | Shared `PrismaClient` singleton used by all four callback routes |
| `prisma/schema.prisma` | Defines the `users` table — see `database/users.md` |

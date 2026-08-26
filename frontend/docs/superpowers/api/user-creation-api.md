# API: User Account Creation (OAuth Sign-In)

> Read `screens/00-global-architecture.md` first for overall app context.

## Scope note

WealthVault does not expose a single conventional JSON endpoint for "create a user."
Instead, a user row is created (or updated, on repeat login) as a side effect of a
successful OAuth sign-in — the callback route for whichever provider the user signed in
with performs a Prisma `upsert` directly against the `users` table. This document treats
those four callback routes as "the API that adds a user to the database," since that is
the operation that actually inserts rows.

If you meant a different endpoint (e.g. `/api/auth/unlock`, which writes the passphrase
verifier onto an *existing* user row), see the **Related endpoints** section at the bottom
— that flow is already documented in detail in `screens/02-unlock.md`.

---

## File Map

| File | Role |
|------|------|
| `src/app/api/auth/google/route.ts` | GET — starts the Google OAuth redirect, sets CSRF `oauth_state` cookie |
| `src/app/api/auth/google/callback/route.ts` | GET — exchanges code for tokens, **upserts the user row**, starts session |
| `src/app/api/auth/apple/route.ts` | GET — starts the Apple OAuth redirect |
| `src/app/api/auth/apple/callback/route.ts` | POST — exchanges code for tokens, **upserts the user row**, starts session |
| `src/app/api/auth/x/route.ts` | GET — starts the X (Twitter) OAuth redirect, adds PKCE `x_code_verifier` cookie |
| `src/app/api/auth/x/callback/route.ts` | GET — exchanges code for tokens, **upserts the user row**, starts session |
| `src/app/api/auth/linkedin/route.ts` | GET — starts the LinkedIn OAuth redirect |
| `src/app/api/auth/linkedin/callback/route.ts` | GET — exchanges code for tokens, **upserts the user row**, starts session |
| `src/lib/session.ts` | iron-session config used to set the post-login session cookie |
| `src/lib/prisma.ts` | Shared `PrismaClient` singleton used by all four callback routes |
| `prisma/schema.prisma` | Defines the `users` table — see `database/users-table.md` |

All four providers follow the same shape. The four callback routes call
`prisma.user.upsert(...)` **directly** — none of them go through
`src/lib/repositories/UserRepository.ts`, even though that class implements the same
`upsert` operation. `UserRepository` currently has no callers anywhere in the app except
its own test (`__tests__/repositories/UserRepository.test.ts`); it's effectively dead code
today. Worth knowing if you're about to "fix a bug" in `UserRepository` expecting it to
affect login — it won't.

---

## How it works (all four providers)

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

If anything fails at any step (user denies consent, state mismatch, token exchange fails,
provider returns incomplete profile data, or an unexpected exception), the route redirects
to `/?error=<code>` instead and **no database write happens**. See the error table below.

---

## Request

### Initiating the flow

| Method | Route | Query/Body | Notes |
|--------|-------|------------|-------|
| GET | `/api/auth/google` | none | Sets `oauth_state` cookie (httpOnly, 10 min TTL), redirects to Google's consent screen |
| GET | `/api/auth/apple` | none | Sets `oauth_state` cookie, redirects to Apple's consent screen (`response_mode=form_post`) |
| GET | `/api/auth/x` | none | Sets `oauth_state` **and** `x_code_verifier` cookies (PKCE, S256), redirects to X's consent screen |
| GET | `/api/auth/linkedin` | none | Sets `oauth_state` cookie, redirects to LinkedIn's consent screen |

### The callback request (what actually triggers the DB write)

| Provider | Method | Content-Type | Fields the route reads |
|----------|--------|--------------|-------------------------|
| Google | GET | query string | `code`, `state`, `error?` |
| Apple | **POST** | `application/x-www-form-urlencoded` | `code`, `state`, `error?`, `user?` (JSON string, first login only) |
| X | GET | query string | `code`, `state`, `error?` |
| LinkedIn | GET | query string | `code`, `state`, `error?` |

Every route re-verifies the `state` value against the `oauth_state` cookie it set earlier
(CSRF protection) before doing anything else. X additionally requires the
`x_code_verifier` cookie (PKCE) to exchange the code.

After the code is exchanged for a token, each route calls the provider's profile endpoint
to get the identity that becomes the `upsert` input:

| Provider | Profile source | Fields used |
|----------|----------------|-------------|
| Google | `GET https://www.googleapis.com/oauth2/v3/userinfo` | `email` (→ `username`), `given_name`/`family_name` (→ `fullName`), `picture` (→ `avatar`) |
| Apple | Decoded `id_token` JWT + the one-time `user` form field | `email` claim (→ `username`, falls back to `apple_{sub}@apple.com`), `user.name.firstName`/`lastName` (→ `fullName`, first login only) |
| X | `GET https://api.twitter.com/2/users/me` | `username` handle (→ `username`, no `@`/domain), `name` (→ `fullName`), `profile_image_url` (→ `avatar`) |
| LinkedIn | `GET https://api.linkedin.com/v2/userinfo` (OIDC) | `email` (→ `username`), `given_name`/`family_name` (→ `fullName`), `picture` (→ `avatar`) |

`username` is the column that identifies a user uniquely across every provider (see
`database/users-table.md`) — it is always an email address, **except** for X, which uses
the bare handle since X's API doesn't expose the account's email.

---

## The database write

Every callback route makes the same shape of call:

```typescript
const user = await prisma.user.upsert({
  where: { username: <provider-derived identity string> },
  update: { fullName, platform: "<Provider>", avatar /* Google/LinkedIn/X only */ },
  create: {
    username: <provider-derived identity string>,
    fullName,
    platform: "<Provider>",     // "Google" | "Apple" | "X" | "LinkedIn"
    avatar,                     // omitted entirely for Apple
    subscription: "FREE",       // every new user starts on the Free tier
  },
})
```

**On `create`** (new `username`, i.e. first time this identity has signed in) — a new row
is inserted with:

| Column | Value on creation |
|--------|--------------------|
| `id` | auto-generated `cuid()` |
| `fullName` | from the provider profile |
| `username` | the provider-derived identity string (email, or X handle) |
| `platform` | the literal string `"Google"` / `"Apple"` / `"X"` / `"LinkedIn"` |
| `avatar` | provider's profile picture URL, or `undefined` (omitted) — Apple never sets this |
| `subscription` | always `"FREE"` — no route ever creates a user on a paid tier |
| `subscriptionStartDate`, `subscriptionEndDate` | not set — remain `NULL` |
| `verifier` | not set — remains `NULL` (first-time vault setup happens later, in `/api/auth/unlock`) |
| `createdAt` / `updatedAt` | set automatically by Prisma |

**On `update`** (returning user, `username` already exists) — only `fullName`, `platform`,
and (for Google/LinkedIn/X) `avatar` are refreshed. `subscription` is **not** touched on
update, so a returning user keeps whatever tier they're on — logging in again never resets
a paid subscription back to Free.

---

## Response

None of these routes return JSON. On success, the browser receives an HTTP redirect and a
new session cookie:

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

Nothing about `subscription` is placed in the session — the client learns the current
subscription tier separately, via `GET /api/auth/me` (see `screens/02-unlock.md` and
`screens/01 Landing Page.md`).

### Error responses

On any failure, the route redirects instead — still a `302`, never a JSON error body:

| Redirect target | When |
|---|---|
| `/?error=access_denied` (or whatever code the provider sent) | User declined consent on the provider's screen |
| `/?error=missing_params` | Callback arrived without `code` or `state` |
| `/?error=invalid_state` | `state` didn't match the `oauth_state` cookie (CSRF check failed), or X's `x_code_verifier` cookie was missing |
| `/?error=token_exchange_failed` | The provider rejected the authorization code |
| `/?error=invalid_user_info` | The provider's profile endpoint didn't return the required fields (Google/X/LinkedIn only — Apple has no equivalent check) |
| `/?error=server_error` | Any unhandled exception, including a failed `prisma.user.upsert` |

In every error case above, **no row is created or modified** — the `upsert` call is never
reached, or its result is discarded because the route already returned.

---

## Related endpoints

- **`GET /api/auth/me`** — reads the current user (including `subscription`) for the
  frontend; does not write to the `users` table. See `frontend/src/app/api/auth/me/route.ts`.
- **`POST /api/auth/unlock`** — writes the `verifier` column onto an *existing* user row
  (first-time passphrase setup) or verifies it (returning user). Fully documented in
  `screens/02-unlock.md`. This is the closest thing in the app to a traditional
  "set credentials" endpoint, if that's what you were actually looking for.
- **`PATCH /api/auth/avatar`** — updates `user.avatar` after initial signup.
- **`POST /api/auth/signout`** — clears the session cookie; no DB write.

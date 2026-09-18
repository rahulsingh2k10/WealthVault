# Sign Out API

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Responses),
> in the same style as `user-creation-api.md` and `unlock-api.md`.

**Base path:** `/api/auth`
**Tags:** `Session`

---

## Scope note

A single route ends a session: `POST /api/auth/signout`. It requires no request body and
no prior authentication check — there is no session state to validate beforehand, so it
always succeeds. Called from three places: the sidebar's "Sign out" pill (shown on every
authenticated page — `Sidebar.tsx`), the unlock screen's own "Sign out" button, and the
unlock screen's auto-signout when it detects a stale session (a `userId` cookie whose user
row no longer exists in the database).

---

## Paths

### `POST /api/auth/signout`

**Summary:** End the current session
**Tags:** `Session`

| Parameters | — none — |
|---|---|

**Request body** — none

**Responses**

| Status | Body | Headers |
|---|---|---|
| `200` | `{ "success": true }` | `Set-Cookie: portfolio_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` |

---

## Schemas

### `SignOutResult` schema

```typescript
{ success: true }
```

Always this exact shape — there is no error path for this route.

---

## What this clears

`session.destroy()` (`src/lib/session.ts`, via `iron-session`) empties the sealed
`portfolio_session` cookie's contents in one call:

| Field | Before | After |
|---|---|---|
| `userId` | set | cleared |
| `userName` | set | cleared |
| `userEmail` | set | cleared |
| `userAvatar` | set | cleared |
| `encryptionKey` | set, if the vault was unlocked | cleared |

The response's `Set-Cookie` header expires the cookie immediately (`Max-Age=0`) rather
than leaving a sealed-but-empty cookie behind.

---

## Database effect

None. This route never reads or writes any table — it only clears the session cookie.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/api/auth/signout/route.ts` | `POST /api/auth/signout` |
| `src/lib/session.ts` | `getSession()` — the `iron-session` wrapper this route calls `.destroy()` on |
| `src/components/layout/Sidebar.tsx` | Calls this route from the "Sign out" pill shown on every authenticated page |
| `src/app/unlock/page.tsx` | Calls this route from its own "Sign out" button and from its stale-session auto-signout |

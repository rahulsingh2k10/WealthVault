# Dashboard API

> Reference format: this doc mirrors an OpenAPI/Swagger UI layout (Paths → Responses),
> in the same style as `unlock-api.md`, `signout-api.md`, and `avatar-api.md`.

**Base path:** `/`
**Tags:** `Dashboard`

---

## Scope note

`GET /dashboard` is a page route, not a JSON API — it's documented here because access
to it is gated by the same session mechanism as the rest of the app, and its behavior
(redirect vs. render) is worth specifying precisely, the same way the other protected
routes in this project are.

The gate itself lives in `frontend/src/middleware.ts`, not in the page component. The
page component (`src/app/dashboard/page.tsx`) does repeat the `encryptionKey` check on
its own (`if (!session.encryptionKey) redirect('/unlock')`), but in normal operation the
middleware has already redirected away before that line ever runs — it's a second,
defensive check, not the primary gate.

---

## Paths

### `GET /dashboard`

**Summary:** Load the dashboard page
**Tags:** `Dashboard`

**Parameters**

| Name | In | Type | Required | Description |
|---|---|---|---|---|
| `portfolio_session` | cookie | string | yes | iron-session cookie. Absence or missing `encryptionKey` changes the response — see **Responses**. |

**Responses**

| Status | Body | When |
|---|---|---|
| `200` | HTML page | `userId` and `encryptionKey` both present — vault is unlocked |
| `307` | — (`Location: /`) | No `userId` at all — never signed in, or session expired |
| `307` | — (`Location: /unlock`) | `userId` present but no `encryptionKey` — signed in, vault locked |

All three outcomes are decided by `middleware.ts` before the page component's own code
runs, using the exact same `getSessionData()`/`unsealData()` check every other protected
route in the app uses.

---

## Current page content

On a `200`, the response renders `AppShell` (sidebar + header, shared with the rest of
the authenticated app) with an intentionally blank content area:

```typescript
export default async function DashboardPage() {
  const session = await getSession()
  if (!session.encryptionKey) redirect('/unlock')

  return <AppShell title="Dashboard">{null}</AppShell>
}
```

The sidebar and header are independently functional — the sidebar makes its own
client-side calls to `/api/auth/me` (to show the signed-in user) and `/api/nav` (to
populate its nav list). Neither call originates from this page or blocks its render.

---

## Database effect

None. This route never queries or writes to any table — it only reads the session
cookie via `getSession()`.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/dashboard/page.tsx` | `GET /dashboard` |
| `src/middleware.ts` | The actual auth gate — decides `/`, `/unlock`, or pass-through before the page runs |
| `src/components/layout/AppShell.tsx` | Shared authenticated-app shell (sidebar + header) this page renders into |
| `src/lib/session.ts` | `getSession()` — reads `userId`/`encryptionKey` from the sealed cookie |

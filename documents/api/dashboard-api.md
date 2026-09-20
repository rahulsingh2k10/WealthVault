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
shared layout every authenticated route renders through
(`src/app/(app)/layout.tsx`) repeats the `encryptionKey` check on its own
(`if (!session.encryptionKey || !session.userId) redirect('/unlock')`), but in normal
operation the middleware has already redirected away before that line ever runs — it's a
second, defensive check, not the primary gate. This layout-level check is shared by every
route under the `(app)` route group, not written per-page.

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

On a `200`, the response renders inside `AppShell` (sidebar + header, shared with the
rest of the authenticated app via `src/app/(app)/layout.tsx`). The page itself renders
one conditional element — an upgrade prompt for free-tier users — and nothing else:

```typescript
export default async function DashboardPage() {
  const session = await getSession()
  const prompt = await getUpgradePromptData(session.userId)

  return (
    <>
      {prompt && <UpgradePrompt plans={prompt.plans} memberCount={prompt.memberCount} />}
    </>
  )
}
```

`getUpgradePromptData` (`src/lib/services/UpgradePromptService.ts`) returns `null` — and
the page renders nothing — when `session.userId` is missing, when it matches no `users`
row, or when the user's effective plan tier isn't `FREE`
(`getEffectivePlan(userId).tier !== "FREE"`). For a `FREE`-tier user it returns the active
paid plans (`MONTHLY`/`QUARTERLY`/`ANNUAL`) as view models plus a member count (paid users,
floored to the nearest hundred, `null` if 100 or fewer), which `UpgradePrompt`
(`src/components/dashboard/UpgradePrompt.tsx`) renders as a modal. There is no other
dashboard content — no widgets, charts, or portfolio summary render on this route today.

The sidebar and the floating category menu are independently functional — `Sidebar`
makes its own client-side call to `/api/auth/me` (to show the signed-in user), and
`CategoryMenuBar` makes its own call to `/api/nav` (to populate the category menu).
Neither call originates from this page or blocks its render.

---

## Database effect

Read-only. `getUpgradePromptData` queries `users` (`findUnique` by `id`, and `count` of
users on a non-`FREE` plan) and `subscription_plans` (`findMany` of active, non-`FREE`
plans), plus whatever `getEffectivePlan` reads to resolve the user's current plan — see
`../payments/subscription-reconciliation.md`. This route never writes to any table.

---

## Implementation notes

| File | Role |
|---|---|
| `src/app/(app)/dashboard/page.tsx` | `GET /dashboard` |
| `src/app/(app)/dashboard/loading.tsx` | Suspense fallback shown while the page's server data resolves |
| `src/app/(app)/layout.tsx` | Shared layout for every `(app)` route — the defensive `encryptionKey` check and the `AppShell` wrap live here, not per-page |
| `src/middleware.ts` | The actual auth gate — decides `/`, `/unlock`, or pass-through before the page runs |
| `src/components/layout/AppShell.tsx` | Shared authenticated-app shell (`Sidebar` + `CategoryMenuBar` + `RenewalBanner`) this page renders into |
| `src/lib/services/UpgradePromptService.ts` | `getUpgradePromptData()` — builds the free-tier upgrade prompt's view model |
| `src/components/dashboard/UpgradePrompt.tsx` | Renders the upgrade prompt modal |
| `src/lib/session.ts` | `getSession()` — reads `userId`/`encryptionKey` from the sealed cookie |

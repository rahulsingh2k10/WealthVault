# Sign-Out Theme Reset — Design

**Date:** 2026-09-09

## Problem

The theme (`dark` / `light`) is applied by next-themes and persisted per-user in
the `user_preference` table. On sign-in, `PreferencesSync` reads
`GET /api/preferences` and calls `setTheme(prefs.theme)`. The Dark/Light pill
(`ThemeTogglePill`) and the `/settings` page (`SettingsPanel`) write an explicit
`"dark"` / `"light"` to both next-themes (localStorage key `theme`) and the DB.

Sign-out (`POST /api/auth/signout`) only destroys the session. Nothing touches
the theme, so the last explicit `"dark"` / `"light"` value stays in localStorage
and keeps overriding the OS on the signed-out landing page and `/unlock`.
Additionally `ThemeProvider` uses `defaultTheme="dark"`, so a visitor who has
never signed in is also forced into dark mode regardless of their OS setting.

## Goal

1. On sign-out, stop applying the user's saved theme locally and fall back to the
   OS `prefers-color-scheme` (light OS → light app, dark OS → dark app).
2. Make every signed-out state OS-driven, including never-signed-in visitors.
3. Leave the user's saved theme in the `user_preference` table untouched —
   `PreferencesSync` restores it on the next sign-in, and `/settings` still shows
   their choice.

Non-goals: changing the `/api/preferences` API or the `signout` route;
deleting the DB theme row; adding a "System" option to the theme UI; centralizing
the three sign-out flows into a shared hook; changing lock behavior
(`/api/auth/lock` keeps the session and is out of scope).

---

## Mechanism

next-themes already models this: with `enableSystem`, setting the theme to
`"system"` makes the app follow the OS `prefers-color-scheme` and stores
`"system"` in localStorage (replacing any explicit `"dark"` / `"light"`).
"Remove the theme setting → follow the system" therefore means calling
`setTheme("system")`.

---

## 1. Default theme → `"system"`

`frontend/src/app/layout.tsx` — change the `ThemeProvider` prop:

```
defaultTheme="dark"   →   defaultTheme="system"
```

`enableSystem` is already set. Effect: any client with no stored theme (a fresh
visitor, or one whose stored value is `"system"`) follows the OS. Authenticated
users are unaffected — `PreferencesSync` sets an explicit value from the DB on
mount.

## 2. Reset the theme on sign-out

Add `setTheme("system")` immediately before the redirect / reload in each of the
three client sign-out paths:

| File | Handler | Change |
|---|---|---|
| `frontend/src/components/layout/Sidebar.tsx` | `handleSignOut` | add `useTheme` import + `const { setTheme } = useTheme()`; call `setTheme("system")` before `fetch("/api/auth/signout", …)` |
| `frontend/src/app/unlock/page.tsx` | `handleSignOut` (~line 240) | `setTheme` already in scope; call `setTheme("system")` before the `fetch` |
| `frontend/src/app/unlock/page.tsx` | stale-session cleanup in the `/api/auth/me` effect (~line 123) | `setTheme` already in scope; call `setTheme("system")` in the `else` branch before the signout `fetch` |

Ordering: call `setTheme("system")` first, then `await fetch(...signout)`, then
navigate. next-themes updates `<html class>` and localStorage synchronously, so
the signed-out page renders in the OS theme with no flash. The `Sidebar` path
uses `router.push("/")` + `router.refresh()` (no full reload); the two
`unlock/page.tsx` paths use `window.location.href` — localStorage persists across
both, so the reset holds.

## 3. Nothing else changes

- `POST /api/auth/signout` — unchanged (session destroy only).
- `/api/preferences` (GET/PATCH) and the `user_preference` table — unchanged. The
  saved theme survives sign-out and is restored by `PreferencesSync` on the next
  sign-in.
- `ThemeTogglePill`, `SettingsPanel`, `savePreference` — unchanged.

---

## Data flow

**Sign out (OS = light, user had picked dark):**
1. User clicks sign out → `setTheme("system")` → next-themes writes
   `theme=system` to localStorage, removes `class="dark"` from `<html>`, resolves
   to light via `matchMedia`.
2. `POST /api/auth/signout` destroys the session.
3. Redirect to `/` → landing page renders light (follows OS). DB row still says
   `theme=dark`.

**Sign back in:**
1. `PreferencesSync` mounts, `GET /api/preferences` → `{ theme: "dark", … }`.
2. `setTheme("dark")` → explicit dark restored.

**Never-signed-in visitor (OS = light):**
1. No stored theme → `defaultTheme="system"` → app follows OS → light.
   (Previously: forced dark.)

## Error handling

No new failure modes. The signout `fetch` keeps its existing `.catch`. If
`setTheme` somehow no-ops, the worst case is the pre-existing behavior (stale
explicit theme on the landing page). The DB is never written on this path, so
there is nothing to roll back.

## Testing / verification

Manual, in the running app (no automated theme/DOM test harness exists):

1. OS set to **light**. Sign in, pick **Dark** on `/settings`. Sign out via the
   sidebar → landing page is **light**. Reload `/` → still light.
2. Sign back in → app returns to **Dark** (DB value restored); `/settings` shows
   Dark selected.
3. Repeat step 1 signing out from the `/unlock` screen → landing page is light.
4. OS set to **dark**, clear localStorage, open `/` while signed out → app is
   **dark** (follows OS, not the old forced default).
5. Toggle the OS appearance while signed out and on `/` → app theme follows
   within the same session (next-themes `matchMedia` listener).

## Known pre-existing quirks (not fixed here)

- `SettingsPanel` computes `isDark = theme !== "light"`, so it shows "Dark" as
  active while `theme === "system"`. Only observable in the brief window before
  `PreferencesSync` resolves on an authenticated load, where the DB value is
  always explicit. Left as-is per surgical-change scope.
- `/` and `/unlock` have only ever been seen in dark mode. They use the
  `.dark` / light CSS variable system, so light mode should render, but it is
  worth a visual pass after the change.

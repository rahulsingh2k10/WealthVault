# Sign-Out Theme Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On sign-out, drop the user's applied theme so the app follows the OS `prefers-color-scheme`; make every signed-out state OS-driven.

**Architecture:** next-themes already supports an OS-following mode via the theme value `"system"` (with `enableSystem`, which is already set). Change the provider default from `"dark"` to `"system"`, and call `setTheme("system")` in each of the three client sign-out paths before they redirect. The per-user theme row in `user_preference` is left untouched — `PreferencesSync` restores it on the next sign-in.

**Tech Stack:** Next.js 14 (App Router), next-themes ^0.3.0, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-09-signout-theme-reset-design.md`

---

## Context for the implementer

- **Dev server:** `cd frontend && npm run dev` → http://localhost:3000. It is already running in this session (logs at `/tmp/wv-frontend.log`); a running `next dev` hot-reloads on save.
- **No automated test harness** covers theme/DOM behavior in this repo. Verification for this feature is manual, in the browser. Do not add a test framework.
- **Type-check** after edits: `cd frontend && npx tsc --noEmit`. There is a known pre-existing backlog of ~80+ TS errors in unrelated files; the bar is **no new errors in the files this plan touches** (`src/app/layout.tsx`, `src/components/layout/Sidebar.tsx`, `src/app/unlock/page.tsx`).
- **next-themes behavior:** `setTheme("system")` writes `"system"` to `localStorage["theme"]`, removes the explicit `class="dark"` from `<html>` when the OS is light, and attaches a `matchMedia` listener so the theme tracks live OS changes. No import beyond `useTheme` is needed.
- Three sign-out call sites (confirmed): `Sidebar.handleSignOut`, `unlock/page.tsx handleSignOut`, `unlock/page.tsx` stale-session cleanup inside the `/api/auth/me` effect. `InactivityLock` calls `/api/auth/lock` (session preserved) and is **out of scope**.

---

## Task 1: Default the theme provider to `"system"`

**Files:**
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Change the `defaultTheme` prop**

In `frontend/src/app/layout.tsx`, the `ThemeProvider` currently reads:

```tsx
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
```

Change `defaultTheme="dark"` to `defaultTheme="system"`:

```tsx
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
```

Leave every other prop and the rest of the file unchanged.

- [ ] **Step 2: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/app/layout\.tsx' || echo "no new errors in layout.tsx"`
Expected: `no new errors in layout.tsx`

- [ ] **Step 3: Manual check — never-signed-in visitor follows OS**

1. Set macOS appearance to **Light** (System Settings → Appearance).
2. In the browser dev console for http://localhost:3000, run `localStorage.removeItem('theme')`, then hard-reload `/` while signed out (if signed in, sign out first).
3. Expected: the landing page renders in **light** mode (previously it was forced dark).
4. Set macOS appearance to **Dark**, reload `/` → landing page renders **dark**.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/layout.tsx
git commit -m "Default theme provider to system so signed-out UI follows the OS

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 2: Reset the theme on sign-out from the sidebar

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add the `useTheme` import**

`Sidebar.tsx` does not currently import from `next-themes`. Add the import next to the other third-party imports (after the `react` import on line 5):

```tsx
import { useTheme } from "next-themes";
```

- [ ] **Step 2: Pull `setTheme` from the hook**

In the `Sidebar` component body, just after `const router = useRouter();` (line 46), add:

```tsx
  const { setTheme } = useTheme();
```

- [ ] **Step 3: Call `setTheme("system")` in `handleSignOut`**

`handleSignOut` currently reads:

```tsx
  const handleSignOut = async () => {
    setSheetOpen(false);
    setActivePopover(null);
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };
```

Change it to reset the theme before the network call:

```tsx
  const handleSignOut = async () => {
    setSheetOpen(false);
    setActivePopover(null);
    // Sign-out drops the user's saved theme; fall back to the OS setting.
    // The DB preference is untouched and restored by PreferencesSync on next sign-in.
    setTheme("system");
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/");
    router.refresh();
  };
```

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/components/layout/Sidebar\.tsx' || echo "no new errors in Sidebar.tsx"`
Expected: `no new errors in Sidebar.tsx`

- [ ] **Step 5: Manual check — sidebar sign-out reverts to OS**

1. macOS appearance **Light**. Sign in. Go to `/settings`, pick **Dark**. Confirm the app is dark.
2. Open the sidebar sheet, click **Log out …**.
3. Expected: lands on `/` in **light** mode. In dev console, `localStorage.getItem('theme')` → `"system"`.
4. Reload `/` → still light.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "Reset theme to system on sidebar sign-out

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 3: Reset the theme on both sign-out paths in the unlock page

**Files:**
- Modify: `frontend/src/app/unlock/page.tsx`

`useTheme` is already imported and `const { theme, setTheme } = useTheme();` is already in the component body (line 71). No new imports.

- [ ] **Step 1: Reset in the explicit `handleSignOut`**

The handler (around line 240) currently reads:

```tsx
  const handleSignOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    // Full page reload — clears Next.js client cache and all React state.
    // router.push() + router.refresh() can race; window.location is reliable.
    window.location.href = "/";
  };
```

Add the theme reset before the fetch:

```tsx
  const handleSignOut = async () => {
    // Sign-out drops the user's saved theme; fall back to the OS setting.
    setTheme("system");
    await fetch("/api/auth/signout", { method: "POST" });
    // Full page reload — clears Next.js client cache and all React state.
    // router.push() + router.refresh() can race; window.location is reliable.
    window.location.href = "/";
  };
```

- [ ] **Step 2: Reset in the stale-session cleanup**

Inside the `useEffect` that calls `/api/auth/me` (around line 114), the `else` branch currently reads:

```tsx
        } else {
          // Middleware let us through (userId in cookie) but the user row is gone —
          // stale session after a DB wipe or account deletion. Sign out and go home.
          fetch("/api/auth/signout", { method: "POST" })
            .catch(() => {})
            .finally(() => { window.location.href = "/"; });
        }
```

Add the theme reset before the signout fetch:

```tsx
        } else {
          // Middleware let us through (userId in cookie) but the user row is gone —
          // stale session after a DB wipe or account deletion. Sign out and go home.
          setTheme("system");
          fetch("/api/auth/signout", { method: "POST" })
            .catch(() => {})
            .finally(() => { window.location.href = "/"; });
        }
```

- [ ] **Step 3: Check the effect dependency array**

The `useEffect` ends with `}, []);`. Adding `setTheme` (a stable next-themes callback) to the body introduces a lint warning for `react-hooks/exhaustive-deps` only if the project lints it as an error. Check the sibling file `PreferencesSync.tsx` — it uses the same pattern with an `// eslint-disable-next-line react-hooks/exhaustive-deps` comment above the closing line. If the build errors on the hook dep, add the same disable comment directly above `}, []);` for this effect. Otherwise leave the array as `[]`.

Run: `cd frontend && npx next lint --file src/app/unlock/page.tsx 2>&1 | tail -20`
Expected: no new **error** (warnings are acceptable and match the existing codebase style).

- [ ] **Step 4: Type-check**

Run: `cd frontend && npx tsc --noEmit 2>&1 | grep -E 'src/app/unlock/page\.tsx' || echo "no new errors in unlock/page.tsx"`
Expected: `no new errors in unlock/page.tsx`

- [ ] **Step 5: Manual check — unlock-screen sign-out reverts to OS**

1. macOS appearance **Light**. Sign in, set theme to **Dark** on `/settings`.
2. Navigate to `/unlock` (sidebar → **Lock screen**, or let it idle to the inactivity lock).
3. On the unlock screen, click **Sign out**.
4. Expected: lands on `/` in **light** mode; `localStorage.getItem('theme')` → `"system"`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/unlock/page.tsx
git commit -m "Reset theme to system on unlock-page sign-out paths

Claude-Session: https://claude.ai/code/session_01Nqr1LiF6Bh5bXXwHQQmtfx"
```

---

## Task 4: Full-flow verification

No code changes — this task confirms the spec's acceptance criteria end to end.

- [ ] **Step 1: Saved theme survives sign-out and is restored on sign-in**

1. macOS appearance **Light**. Sign in. `/settings` → pick **Dark**.
2. Sign out (sidebar). Landing page is **light**, `localStorage['theme'] === "system"`.
3. Sign back in. Expected: app returns to **Dark** within a moment of load (`PreferencesSync` reads the DB row). `/settings` shows **Dark** selected.
4. Confirm the `user_preference` row was never cleared:
   `cd backend && node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.userPreference.findMany({where:{key:'theme'}}).then(r=>{console.log(r);return p.\$disconnect()})"`
   Expected: the theme row(s) still present with value `dark`.

- [ ] **Step 2: Live OS switch while signed out**

1. Sign out. On `/`, with `localStorage['theme'] === "system"`, toggle macOS appearance Light ↔ Dark.
2. Expected: the page theme follows the OS change without a reload.

- [ ] **Step 3: Visual pass on signed-out screens in light mode**

1. macOS appearance **Light**, signed out.
2. Load `/` and `/unlock`. Skim for unreadable text, invisible borders, or wrong-colored panels — these screens have historically only been viewed in dark mode.
3. Record anything broken. Minor cosmetic issues are out of scope for this plan (raise separately); a genuinely unusable screen should be reported back before closing the feature.

- [ ] **Step 4: Update the spec's status (optional)**

If the team convention is to mark specs done, append a short "Implemented 2026-09-09" note to `docs/superpowers/specs/2026-09-09-signout-theme-reset-design.md` and commit. Skip if there is no such convention (check the other spec files first).

---

## Self-review notes

- **Spec coverage:** Goal 1 (sign-out → OS) → Tasks 2 & 3. Goal 2 (all signed-out states OS-driven) → Task 1. Goal 3 (DB row untouched, restored on sign-in) → verified in Task 4 Step 1; no code touches `/api/preferences` or the signout route, matching the spec's non-goals.
- **All three sign-out call sites** from the spec table are covered: Sidebar (Task 2), unlock `handleSignOut` (Task 3 Step 1), unlock stale-session cleanup (Task 3 Step 2).
- **Consistent call:** every site calls `setTheme("system")` with the string literal `"system"`, before the signout `fetch`.
- **No placeholders:** every code step shows the full before/after.

# Screen: Unlock Page (`/unlock`)

This is the most complex single-page component in the app. It has two panels, five distinct sub-states, avatar upload with canvas resizing, passphrase strength validation, a first-time confirmation modal, and a reset vault flow. This doc is the authoritative reference for this screen.

---

## Purpose

The unlock page bridges OAuth authentication and vault access. A user reaches it when:
- They are **authenticated** (have a valid `userId` cookie) but
- The vault is **locked** (no `encryptionKey` in session)

Its job is to accept a passphrase, POST it to `/api/auth/unlock`, and — if valid — receive a derived encryption key stored in the session cookie, then move on to `/dashboard`. The exact path from there differs for a first-time user versus a returning user — see **Sub-flows** below.

---

## File Map

| File | Role |
|------|------|
| `src/app/unlock/page.tsx` | Entire unlock page — two-panel layout, all state, all flows |
| `src/app/api/auth/unlock/route.ts` | POST handler — derives the key, verifies or creates the verifier, stores `encryptionKey` in session |
| `src/app/api/auth/me/route.ts` | GET handler — returns `{ user: { id, name, email, avatar, platform, subscription } }` |
| `src/app/api/auth/avatar/route.ts` | PATCH handler — saves a base64 JPEG to `user.avatar` in the DB |
| `src/app/api/auth/signout/route.ts` | POST handler — destroys the session, used by the Sign Out button |
| `src/app/api/auth/reset-vault/route.ts` | POST handler — intended to delete all asset rows and clear the verifier blob. **Currently broken — see Known Issues.** |
| `src/app/api/preferences/route.ts` | GET/PATCH handler — reads/writes saved locale, country, and theme in the `user_preference` table (`prisma.userPreference`). |
| `src/components/layout/AppBar.tsx` | Top bar still visible (from root layout); shows the dark/light `ThemeTogglePill` on this route |
| `src/lib/services/EncryptionService.ts` | `deriveKey`, `createVerifier`, `verifyKey`, `encrypt`, `decrypt` — thin wrapper around `src/lib/encryption.ts` |
| `src/lib/validation/passphraseValidation.ts` | `validatePassphrase()` — the same 5 rules enforced both client-side (live UI checklist) and server-side (on first-time setup only) |
| `src/lib/savePreference.ts` | `savePreference(key, value)` — fire-and-forget PATCH to `/api/preferences`; silently swallows network-level errors (a non-2xx HTTP response doesn't reject `fetch`, so it isn't surfaced either) |
| `src/lib/session.ts` | iron-session config — `getSession()`, `SessionData` shape |

`POST /api/auth/unlock` calls `getSession()` and `prisma.user.*` directly.

---

## Component Hierarchy

```
Root Layout
└── AppBar
    └── UnlockPage (src/app/unlock/page.tsx)   ['use client']
        ├── Ambient orb divs (aria-hidden) — <WarmBackground>-style, inline in this page
        ├── Main two-panel card
        │   ├── Gradient accent strip (top)
        │   ├── LEFT PANEL
        │   │   ├── Avatar circle (img or initials fallback)
        │   │   │   └── Hover overlay → Camera button → <input type="file" hidden>
        │   │   ├── "+ Add profile photo" button (only when no avatar)
        │   │   ├── Welcome name + tagline (or skeleton pulse loaders)
        │   │   ├── Divider
        │   │   ├── INFO_POINTS list (4× icon + label + text)
        │   │   └── Sign Out button
        │   └── RIGHT PANEL
        │       ├── Lock icon + heading
        │       ├── <form onSubmit={handleSubmit}>
        │       │   ├── Password input (show/hide toggle)
        │       │   ├── Validation checklist (5 rules, live)
        │       │   ├── Char counter
        │       │   ├── Error message (conditional)
        │       │   ├── "Forgot passphrase?" link (conditional on "Invalid passphrase" error)
        │       │   ├── Reset confirmation panel (conditional on showReset)
        │       │   └── "Unlock Vault" submit button — label changes with loadingStep
        │       └── Footer hint ("First time here?")
        └── First-time passphrase modal (fixed overlay, conditional on showSaveAlert)
            ├── Gradient accent strip
            ├── ShieldCheck icon
            ├── ⚠ warning box
            ├── Passphrase display box + Copy button
            └── "I've saved it — Open Vault" button
```

---

## State Map

| State variable | Type | Purpose |
|---|---|---|
| `user` | `CurrentUser \| null` | Loaded from `/api/auth/me` on mount |
| `passphrase` | `string` | Controlled input, capped at 256 chars |
| `showPass` | `boolean` | Toggles input type password ↔ text |
| `error` | `string` | Server error message from the unlock API |
| `loading` | `boolean` | True while the unlock request (and its follow-on work) is in flight |
| `loadingStep` | `'unlocking' \| 'syncing' \| 'done'` | Drives the submit button's label while `loading` is true — see **Passphrase submission** below |
| `avatarUploading` | `boolean` | True while resizing + PATCHing avatar |
| `avatarError` | `string` | Error from avatar upload |
| `showReset` | `boolean` | Shows the destructive reset panel |
| `resetting` | `boolean` | True while POSTing to `/api/auth/reset-vault` |
| `showSaveAlert` | `boolean` | True on first-time setup — shows the passphrase modal |
| `copied` | `boolean` | True for 2.5s after clipboard copy in modal |

---

## Sub-flows

### 1. Page Load — fetch current user

```
mount
  │
  ▼
GET /api/auth/me
  ├── { user } → setUser(user)
  └── { user: null } (no user) → POST /api/auth/signout → window.location.href = "/"
```

If `/api/auth/me` returns no user (stale session after a DB wipe or account deletion), the page self-signs-out and redirects to `/`. This prevents a logged-in-but-ghost-user state.

### 2. Avatar upload

```
User clicks avatar circle (hover camera icon) or "+ Add profile photo"
  │
  ▼
<input type="file" accept="image/*"> triggers handleAvatarChange
  │
  ▼
resizeImage(file, maxPx=256, quality=0.82)   ← canvas-based client-side resize
  │  Returns base64 JPEG data URL
  ▼
PATCH /api/auth/avatar   { avatar: dataUrl }
  ├── ok → setUser(prev => { ...prev, avatar: dataUrl })
  └── error → setAvatarError(message)
```

`resizeImage` uses `URL.createObjectURL` → draws onto a canvas → exports as JPEG at 82% quality, constrained to 256×256. The `<input>` ref is reset after every upload attempt so the same file can be re-selected.

### 3. Passphrase submission — shared entry point for both first-time and returning users

The same `handleSubmit` runs regardless of whether this is the user's first passphrase or their hundredth — the branch only happens *after* the server responds:

```
User types passphrase → live validation updates `checks` object
  │
  ▼  (all 5 checks pass — button enabled)
User clicks "Unlock Vault" (or presses Enter)
  │
  ▼
setLoading(true); setLoadingStep('unlocking'); setError("")
  │
  ▼
POST /api/auth/unlock   { passphrase }
  │
  ├── non-2xx → setError(data.error), loading stops here — nothing below runs
  │
  └── 200 { success: true, firstTime }
        │
        ▼
      setLoadingStep('syncing')
        │
        ├── firstTime === true  ──────────────────────────────► see "4. First-time path" below
        │
        └── firstTime === false ─────────────────────────────► see "5. Returning-user path" below
```

### 4. First-time setup path (`firstTime: true`)

This is the **very first successful unlock** for this account — the server just created the verifier (see **Server-side Logic** below).

```
firstTime === true
  │
  ▼
Promise.all([
  savePreference('country', <IP-detected country>),
  savePreference('locale',  <browser-detected locale>),
  savePreference('theme',   <current theme, defaulting to 'dark'>),
])
  │  (fire-and-forget — each is a PATCH to /api/preferences, upserting one user_preference row)
  ▼
setShowSaveAlert(true)
  │
  ▼
Modal appears: passphrase shown once, in a copyable monospace box
  │
User clicks "I've saved it — Open Vault"
  │
  ▼
handleOpenVault(): router.push('/dashboard'); router.refresh();
```

The passphrase is shown only once and is never stored anywhere client-side after this — closing or refreshing the tab without clicking through loses it permanently (which is the intended, documented behavior: there is no recovery).

### 5. Returning-user path (`firstTime: false`)

This is every unlock **after** the first — the server just verified the passphrase against the existing verifier.

```
firstTime === false
  │
  ▼
GET /api/preferences
  ├── ok → apply saved locale, country, theme to the UI (setLocale/setCountry/setTheme)
  └── not ok → skip silently, defaults stay in effect
  │
  ▼
setLoadingStep('done')
  │
  ▼
router.push('/dashboard')
```

Unlike the first-time path, this path does **not** call `router.refresh()` — only `router.push()`.

### 6. Reset vault flow

Surfaces only when `error === "Invalid passphrase"` (i.e. only on the returning-user path, when the passphrase is wrong):
```
"Forgot your passphrase?" link → setShowReset(true)
  │
  ▼
Reset confirmation panel appears with warning text
  │
User clicks "Yes, delete everything"
  │
  ▼
POST /api/auth/reset-vault
  │  (currently throws before doing anything — see Known Issues)
  └── setPassphrase('') + setError('') + setShowReset(false) regardless of the response
      (the client does not check response.ok here)
```

### 7. Sign out

```
User clicks "Sign out"
  │
  ▼
POST /api/auth/signout   ← session.destroy(), clearing userId + encryptionKey + everything else
  │
  ▼
window.location.href = "/"   ← full page reload to clear Next.js client cache
```

`router.push()` is intentionally not used here because it can race with session clearing. `window.location.href` guarantees a full browser navigation and state reset.

---

## Passphrase Validation

The same 5 rules are enforced in two places, and must be kept in sync manually — there's no shared import between them, just parallel logic:

- **Client-side** (`src/app/unlock/page.tsx`) — computed live on every keystroke, drives the checklist UI and disables the submit button:
  ```typescript
  const checks = {
    minLength:       passphrase.length >= 12,
    hasAlphanumeric: /[a-zA-Z]/.test(passphrase) && /\d/.test(passphrase),
    hasUpper:        (passphrase.match(/[A-Z]/g) ?? []).length >= 2,
    hasSpecial:      (passphrase.match(/[^a-zA-Z0-9]/g) ?? []).length >= 2,
    underMax:        passphrase.length <= 256,
  }
  const allValid = Object.values(checks).every(Boolean)
  ```
- **Server-side** (`src/lib/validation/passphraseValidation.ts`, `validatePassphrase()`) — identical thresholds, but only actually invoked by the unlock route **on first-time setup** (see below). A returning user's passphrase is never re-validated for strength — it's only ever compared against the stored verifier.

The input border changes from neutral → red (partially typed, failing) → green (all checks met), and the submit button is disabled / Enter-key submission is blocked while `!allValid`.

---

## Server-side: `POST /api/auth/unlock` Logic

```
POST { passphrase }
  │
  ├── !passphrase ────────────────────────────► 400 { error: "Passphrase required" }
  │
  ▼
getSession() → session.userId present?
  ├── No ─────────────────────────────────────► 401 { error: "Unauthorized" }
  │
  ▼
prisma.user.findUnique({ where: { id: session.userId } })
  ├── not found ──────────────────────────────► 404 { error: "User not found" }
  │
  ▼
keyHex = EncryptionService.deriveKey(passphrase)   ← scrypt-derived key, see src/lib/encryption.ts
  │
  ▼
Does user.verifier already exist?
  │
  ├── No (first-time) ──────────────────────────────────────────────────┐
  │     validatePassphrase(passphrase)                                  │
  │       ├── invalid ───────────────────────► 400 { error: <first validation error> }
  │       └── valid                                                      │
  │             prisma.user.update({ verifier: createVerifier(keyHex) }) │
  │                                                                       │
  └── Yes (returning) ───────────────────────────────────────────────────┤
        verifyKey(keyHex, user.verifier)                                 │
          ├── mismatch ─────────────────────► 401 { error: "Invalid passphrase" }
          └── match                                                      │
                (no DB write)                                            │
                                                                          ▼
session.encryptionKey = keyHex; await session.save()
  │
  ▼
200 { success: true, firstTime: !user.verifier }
```

Any unhandled exception anywhere in this handler is caught by a top-level `try/catch` and returns `500 { error: "Failed to unlock" }`.

**The passphrase never leaves this route handler as plaintext beyond this function.** `keyHex` (the derived key, not the passphrase itself) is stored only in the iron-session cookie for the session's duration (8 hours, per `src/lib/session.ts`).

`createVerifier(keyHex)` = `encrypt("PORTFOLIO_APP_V1", keyHex)`. `verifyKey(keyHex, verifier)` = `decrypt(verifier, keyHex) === "PORTFOLIO_APP_V1"` (returns `false` instead of throwing if decryption fails, e.g. on a wrong key).

### Database effect

This route touches exactly one column: `users.verifier`.

| Case | Write |
|---|---|
| First-time (verifier was `NULL`) | `UPDATE users SET verifier = <new encrypted blob> WHERE id = ...` |
| Returning, correct passphrase | No write — `verifier` is only read and compared |
| Returning, wrong passphrase | No write — request fails at the `verifyKey` check |

No other table or column is touched by this route. It does not write to `SubscriptionPlan`, does not create or modify any other `User` field, and does not run inside a database transaction (the two conceptual steps — verifier check/write, then session save — aren't atomic with each other, but the session write isn't a database operation, so there's no partial-DB-write risk).

---

## Known Issues

One route this screen depends on is non-functional. It is not the unlock endpoint
itself — it is a route this screen *calls in addition to* `/api/auth/unlock`:

- **`POST /api/auth/reset-vault`** (`src/app/api/auth/reset-vault/route.ts`) builds a
  `Promise.all([...])` array that includes `prisma.equityHolding.deleteMany(...)` and
  eight other calls on models that do not exist on the generated Prisma client. Accessing
  `.deleteMany` on `undefined` throws synchronously while the array literal is being
  constructed — **before** `Promise.all` ever runs — so the `prisma.user.update({
  verifier: null })` call in the same array is never reached either. Effect on this
  screen: clicking "Yes, delete everything" always fails server-side (500), but the
  client doesn't check `response.ok` here — it clears `passphrase`/`error`/`showReset`
  regardless, so the UI *looks* like the reset worked while the verifier was never
  actually cleared. A user who clicks this will see the form reset but their old
  passphrase is still active.

`POST /api/auth/unlock`, `GET`/`PATCH /api/preferences`, `PATCH /api/auth/avatar`, and
`POST /api/auth/signout` are unaffected and function as documented. (`/api/preferences`
was rebuilt on the `UserPreference` model — first-time setup now persists
country/locale/theme, and a returning user's saved preferences are restored on unlock.)

---

## Theme Pattern

Same dark/light pattern as the rest of the app: `next-themes`' `ThemeProvider` (see
`src/app/layout.tsx`), with the `ThemeTogglePill` in the `AppBar` (shown on this route
and on `/`) letting the user switch modes. All theme-sensitive colors are the shared
`--ui-*` / `--warm-*` CSS custom properties from `globals.css` (light on `:root`, dark on
`.dark`), used as inline styles rather than Tailwind's `dark:` classes.

Left panel uses a stronger tint (`--unlock-left-bg`) to visually separate it from the
right panel (`--unlock-right-bg`). Both have distinct light/dark values.

---

## API Routes Used by This Page

| Method | Route | When | Status |
|--------|-------|------|--------|
| GET | `/api/auth/me` | On mount — load user name/avatar/subscription | Working |
| POST | `/api/auth/unlock` | On form submit | Working |
| PATCH | `/api/auth/avatar` | On file select | Working |
| GET | `/api/preferences` | After a successful returning-user unlock | Working |
| PATCH | `/api/preferences` | 3× after a successful first-time unlock | Working |
| POST | `/api/auth/reset-vault` | Reset vault confirm | **Broken** — see Known Issues |
| POST | `/api/auth/signout` | Sign Out button, and auto-signout when `/api/auth/me` returns no user | Working |

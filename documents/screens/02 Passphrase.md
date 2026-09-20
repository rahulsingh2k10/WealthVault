# Screen: Unlock Page (`/unlock`)

A two-panel screen with a server-rendered profile (name and photo), avatar upload with canvas resizing, a live passphrase-strength checklist, a save-your-passphrase confirmation for first-time users, and a reset-vault flow. This doc is the authoritative reference for this screen.

---

## Purpose

The unlock page bridges OAuth authentication and vault access. A user reaches it when:
- They are **authenticated** (have a valid `userId` in the session cookie) but
- The vault is **locked** (no `encryptionKey` in the session)

Its job is to accept a passphrase, POST it to `/api/auth/unlock`, and — if valid — receive a derived encryption key stored in the session cookie, then move on to `/dashboard`. The path differs for a first-time user (no passphrase set up yet) and a returning user — see **Sub-flows** below.

Vault locking happens from the sidebar's **Lock Screen** pill and from the inactivity timer (`InactivityLock`), both of which end on this page.

---

## Access

| Layer | Rule |
|---|---|
| `src/middleware.ts` | `/unlock` requires `session.userId`; without it the request is redirected to `/`. |
| `src/app/unlock/page.tsx` | Server component; redirects to `/` when there is no `session.userId` or when the user row does not exist. |

---

## File Map

| File | Role |
|------|------|
| `src/app/unlock/page.tsx` | Server component (`force-dynamic`). Reads the session, runs one indexed `users` lookup (`fullName`, `avatar`, `verifier`), and renders `UnlockClient` with `initialUser` (`{ name, avatar }`) and `initialIsNewUser` (`verifier` is null). Only the boolean derived from `verifier` reaches the client. |
| `src/app/unlock/UnlockClient.tsx` | Client component (`'use client'`) — the two-panel layout, all state, all flows. |
| `src/app/api/auth/unlock/route.ts` | POST handler — derives the key, verifies or creates the verifier, stores `encryptionKey` in the session, reconciles due plan changes. |
| `src/app/api/auth/avatar/route.ts` | PATCH handler — saves a base64 image data URL to `users.avatar`. |
| `src/app/api/auth/signout/route.ts` | POST handler — destroys the session; used by the Sign out button and the deleted-user path. |
| `src/app/api/auth/reset-vault/route.ts` | POST handler — clears `users.verifier` and the session's `encryptionKey`. |
| `src/app/api/preferences/route.ts` | GET/PATCH handler — reads/writes locale, country, and theme in the `user_preference` table (`prisma.userPreference`). |
| `src/components/layout/AppBar.tsx` | Fixed top bar from the root layout; shows the `ThemeTogglePill` (md and up) and the `ProfileBadge` on this route. |
| `src/components/ui/ripple-pulse-loader.tsx` | `RipplePulseLoader` — the loader inside the vault-opening overlay. |
| `src/lib/services/EncryptionService.ts` | `deriveKey`, `createVerifier`, `verifyKey`, `encrypt`, `decrypt` — thin wrapper around `src/lib/encryption.ts`. |
| `src/lib/validation/passphraseValidation.ts` | `validatePassphrase()` — the five strength rules, enforced server-side on first-time setup. |
| `src/lib/savePreference.ts` | `savePreference(key, value)` — PATCH to `/api/preferences`; a network failure is swallowed, and a non-2xx response is not surfaced either (`fetch` does not reject on it). |
| `src/lib/session.ts` | iron-session config — `getSession()`, `SessionData` shape. |
| `src/context/LocaleContext.tsx` | Supplies `locale`, `country`, `setLocale`, `setCountry` to the client component. |

---

## Component Hierarchy

```
Root Layout
├── PreferencesSync
├── AppBar
└── UnlockPage (src/app/unlock/page.tsx)                 [server]
    └── UnlockClient (src/app/unlock/UnlockClient.tsx)   ['use client']
        ├── Ambient orb divs (two, fixed, inline in this component)
        ├── Main two-panel card
        │   ├── Gradient accent strip (top)
        │   ├── LEFT PANEL
        │   │   ├── Avatar circle (photo, spinner while downloading, or initials)
        │   │   │   └── Hover overlay → Camera button → <input type="file" hidden>
        │   │   ├── "+ Add profile photo" button (only when there is no avatar)
        │   │   ├── Avatar error text (conditional)
        │   │   ├── "Welcome, {name}" + tagline
        │   │   ├── Divider
        │   │   ├── Critical-passphrase heading + INFO_POINTS list (4× icon + label + text)
        │   │   └── Sign out button
        │   ├── RIGHT PANEL
        │   │   ├── Lock icon + heading + subtitle
        │   │   ├── <form onSubmit={handleSubmit}>
        │   │   │   ├── Passphrase input (show/hide toggle)
        │   │   │   ├── Validation checklist (5 rules, live)
        │   │   │   ├── Character counter
        │   │   │   ├── Error message (conditional)
        │   │   │   ├── "Forgot your passphrase? Reset vault →" link (conditional on the "Invalid passphrase" error)
        │   │   │   ├── Reset confirmation panel (conditional on showReset)
        │   │   │   └── "Unlock Vault" submit button — label changes with loadingStep
        │   │   └── Footer hint ("First time here?")
        │   └── Vault-opening overlay (absolute, conditional on `loading`)
        └── Save-passphrase modal (fixed overlay, conditional on showSaveAlert)
            ├── Gradient accent strip
            ├── ShieldCheck icon + heading
            ├── Warning box
            ├── Passphrase display box + Copy button
            ├── Hint text
            ├── "I've saved it — Open Vault" button
            └── "Go back and change passphrase" button
```

### Layout

- The screen sits below the fixed 56 px AppBar (`mt-14`) and centers the card in the remaining viewport height; outer padding is 16 px, 32 px from `sm`.
- The card is `max-w-4xl` with a translucent blurred surface. Below `lg` the panels stack vertically (profile on top, form below); from `lg` they sit side by side, left panel `2/5` width with a right border, right panel `3/5`.
- The left panel uses `--unlock-left-bg`; the right panel uses `--unlock-right-bg`.

### Profile (left panel)

- The user's name and avatar are rendered on first paint from the server-fetched `initialUser`; the client makes no request to load them.
- **Avatar circle** (96 px): three photo states.
  - `loading` — the image is downloading: a small spinner (`role="status"`, `aria-label="Loading photo"`) is shown in the circle over the accent avatar background; the image element is hidden.
  - `loaded` — the image is shown (`object-cover`) on a transparent background.
  - `error` — the image failed to load: the circle shows the user's initials instead.
  - With no avatar, the circle shows initials directly (no spinner).
  - Initials are the first letter of up to the first two space-separated words of the name, uppercased; `?` when the name is empty.
  - An image already in the browser cache is treated as loaded as soon as the element mounts, so the spinner does not stick.
- The name, the tagline ("Your Vault. Securely Held Here. Yours to Control."), and the info list render immediately, independent of the photo state.
- Hovering the circle reveals a Camera button (with `title="Change photo"`) that opens the file picker; while an upload is in flight the button shows a spinner and is disabled.
- **INFO_POINTS**, under the red heading "Your passphrase is critical — read this":
  1. Your only key — "Without it, your data is permanently inaccessible — no exceptions."
  2. Never stored — "It is never transmitted or held by us — not on our servers, not anywhere."
  3. No recovery — "If you forget it, there is no reset, no support ticket. It is simply gone."
  4. Treat it like a safe combination — "Memorable to you, unknowable to everyone else."

### Passphrase form (right panel)

- Heading "Enter Your Passphrase"; subtitle "Access your vault—secured and available only to you."
- Input: password type by default, placeholder "Enter your passphrase", auto-focused, capped at 256 characters (input beyond that is truncated); an eye toggle switches between hidden and visible text.
- Checklist (each row shows a circle that turns into a green check once met, and red text when unmet after typing starts; all rows are muted while the input is empty):
  1. At least 12 characters
  2. Contains a letter and a number
  3. At least two uppercase letters
  4. At least two special characters
  5. Under 256 characters
- Character counter `n / 256`, right-aligned; it turns red within 20 characters of the limit.
- Input border: neutral when empty, red when partially typed and failing, green when all five rules pass.
- The submit button reads "Unlock Vault"; it is disabled while `loading` or while any rule fails. Pressing Enter with a failing rule does nothing.
- Footer hint: "First time here?" / "Your passphrase becomes your key—only you can access your vault."

### Vault-opening overlay

While `loading` is true, an overlay covers the two-panel card — **scoped to the card, not the full page** — a blurred scrim (`background: var(--ui-scrim-bg)`, `backdrop-blur-md`) with a small bordered box (`bg-[var(--ui-modal-bg)]`) containing a `RipplePulseLoader` and a caption that tracks `loadingStep`:

| `loadingStep` | Overlay caption | Submit button label |
|---|---|---|
| `unlocking` | "Verifying passphrase…" | "Verifying passphrase…" |
| `syncing` | "Loading your settings…" | "Loading your settings…" |
| `done` | "Opening your vault…" | "Opening vault…" |

The overlay stays visible from the start of the unlock request until the dashboard replaces this page; it is hidden again only when the request fails or ends without navigating (see **Passphrase unlock**).

### Save-passphrase modal

A fixed, full-screen blurred overlay (`z-50`) containing a `max-w-md` card with a top gradient strip:

- ShieldCheck icon and heading "Secure Your Passphrase to Continue".
- A red warning box: "⚠ Read this before you continue" — the passphrase is the user's **ONLY KEY**, shown **ONLY ONCE**, **NEVER STORED** by the app or on the device; if **LOST** the vault **CANNOT** be **ACCESSED** — there is no recovery.
- A monospace box showing the typed passphrase (truncated, select-all) with a **Copy** button. Copy writes to the clipboard and the button reads "Copied" for 2.5 seconds; when the Clipboard API is blocked it falls back to a hidden textarea and `document.execCommand("copy")`.
- Hint: "Keep it safe—in a password manager, a secure note, or somewhere only you can access."
- **"I've saved it — Open Vault"** — starts the unlock (see **Sub-flow 4**).
- **"Go back and change passphrase"** — closes the modal and returns to the form with the passphrase still typed. Nothing has been sent to the server.
- The modal has no backdrop-click or Escape dismissal; the two buttons are its only exits.

---

## State Map

| State variable | Type | Purpose |
|---|---|---|
| `user` | `CurrentUser` (`{ name, avatar }`) | Seeded from `initialUser`; `avatar` is replaced after a successful upload |
| `avatarStatus` | `'loading' \| 'loaded' \| 'error'` | Photo download state; starts `loading` when an avatar exists, otherwise `loaded` |
| `passphrase` | `string` | Controlled input, capped at 256 chars |
| `showPass` | `boolean` | Toggles input type password ↔ text |
| `error` | `string` | Error message from the unlock request |
| `loading` | `boolean` | True while the unlock request, its follow-on work, and the hand-off to the dashboard are in progress |
| `loadingStep` | `'unlocking' \| 'syncing' \| 'done'` | Drives the overlay caption and the submit button label |
| `avatarUploading` | `boolean` | True while resizing + PATCHing the avatar |
| `avatarError` | `string` | Error from avatar upload |
| `showReset` | `boolean` | Shows the destructive reset panel |
| `resetting` | `boolean` | True while POSTing to `/api/auth/reset-vault` |
| `showSaveAlert` | `boolean` | Shows the save-passphrase modal |
| `isNewUser` | `boolean` | Seeded from `initialIsNewUser`; true while the user has no passphrase set up; set to true after a vault reset |
| `copied` | `boolean` | True for 2.5 s after the Copy button is used |

---

## Sub-flows

### 1. Page load

```
GET /unlock
  │
  ▼
middleware: session.userId present? ── no ──► redirect "/"
  │
  ▼
UnlockPage (server): prisma.user.findUnique({ fullName, avatar, verifier })
  ├── no session.userId or no user row ──► redirect "/"
  └── user ──► render UnlockClient { initialUser: { name, avatar }, initialIsNewUser: !verifier }
```

The name and photo are part of the first HTML response; there is no client-side user fetch. The photo file itself is downloaded by the browser after the HTML arrives, which is what the spinner in the avatar circle covers.

### 2. Avatar upload

```
User clicks avatar circle (hover camera icon) or "+ Add profile photo"
  │
  ▼
<input type="file" accept="image/*"> triggers handleAvatarChange
  │
  ▼
resizeImage(file, maxPx=256, quality=0.82)   ← canvas-based client-side resize
  │  Returns a base64 JPEG data URL
  ▼
PATCH /api/auth/avatar   { avatar: dataUrl }
  ├── ok → setUser(prev => ({ ...prev, avatar: dataUrl })); avatarStatus = 'loaded'
  └── error → setAvatarError(message)
```

`resizeImage` uses `URL.createObjectURL`, draws onto a canvas constrained to 256 px on the longest side, and exports JPEG at 82% quality. The file input is reset after every attempt so the same file can be re-selected. The route validates that the value starts with `data:image/` (`400 "Invalid avatar data"`) and is at most 500,000 characters (`400 "Image too large (max ~350 KB)"`), then writes it to `users.avatar`; without a session it returns `401`. The avatar lives only in `users.avatar` — it is not stored in the session cookie (a data URL exceeds the cookie size limit). A resize failure shows "Could not process image."

### 3. Submit — entry point for both user kinds

```
User types passphrase → live checks update
  │
  ▼  (all 5 checks pass — button enabled)
User clicks "Unlock Vault" (or presses Enter)
  │
  ▼
handleSubmit
  ├── isNewUser === true ──► setShowSaveAlert(true)   (no request is sent yet) ──► Sub-flow 4
  └── isNewUser === false ─► unlockVault()                                      ──► Sub-flow 5
```

### 4. First-time user (`isNewUser: true`)

The passphrase is confirmed by the user **before** it is set up on the server.

```
Save-passphrase modal is open
  ├── "Go back and change passphrase" → modal closes, form keeps the typed value
  └── "I've saved it — Open Vault"    → unlockVault()
        │
        ▼
      setShowSaveAlert(false); setLoading(true); loadingStep='unlocking'; error=""
        │
        ▼
      POST /api/auth/unlock { passphrase }
        ├── 404 → deleted-user path (see Sub-flow 7)
        ├── other non-2xx → setError(message); overlay hidden; form shown with the error
        └── 200 { success: true, firstTime: true }
              │
              ▼
            loadingStep='syncing'
              │
              ▼
            Promise.all([
              savePreference('country', <detected country>),
              savePreference('locale',  <detected/selected locale>),
              savePreference('theme',   <current theme, 'dark' if unset>),
            ])                       ← three PATCH /api/preferences, one user_preference row each
              │
              ▼
            loadingStep='done'; router.push('/dashboard'); router.refresh()
            (overlay stays until the dashboard replaces this page)
```

The server sets `users.verifier` during this request, so from then on the user is a returning user. The passphrase is shown only in the modal and is never stored client-side; refreshing the tab before confirming loses it, and nothing has been created on the server at that point.

### 5. Returning user (`isNewUser: false`)

```
unlockVault()
  │
  ▼
setLoading(true); loadingStep='unlocking'; error=""
  │
  ▼
POST /api/auth/unlock { passphrase }
  ├── 404 → deleted-user path (see Sub-flow 7)
  ├── 401 "Invalid passphrase" → error shown, overlay hidden, reset link offered
  ├── other non-2xx → error shown, overlay hidden
  └── 200 { success: true, firstTime: false }
        │
        ▼
      loadingStep='syncing'
        │
        ▼
      GET /api/preferences
        ├── ok → apply saved locale, country, theme (setLocale / setCountry / setTheme)
        └── not ok → skipped; defaults stay in effect
        │
        ▼
      loadingStep='done'; router.push('/dashboard')
      (overlay stays until the dashboard replaces this page)
```

A thrown error at any point (network failure, invalid JSON) shows "Something went wrong. Please try again." and hides the overlay.

### 6. Reset vault

Offered only when `error === "Invalid passphrase"`:

```
"Forgot your passphrase? Reset vault →" → setShowReset(true)
  │
  ▼
Reset panel: "⚠ This will permanently delete all vault data" +
  "Your passphrase cannot be recovered. Resetting will erase all your holdings and let you set a new passphrase. This cannot be undone."
  │
  ├── "Cancel" → panel closes
  └── "Yes, delete everything" (button reads "Resetting…" while in flight)
        │
        ▼
      POST /api/auth/reset-vault
        │  server: users.verifier = null; session.encryptionKey cleared
        ▼
      setIsNewUser(true); setPassphrase(""); setError(""); setShowReset(false)
```

The client does not inspect the response status. After a reset the user has no passphrase set up, so the next submit follows the first-time flow (Sub-flow 4), including the save-passphrase modal. The route itself only clears the verifier and the session key; it does not delete any other rows.

### 7. Deleted user (stale session)

If `/api/auth/unlock` returns `404` (the session's user no longer exists — for example after a database wipe or account deletion):

```
setTheme('system') → POST /api/auth/signout → window.location.href = "/"
```

The overlay stays up during the redirect.

### 8. Sign out

```
User clicks "Sign out"
  │
  ▼
setTheme('system')   ← drops the applied theme; the stored preference is untouched
  │                    and restored by PreferencesSync on the next sign-in
  ▼
POST /api/auth/signout   ← session.destroy(): userId, encryptionKey, everything
  │
  ▼
window.location.href = "/"   ← full page load, clearing Next.js client cache and React state
```

`window.location.href` is used instead of `router.push()` because a client-side navigation can race with session clearing.

---

## Passphrase Validation

The same five rules are enforced in two places, kept in sync manually — there is no shared import, only parallel logic:

- **Client** (`UnlockClient.tsx`) — computed on every keystroke; drives the checklist and disables the submit button:
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
- **Server** (`passphraseValidation.ts`, `validatePassphrase()`) — identical thresholds, invoked by the unlock route only when the user has no verifier (first-time setup). A returning user's passphrase is never re-validated for strength; it is only compared against the stored verifier. The first failing message is returned as `400 { error }`:
  - "Passphrase must be at least 12 characters"
  - "Passphrase must contain a letter and a number"
  - "Passphrase must contain at least two uppercase letters"
  - "Passphrase must contain at least two special characters"
  - "Passphrase must be 256 characters or fewer"

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
keyHex = EncryptionService.deriveKey(passphrase)   ← scrypt with ENCRYPTION_SALT, 32-byte key
  │
  ▼
Does user.verifier exist?
  │
  ├── No (first-time)
  │     validatePassphrase(passphrase)
  │       ├── invalid ───────────────────────► 400 { error: <first validation error> }
  │       └── valid → prisma.user.update({ verifier: createVerifier(keyHex) })
  │
  └── Yes (returning)
        verifyKey(keyHex, user.verifier)
          ├── mismatch ─────────────────────► 401 { error: "Invalid passphrase" }
          └── match (no DB write)
  │
  ▼
session.encryptionKey = keyHex; await session.save()
  │
  ▼
reconcileSupersedingSubscriptions({ userId })   ← resolves any plan change that has come due
  │
  ▼
200 { success: true, firstTime: !user.verifier }
```

An unhandled exception anywhere in the handler returns `500 { error: "Failed to unlock" }`.

The passphrase is used only inside this handler. `keyHex` (the derived key, not the passphrase) is stored only in the iron-session cookie for the session's duration (8 hours, per `src/lib/session.ts`).

`createVerifier(keyHex)` = `encrypt("PORTFOLIO_APP_V1", keyHex)` (AES-256-GCM, stored as `iv:authTag:ciphertext` hex). `verifyKey(keyHex, verifier)` = `decrypt(verifier, keyHex) === "PORTFOLIO_APP_V1"`, returning `false` instead of throwing when decryption fails.

### Database effect

| Case | Write |
|---|---|
| First-time (verifier is `NULL`) | `UPDATE users SET verifier = <encrypted blob> WHERE id = ...` |
| Returning, correct passphrase | No write to `users` — `verifier` is only read and compared |
| Returning, wrong passphrase | No write — the request fails at the `verifyKey` check |
| Any successful unlock | `reconcileSupersedingSubscriptions` may update `subscriptions` rows (and the user's plan cache) and call Razorpay to cancel or resume a superseded subscription whose scheduled change has come due; it changes nothing when no plan change is due |

The handler does not run in a database transaction; the session write is a cookie operation, not a database operation.

---

## Notes

- **`/api/auth/reset-vault` scope.** The route clears `users.verifier` and the session's `encryptionKey` only. The reset panel's copy describes erasing holdings; no holdings rows are touched by this route.
- **Client/server rule duplication.** The five strength rules exist in `UnlockClient.tsx` and `passphraseValidation.ts`; changing one requires changing the other.

---

## Theme Pattern

Same dark/light pattern as the rest of the app: `next-themes`' `ThemeProvider` (see `src/app/layout.tsx`), with the `ThemeTogglePill` in the `AppBar` (shown on this route and on `/`, from the `md` breakpoint up) letting the user switch modes. All theme-sensitive colors are the shared `--ui-*` / `--warm-*` CSS custom properties from `globals.css` (light on `:root`, dark on `.dark`), used as inline styles rather than Tailwind's `dark:` classes.

The left panel uses a stronger tint (`--unlock-left-bg`) to separate it from the right panel (`--unlock-right-bg`); both have distinct light and dark values.

---

## API Routes Used by This Page

| Method | Route | When |
|--------|-------|------|
| POST | `/api/auth/unlock` | When the passphrase is submitted (returning user) or confirmed in the save-passphrase modal (first-time user) |
| PATCH | `/api/auth/avatar` | On avatar file select |
| GET | `/api/preferences` | After a successful returning-user unlock |
| PATCH | `/api/preferences` | Three times after a successful first-time unlock (country, locale, theme) |
| POST | `/api/auth/reset-vault` | Reset vault confirmation |
| POST | `/api/auth/signout` | Sign out button, and the deleted-user (`404`) path |

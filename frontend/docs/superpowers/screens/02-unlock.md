# Screen: Unlock Page (`/unlock`)

> Read `00-global-architecture.md` first.

This is the most complex single-page component in the app. It has two panels, five distinct sub-states, avatar upload with canvas resizing, passphrase strength validation, a first-time confirmation modal, and a reset vault flow. This doc is the authoritative reference.

---

## Purpose

The unlock page bridges OAuth authentication and vault access. A user reaches it when:
- They are **authenticated** (have a valid `userId` cookie) but
- The vault is **locked** (no `encryptionKey` in session)

Its job is to accept a passphrase, POST it to `/api/auth/unlock`, and — if valid — receive the derived key stored in the session cookie, then redirect to `/dashboard`.

---

## File Map

| File | Role |
|------|------|
| `src/app/unlock/page.tsx` | Entire unlock page — two-panel layout, all state, all flows |
| `src/app/api/auth/unlock/route.ts` | POST handler — deriveKey, verify/create verifier, store encryptionKey in session |
| `src/app/api/auth/me/route.ts` | GET handler — returns `{ user: { id, name, email, avatar, platform } }` |
| `src/app/api/auth/avatar/route.ts` | PATCH handler — saves base64 JPEG to `user.avatar` in DB |
| `src/app/api/auth/signout/route.ts` | POST handler — clears session, used by Sign Out button |
| `src/app/api/auth/reset-vault/route.ts` | POST handler — deletes all asset rows + clears verifier blob |
| `src/components/layout/AppBar.tsx` | Top bar still visible (from root layout) |
| `src/lib/services/EncryptionService.ts` | Used server-side by unlock route — deriveKey, verifyKey, createVerifier |
| `src/lib/validation/passphraseValidation.ts` | Re-exports strength rules used both client-side and server-side |
| `src/lib/session.ts` | iron-session config — getSession(), saveSession() |

---

## Component Hierarchy

```
Root Layout
└── AppBar
    └── UnlockPage (src/app/unlock/page.tsx)   ['use client']
        ├── Ambient orb divs (aria-hidden)
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
        │       │   └── "Unlock Vault" submit button
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
| `error` | `string` | Server error message from unlock API |
| `loading` | `boolean` | True while POSTing to /api/auth/unlock |
| `avatarUploading` | `boolean` | True while resizing + PATCHing avatar |
| `avatarError` | `string` | Error from avatar upload |
| `showReset` | `boolean` | Shows the destructive reset panel |
| `resetting` | `boolean` | True while POSTing to /api/auth/reset-vault |
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
  └── { } (no user) → POST /api/auth/signout → window.location.href = "/"
```

If `/api/auth/me` returns no user (stale session after DB wipe), the page self-signs-out and redirects to `/`. This prevents a logged-in-but-ghost-user state.

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

### 3. Passphrase submission (returning user)

```
User types passphrase → live validation updates `checks` object
  │
  ▼  (all 5 checks pass — button enabled)
User clicks "Unlock Vault" (or presses Enter)
  │
  ▼
POST /api/auth/unlock   { passphrase }
  ├── 200 { firstTime: false } → router.push('/dashboard') + router.refresh()
  ├── 200 { firstTime: true }  → setShowSaveAlert(true)   ← first-time setup path
  └── 4xx { error }            → setError(message)
```

### 4. First-time setup path

When `POST /api/auth/unlock` returns `{ firstTime: true }`:
- `showSaveAlert` becomes `true`
- The modal appears, showing the passphrase in a copyable monospace box
- User must click "I've saved it — Open Vault" → `handleOpenVault()` → `router.push('/dashboard')`
- The passphrase is shown only once (it is not stored anywhere after this)

### 5. Reset vault flow

Surfaces only when `error === "Invalid passphrase"`:
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
  └── Deletes all asset rows + clears user.verifier in DB
      → setPassphrase('') + setError('') + setShowReset(false)
      User can now create a new passphrase
```

### 6. Sign out

```
User clicks "Sign out"
  │
  ▼
POST /api/auth/signout   ← clears userId + encryptionKey from session
  │
  ▼
window.location.href = "/"   ← full page reload to clear Next.js client cache
```

`router.push()` is intentionally not used here because it can race with session clearing. `window.location.href` guarantees the full browser navigation and state reset.

---

## Passphrase Validation (client-side)

Computed live from the `passphrase` state value:

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

The submit button is disabled and Enter-key submission is blocked while `!allValid`. The input border changes from neutral → red (partially typed, failing) → green (all checks met).

---

## Server-side: `/api/auth/unlock` Logic

```
POST { passphrase }
  │
  ▼
SessionService.requireSession()   ← must have userId (OAuth done)
  │
  ▼
EncryptionService.deriveKey(passphrase)   ← scrypt(passphrase, ENCRYPTION_SALT)
  │                                          → keyHex (32-byte hex)
  ▼
Does user.verifier exist in DB?
  ├── No  → EncryptionService.createVerifier(keyHex)
  │         → save to user.verifier
  │         → save keyHex to session.encryptionKey
  │         → return { firstTime: true }
  └── Yes → EncryptionService.verifyKey(user.verifier, keyHex)
            ├── match → save keyHex to session.encryptionKey
            │           return { firstTime: false }
            └── mismatch → 401 { error: "Invalid passphrase" }
```

The passphrase never leaves this route handler. `keyHex` exists only in the iron-session cookie for the duration of the session.

---

## Theme Pattern

Same `mounted`/`isDark` pattern as the landing page — defaults to dark during SSR, switches after hydration. All theme-sensitive colours are inline styles, not Tailwind classes.

Left panel uses a stronger directional gradient (`leftBg`) to visually separate it from the right panel (`rightBg`). Both adapt to dark/light mode.

---

## API Routes Used by This Page

| Method | Route | When |
|--------|-------|------|
| GET | `/api/auth/me` | On mount — load user name/avatar |
| POST | `/api/auth/unlock` | On form submit |
| PATCH | `/api/auth/avatar` | On file select |
| POST | `/api/auth/signout` | Sign Out button |
| POST | `/api/auth/reset-vault` | Reset vault confirm |

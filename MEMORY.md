# Project Memory

> Auto-maintained session log. Add notes here for future Claude sessions to pick up context instantly.

---

## Secure Wealth Vault — Project Context

**Repo:** `/Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/portfolio-dashboard/frontend`
**Stack:** Next.js 14.1.0 App Router · Prisma 5 + PostgreSQL (Railway) · iron-session v8 · Tailwind CSS · next-themes · jose · lucide-react

### What the app is
A personal, zero-knowledge encrypted portfolio tracker. All holdings are encrypted client-side with AES-256-GCM before storage. The passphrase is never stored — only a per-user verifier (`"PORTFOLIO_APP_V1"` encrypted with the derived key) lives in `users.verifier`.

### Auth flow
1. User lands on `/` → signs in via Google / Apple / X / LinkedIn
2. OAuth success → redirect to `/unlock`
3. User enters passphrase → `scrypt(passphrase, ENCRYPTION_SALT, 32)` derives AES key → session stores `encryptionKey`
4. All routes require both `session.userId` and `session.encryptionKey` (enforced by middleware)

### Key API routes
| Route | Method | Purpose |
|---|---|---|
| `/api/auth/me` | GET | Returns current user from DB |
| `/api/auth/unlock` | POST | Verifies passphrase; creates verifier on first use |
| `/api/auth/lock` | POST | Clears `session.encryptionKey` only — user stays OAuth-authenticated |
| `/api/auth/signout` | POST | Destroys full session |
| `/api/auth/reset-vault` | POST | Nullifies verifier + deletes current user's encrypted holdings |
| `/api/auth/avatar` | PATCH | Saves base64 avatar ≤500KB to `users.avatar` |

### Per-user verifier
- `users.verifier String?` — null = first-time setup
- First time: enforce all 5 passphrase strength rules → `encrypt("PORTFOLIO_APP_V1", derivedKey)` → save
- Returning: `decrypt(user.verifier, derivedKey)` — AES-GCM auth tag failure = wrong passphrase = 401
- `SEED_PASSPHRASE` env var has been **permanently removed** — do not re-add

### Passphrase strength rules (client + server enforced)
| Rule |
|---|
| At least 12 characters |
| Contains a letter and a number |
| At least two uppercase letters |
| At least two special characters |
| Under 256 characters |

### Multi-user data isolation
All 9 holdings tables have `userId String`. All GET/POST/DELETE routes scope queries to `where: { userId }`.
Tables: `equity_holdings`, `mutual_funds`, `nps_holdings`, `crypto_holdings`, `post_office_schemes`, `fixed_deposits`, `foreign_holdings`, `other_investments`, `bank_accounts`

### OAuth callback fix
All 4 callbacks use `cookies().delete()` from `next/headers` (not `response.cookies.delete()`) — the two pipelines conflict in Next.js 14 and silently drop the session cookie.

### Middleware
- `/unlock` — requires `session.userId`
- All other protected routes — require `session.userId` + `session.encryptionKey`
- Stale session (userId in cookie but user deleted from DB) → unlock page auto-signouts via `window.location.href = "/"`

### Environment variables
```
DATABASE_URL · ENCRYPTION_SALT · SESSION_SECRET · NEXT_PUBLIC_APP_URL
GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
X_CLIENT_ID / X_CLIENT_SECRET
LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET
APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_CLIENT_ID / APPLE_PRIVATE_KEY
```

---

## Dashboard Layout (updated 2026-04-14)

**AppBar** (`src/components/layout/AppBar.tsx`)
- Height: `h-14` (3.5rem) — AppShell uses `h-[calc(100vh-3.5rem)]`
- Left: brand icon + "Secure Wealth Vault"
- Right: `ProfileBadge` only — no theme toggle here

**Sidebar** (`src/components/layout/Sidebar.tsx`)
- Nav items (11 routes) → `ThemeTogglePill` section (border-t) → user avatar + sign-out (border-t)
- ThemeTogglePill lives at the bottom of the sidebar, not in the AppBar

**InactivityLock** (`src/components/layout/InactivityLock.tsx`)
- Mounted in `AppShell` — active on all authenticated pages
- Events tracked: `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click`
- After **60 seconds** of silence → `POST /api/auth/lock` → `window.location.href = "/unlock"`
- Renders `null` — purely behavioural

---

## CLAUDE.md (set 2026-04-14)

File at repo root: `/Users/rahulsingh/Documents/Documents/CreativeAppz/Github/Finance/CLAUDE.md`
Source: https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md

Four rules:
1. **Think Before Coding** — state assumptions, ask if unclear, surface tradeoffs
2. **Simplicity First** — minimum code, no speculative features or abstractions
3. **Surgical Changes** — touch only what the request requires; clean up only your own orphans
4. **Goal-Driven Execution** — verifiable success criteria before starting; plan multi-step work upfront

---

## Globally Installed Skills (installed 2026-04-14)

Located in `~/.claude/skills/` — active across all projects.

### Superpowers (obra/superpowers) — 14 skills
`brainstorming` · `writing-plans` · `test-driven-development` · `systematic-debugging` · `subagent-driven-development` · `executing-plans` · `dispatching-parallel-agents` · `using-git-worktrees` · `requesting-code-review` · `receiving-code-review` · `finishing-a-development-branch` · `verification-before-completion` · `writing-skills` · `using-superpowers`

### UI/UX Pro Max (nextlevelbuilder/ui-ux-pro-max-skill) — 7 skills
`ui-ux-pro-max` · `design` · `ui-styling` · `design-system` · `brand` · `slides` · `banner-design`

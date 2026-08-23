# Global Architecture

> Applies to every screen. Read this before any per-screen doc.

---

## Application at a Glance

SecureWealthVault is a **Next.js 14 App Router** full-stack application. All pages live under `src/app/`. The app follows a strict zero-knowledge design — the server never sees plaintext financial data.

---

## Directory Map

```
src/
├── app/                         # Next.js App Router pages & API routes
│   ├── layout.tsx               # Root layout — wraps every page
│   ├── page.tsx                 # Landing page (/)
│   ├── unlock/page.tsx          # Vault unlock (/unlock)
│   ├── dashboard/page.tsx       # Dashboard (/dashboard)
│   ├── holdings/page.tsx        # Equity holdings
│   ├── crypto/page.tsx          # Cryptocurrency
│   ├── mutual-funds/page.tsx    # Mutual funds
│   ├── nps/page.tsx             # NPS
│   ├── fd-rd-ppf/page.tsx       # Fixed deposits, RD, PPF
│   ├── post-office/page.tsx     # Post office schemes
│   ├── foreign/page.tsx         # Foreign holdings
│   ├── bank/page.tsx            # Bank accounts
│   ├── others/page.tsx          # Insurance / LIC
│   ├── currencies/page.tsx      # Currency rates manager
│   └── api/                     # API route handlers
│       ├── auth/                # OAuth, unlock, lock, signout, reset-vault
│       ├── holdings/            # GET/POST + [id] PUT/DELETE
│       ├── crypto/              # ...same pattern × 8 more asset types
│       ├── portfolio/route.ts   # GET aggregated summary
│       ├── currencies/          # GET/POST + [id] + /populate
│       ├── preferences/route.ts # GET + PATCH user preferences (country/locale/theme)
│       └── nav/route.ts         # GET nav items filtered by country
│
├── components/
│   ├── layout/
│   │   ├── AppBar.tsx           # Top nav bar (global, in root layout)
│   │   ├── AppShell.tsx         # Sidebar + Header + InactivityLock wrapper
│   │   ├── Sidebar.tsx          # Left nav, user info, locale/country picker; nav items from /api/nav
│   │   ├── Header.tsx           # Page title + subtitle bar
│   │   ├── InactivityLock.tsx   # Auto-lock timer (60 s default)
│   │   ├── ProfileBadge.tsx     # Avatar + name in AppBar
│   │   ├── ThemeTogglePill.tsx  # Dark/light toggle; saves theme preference to DB
│   │   └── PreferencesSync.tsx  # Renders null; loads DB prefs on mount, applies to context
│   ├── dashboard/
│   │   ├── SummaryCards.tsx     # Five KPI cards
│   │   ├── AssetAllocationChart.tsx  # Pie chart
│   │   ├── PLBarChart.tsx       # P&L bar chart
│   │   └── CategoryCards.tsx    # Per-category breakdown cards
│   └── ui/
│       ├── DataTable.tsx        # Sortable, searchable table with edit/delete
│       ├── EditModal.tsx        # Form modal for create/update
│       ├── Badge.tsx            # Coloured badge chip
│       └── Card.tsx             # White/dark rounded card container
│
├── context/
│   ├── CurrencyContext.tsx      # Global currency state + format helpers
│   └── LocaleContext.tsx        # i18n locale + country
│
├── hooks/
│   └── useAsset.ts              # Generic data-fetching + mutation hook
│
└── lib/
    ├── interfaces/              # TypeScript contracts (DIP layer)
    │   ├── IAssetRepository.ts
    │   ├── IAssetService.ts
    │   ├── IEncryptionService.ts
    │   ├── IPortfolioService.ts
    │   ├── ISessionService.ts
    │   ├── ICurrencyRepository.ts
    │   └── IUserRepository.ts
    ├── repositories/            # Prisma implementations of interfaces
    │   ├── AssetRepository.ts
    │   ├── UserRepository.ts
    │   └── CurrencyRepository.ts
    ├── services/                # Business logic
    │   ├── AssetService.ts
    │   ├── PortfolioService.ts
    │   ├── EncryptionService.ts
    │   └── SessionService.ts
    ├── validation/
    │   ├── passphraseValidation.ts
    │   └── assetValidation.ts
    ├── savePreference.ts        # Fire-and-forget PATCH /api/preferences helper
    ├── types.ts                 # Shared TypeScript interfaces for all asset models
    ├── errors.ts                # NotFoundError, UnauthorizedError
    ├── encryption.ts            # AES-256-GCM + scrypt primitives
    ├── session.ts               # iron-session config
    ├── prisma.ts                # Prisma client singleton
    └── utils.ts                 # formatINR, pnlClass, formatDate, daysRemaining
```

---

## Root Layout — `src/app/layout.tsx`

Every page is wrapped by the root layout. Provider order matters.

```
<html>
  <body>
    <ThemeProvider>        ← next-themes, default dark
      <LocaleProvider>     ← i18n locale + country (reads cookies on init)
        <CurrencyProvider> ← fetches /api/currencies, exposes format(), convert()
          <PreferencesSync />  ← renders null; loads DB prefs on mount, overrides cookies
          <AppBar />       ← top navigation bar (visible on all pages)
          {children}       ← page content
        </CurrencyProvider>
      </LocaleProvider>
    </ThemeProvider>
  </body>
</html>
```

**Key point:** `CurrencyProvider` fetches `/api/currencies` on mount and keeps rates in React state. All asset pages that format monetary values call `useCurrency()` to access `format()` — never format directly.

---

## Authenticated Page Layout — `AppShell`

All post-login pages (`/dashboard`, `/holdings`, etc.) render through `AppShell`:

```
AppShell
├── InactivityLock   — invisible client component, auto-POSTs /api/auth/lock after 60s idle
├── Sidebar          — left nav, sign-out, locale/country picker, user badge
├── Header           — page title + subtitle strip
└── <main>           — scrollable content area (children)
```

`AppShell` is a **server component**. `InactivityLock` and `Sidebar` are client components.

---

## Authentication & Session Flow

```
User clicks "Continue with Google"
        │
        ▼
GET /api/auth/google          → redirects to Google OAuth
        │
Google redirects back to
GET /api/auth/google/callback → exchanges code, upserts User in DB,
                                sets iron-session cookie (userId)
        │
        ▼
Middleware (middleware.ts)    → checks iron-session cookie
  ├── no userId → /           (unauthenticated)
  └── no encryptionKey → /unlock  (authenticated but vault locked)
        │
        ▼
POST /api/auth/unlock         → deriveKey(passphrase) via scrypt,
                                verifies/creates verifier blob,
                                stores encryptionKey in session
        │
        ▼
/dashboard                    (fully authenticated + vault open)
```

**Session data shape (iron-session):**

| Field           | Type   | Set by         | Cleared by          |
|-----------------|--------|----------------|---------------------|
| `userId`        | string | OAuth callback | signout / reset     |
| `encryptionKey` | string | unlock route   | lock / signout      |

---

## SOLID Layer Map

```
API Route Handler
    │  depends on interface
    ▼
IAssetService<T>  ←──── AssetService<T>  (src/lib/services/)
    │  depends on interface                    │
    ▼                                          ├── IAssetRepository<T>
IAssetRepository<T> ←── AssetRepository<T>   │     (src/lib/repositories/)
                                               └── IEncryptionService
                                                     ←── EncryptionService

IPortfolioService  ←── PortfolioService
    │                       ├── 9× IAssetRepository
    │                       ├── IEncryptionService
    │                       └── ICurrencyRepository ←── CurrencyRepository

ISessionService  ←── SessionService (singleton)
    └── used by every API route handler that needs auth
```

No service imports Prisma directly. No API route contains business logic — it delegates entirely to the service layer.

---

## Encryption Architecture (Zero-Knowledge)

```
User types passphrase
        │
        ▼
scrypt(passphrase, salt=env.ENCRYPTION_SALT)
        │
        ▼
keyHex (32-byte hex)  ← stored ONLY in iron-session (server-side cookie)
        │
        ├── First unlock: AES-256-GCM encrypt("PORTFOLIO_APP_V1", keyHex)
        │                 → save verifier blob to DB (user.verifier)
        │
        └── Subsequent: AES-256-GCM decrypt(user.verifier, keyHex)
                        → compare with "PORTFOLIO_APP_V1"

Asset data at rest:
    JSON.stringify(assetFields)
        → AES-256-GCM encrypt(plaintext, keyHex)
        → stored as encryptedData in DB

Asset data on read:
    AES-256-GCM decrypt(encryptedData, keyHex)
        → JSON.parse → typed asset object
```

The passphrase never travels over the network. The keyHex exists only in the server-side session cookie during an active session.

---

## CurrencyContext — Global State

`CurrencyProvider` fetches `/api/currencies` on mount and exposes:

| Value                 | Description                                    |
|-----------------------|------------------------------------------------|
| `currencies`          | Array of all CurrencyRate records              |
| `selectedCurrency`    | Persisted to localStorage as `portfolio_currency` |
| `format(inrAmt)`      | Convert INR → selected currency and format     |
| `convert(inrAmt)`     | Returns raw number in selected currency        |
| `symbol`              | Currency symbol string (₹, $, €, etc.)         |
| `rate`                | INR per 1 unit of selected currency            |
| `refetchCurrencies()` | Force re-fetch from server (called after edits)|

All monetary values in the DB are stored in **INR**. Foreign holdings store USD values; `PortfolioService` converts them using the USD rate at query time.

---

## UI Component Contracts

### `DataTable<T>`
Props: `data`, `columns`, `loading`, `onEdit(row)`, `onDelete(id)`, `onAdd()`, `addLabel`, `searchKey`, `searchPlaceholder`

Columns can have a `render(value, row)` function for custom cells.

### `EditModal`
Props: `isOpen`, `onClose`, `title`, `onSubmit(e)`, `loading`
Contains `FieldGrid` + `Field` sub-components.

### `Field`
Can be controlled (`value` + `onChange`) or uncontrolled (`defaultValue`). `readOnly` disables the input.

---

## Key Environment Variables

| Variable                        | Purpose                              |
|---------------------------------|--------------------------------------|
| `ENCRYPTION_SALT`               | scrypt salt for key derivation       |
| `SESSION_PASSWORD`              | iron-session signing secret          |
| `NEXT_PUBLIC_INACTIVITY_TIMEOUT_MS` | Auto-lock delay (default 60000 ms) |
| `DATABASE_URL`                  | Prisma database connection           |
| `GOOGLE_CLIENT_ID/SECRET`       | Google OAuth                         |
| `APPLE_CLIENT_ID/SECRET`        | Apple Sign In                        |
| `LINKEDIN_CLIENT_ID/SECRET`     | LinkedIn OAuth                       |
| `X_CLIENT_ID/SECRET`            | X (Twitter) OAuth                    |

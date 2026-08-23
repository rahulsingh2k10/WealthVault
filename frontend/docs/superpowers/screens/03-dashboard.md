# Screen: Dashboard (`/dashboard`)

> Read `00-global-architecture.md` first.

---

## Purpose

The dashboard is the **portfolio overview screen**. It aggregates every asset category into a single view: five KPI summary cards, a donut chart of asset allocation, a P&L bar chart, and a row of per-category cards that link to their respective detail pages.

This is the only page in the app that is a **React Server Component**. It fetches data at request time on the server and passes it as props to its (client) child components. There are no client-side data fetches, no loading states, and no `useEffect` calls on this page.

---

## File Map

| File | Role |
|------|------|
| `src/app/dashboard/page.tsx` | Server component — session check, service call, JSX |
| `src/lib/services/PortfolioService.ts` | Aggregates all 9 asset categories + USD rate |
| `src/lib/interfaces/IPortfolioService.ts` | Interface implemented by PortfolioService |
| `src/lib/repositories/AssetRepository.ts` | Generic Prisma repository used for all 9 asset tables |
| `src/lib/repositories/CurrencyRepository.ts` | Fetches USD rate from `currencyRate` table |
| `src/lib/services/EncryptionService.ts` | Decrypts each row's `encryptedData` blob |
| `src/lib/session.ts` | `getSession()` — reads iron-session cookie server-side |
| `src/lib/prisma.ts` | Prisma client singleton |
| `src/lib/types.ts` | `PortfolioSummary`, `CategorySummary` interfaces |
| `src/components/layout/AppShell.tsx` | Server component shell — Sidebar, Header, InactivityLock |
| `src/components/dashboard/SummaryCards.tsx` | Five KPI cards |
| `src/components/dashboard/AssetAllocationChart.tsx` | Recharts donut pie chart |
| `src/components/dashboard/PLBarChart.tsx` | Recharts bar chart (invested vs current per category) |
| `src/components/dashboard/CategoryCards.tsx` | Grid of per-category summary cards with nav links |
| `src/context/CurrencyContext.tsx` | All dashboard child components call `useCurrency()` for formatting |
| `src/lib/utils.ts` | `ASSET_COLORS`, `ASSET_COLOR_LIST` — colour palette for charts |

---

## Component Hierarchy

```
DashboardPage   [Server Component — no 'use client']
└── AppShell (title="Dashboard")   [Server Component]
    ├── InactivityLock              [Client Component]
    ├── Sidebar                     [Client Component]
    ├── Header (title, subtitle)    [Client Component]
    └── <main>
        └── <div class="flex flex-col gap-6">
            ├── SummaryCards        [Client Component]
            │   └── 5× KPI card (icon, label, value, sub)
            ├── <div class="grid grid-cols-1 lg:grid-cols-2">
            │   ├── AssetAllocationChart   [Client Component]
            │   │   └── Recharts PieChart (donut)
            │   │       └── CustomTooltip (useCurrency)
            │   └── PLBarChart             [Client Component]
            │       └── Recharts BarChart
            └── CategoryCards              [Client Component]
                └── N× category card (Link → detail page)
```

All four dashboard components are `'use client'` because they use `useCurrency()` (which requires React context) and Recharts (which needs browser APIs). They receive their data as props from the server component.

---

## Service Construction (module-level singleton)

```typescript
// src/app/dashboard/page.tsx — module scope, not inside the function
const portfolioService = new PortfolioService(
  {
    equityHoldings:    new AssetRepository(prisma.equityHolding),
    mutualFunds:       new AssetRepository(prisma.mutualFund),
    npsHoldings:       new AssetRepository(prisma.npsHolding),
    cryptoHoldings:    new AssetRepository(prisma.cryptoHolding),
    postOfficeSchemes: new AssetRepository(prisma.postOfficeScheme),
    fixedDeposits:     new AssetRepository(prisma.fixedDeposit),
    foreignHoldings:   new AssetRepository(prisma.foreignHolding),
    otherInvestments:  new AssetRepository(prisma.otherInvestment),
    bankAccounts:      new AssetRepository(prisma.bankAccount),
  },
  new EncryptionService(),
  new CurrencyRepository()
)
```

Constructed at module level so it is created once per server process (Next.js module caching), not once per request.

---

## Data Flow

```
GET /dashboard
      │
      ▼
DashboardPage() — async server component
      │
      ├── getSession()                     ← iron-session: reads signed cookie
      │   └── !encryptionKey → redirect('/unlock')
      │
      ▼
portfolioService.getSummary(userId, encryptionKey)
      │
      ├── Promise.all([
      │     equityRepo.findAll(userId),
      │     mutualFundRepo.findAll(userId),
      │     ... 7 more repos ...
      │     currencyRepo.findByCode('USD'),
      │   ])
      │
      ├── Per repo: decrypt each row → parse JSON → typed asset object
      │
      └── Aggregate:
          • totalInvested  = sum of purchaseAmount across all investment categories
          • currentValue   = sum of currentAmount across all investment categories
          • totalPnL       = currentValue - totalInvested
          • overallReturn  = totalPnL / totalInvested
          • bankBalance    = sum of BankAccount.balance
          • totalAssets    = currentValue + bankBalance
          • categories[8]  = per-category { name, purchaseAmount, currentAmount, pnl, netChange }
          • usdRate        = CurrencyRate.rate for 'USD'
      │
      ▼
PortfolioSummary object passed as props to four child components
```

Foreign holdings are stored in USD. `PortfolioService` multiplies `currentAmountUsd` × `usdRate` to include them in INR totals.

---

## PortfolioSummary Shape

```typescript
interface PortfolioSummary {
  totalInvested: number    // INR — sum across 8 investment categories
  currentValue:  number    // INR
  totalPnL:      number    // INR
  overallReturn: number    // decimal (0.12 = 12%)
  bankBalance:   number    // INR — bank accounts only
  totalAssets:   number    // currentValue + bankBalance
  usdRate:       number    // INR per 1 USD (from CurrencyRate table)
  categories: CategorySummary[]  // 8 entries, one per investment category
}

interface CategorySummary {
  name:           string   // "Holdings", "Mutual Funds", etc.
  purchaseAmount: number
  currentAmount:  number
  pnl:            number
  netChange:      number   // decimal ratio
}
```

---

## Dashboard Components in Detail

### SummaryCards (`src/components/dashboard/SummaryCards.tsx`)

- Receives `summary: PortfolioSummary`
- Calls `useCurrency()` for `format()`
- Renders 5 cards in a `grid-cols-2 lg:grid-cols-4 xl:grid-cols-5`:

| Card | Value | Icon |
|------|-------|------|
| Total Invested | `format(totalInvested)` | Wallet |
| Current Value | `format(currentValue)` | BarChart3 |
| Total P&L | `±format(totalPnL)` + return% | TrendingUp/Down |
| Total Assets | `format(totalAssets)` | IndianRupee |
| Bank Balance | `format(bankBalance)` | Building2 |

P&L card changes colour: green (`text-emerald-*`) when positive, red (`text-red-*`) when negative.

### AssetAllocationChart (`src/components/dashboard/AssetAllocationChart.tsx`)

- Receives `categories: CategorySummary[]`
- Filters to `currentAmount > 0` only
- Recharts `PieChart` with `innerRadius=60` (donut shape)
- Each slice colour from `ASSET_COLORS[name]` (named lookup) or `ASSET_COLOR_LIST[i]` (fallback)
- `CustomLabel` shows percentage inside slice if slice ≥ 5%
- `CustomTooltip` calls `useCurrency().format()` to show current value on hover

### PLBarChart (`src/components/dashboard/PLBarChart.tsx`)

- Receives `categories: CategorySummary[]`
- Recharts `BarChart` — two bars per category: Invested vs Current
- X-axis: short category names; Y-axis: formatted amounts

### CategoryCards (`src/components/dashboard/CategoryCards.tsx`)

- Receives `categories: CategorySummary[]`
- Filters to `purchaseAmount > 0` (avoids empty cards)
- Each card is a Next.js `<Link>` pointing to the category's detail route:

```typescript
const CATEGORY_ROUTES = {
  Holdings:         '/holdings',
  'Mutual Funds':   '/mutual-funds',
  NPS:              '/nps',
  Cryptocurrency:   '/crypto',
  'Post Office':    '/post-office',
  'FD/RD/PPF':      '/fd-rd-ppf',
  'Foreign Holdings': '/foreign',
  Others:           '/others',
}
```

- Shows: category dot (coloured), name, current value, return % with TrendingUp/Down icon
- `hover:border-indigo-200 hover:shadow-sm` — subtle hover state indicating it's navigable

---

## Auth Guard

```typescript
const session = await getSession()
if (!session.encryptionKey) redirect('/unlock')
```

This is the server-side guard. Middleware also enforces this, but the explicit check here means a direct function call never proceeds without a key — defence in depth.

---

## What This Page Does NOT Do

- No client-side data fetching — all data arrives as server-rendered props
- No loading spinners (data is ready before the page renders)
- No edit/delete capability — read-only overview
- The `usdRate` from `PortfolioSummary` is not currently forwarded to child components — foreign holdings are already converted to INR by `PortfolioService`

# Screen: Asset Pages (9 pages)

> Read `00-global-architecture.md` first.

All nine asset pages share an identical architecture. This doc describes the shared pattern once, then lists per-page differences (route, type, columns, form fields, unique behaviours) for each.

---

## Pages Covered

| Route | Page File | Asset Type |
|-------|-----------|------------|
| `/holdings` | `src/app/holdings/page.tsx` | Indian equity stocks |
| `/crypto` | `src/app/crypto/page.tsx` | Cryptocurrency |
| `/mutual-funds` | `src/app/mutual-funds/page.tsx` | Mutual funds |
| `/nps` | `src/app/nps/page.tsx` | NPS (National Pension System) |
| `/fd-rd-ppf` | `src/app/fd-rd-ppf/page.tsx` | Fixed deposits, RD, PPF |
| `/post-office` | `src/app/post-office/page.tsx` | Post office schemes (KVP, NSC) |
| `/foreign` | `src/app/foreign/page.tsx` | US stocks (IndMoney, Vested) |
| `/bank` | `src/app/bank/page.tsx` | Bank accounts |
| `/others` | `src/app/others/page.tsx` | Insurance / LIC |

---

## Shared Architecture

### Rendering model

All nine pages are `'use client'` components. They do not use `getServerSideProps`, RSC, or any server-only imports. Data fetching goes through the `useAsset` hook which calls browser `fetch()`.

### Files used by every asset page

| File | Role |
|------|------|
| `src/hooks/useAsset.ts` | Generic data hook — fetch, create, update, delete |
| `src/components/layout/AppShell.tsx` | Shell — Sidebar, Header, InactivityLock |
| `src/components/ui/DataTable.tsx` | Sortable, searchable table with edit/delete buttons |
| `src/components/ui/EditModal.tsx` | Slide-in form modal for add/edit |
| `src/components/ui/Card.tsx` | White/dark rounded card wrapper |
| `src/components/ui/Badge.tsx` | Coloured chip for P&L, status, NCLT flags |
| `src/context/CurrencyContext.tsx` | `useCurrency()` → `format()` for all monetary values |
| `src/lib/utils.ts` | `pnlClass()`, `formatDate()`, `daysRemaining()`, `formatChangeRatio()` |
| `src/lib/types.ts` | Per-asset TypeScript interface |

### API route files used by every asset page

Each asset type has two API route files:

| File | Handles |
|------|---------|
| `src/app/api/<asset>/route.ts` | GET (list all) + POST (create) |
| `src/app/api/<asset>/[id]/route.ts` | PUT (update by id) + DELETE (delete by id) |

---

## Shared Component Hierarchy

```
AppShell (title, subtitle)
└── <main>
    ├── Summary cards strip   (grid-cols-3 or grid-cols-1)
    │   └── N× <Card>   (Invested / Current Value / P&L or bank-specific)
    ├── <Card>
    │   └── DataTable<T>
    │       ├── Search input
    │       ├── "Add" button → setIsAdding(true)
    │       └── Rows with Edit / Delete per row
    └── EditModal (isOpen = !!editRow || isAdding)
        └── FieldGrid
            └── N× Field (label, name, type, value/defaultValue, readOnly?)
```

---

## `useAsset<T>` Hook — How It Works

```typescript
// src/hooks/useAsset.ts
export function useAsset<T extends { id: number }>(path: string) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    const res = await fetch(path)
    const json = await res.json()
    setData(json.data ?? [])
  }, [path])

  useEffect(() => { fetchAll() }, [fetchAll])   // load on mount

  const create = useCallback(async (item) => {
    await fetch(path, { method: 'POST', body: JSON.stringify(item) })
    await fetchAll()   // re-sync after write
  }, [path, fetchAll])

  const update = useCallback(async (id, item) => {
    await fetch(`${path}/${id}`, { method: 'PUT', body: JSON.stringify(item) })
    await fetchAll()
  }, [path, fetchAll])

  const remove = useCallback(async (id) => {
    await fetch(`${path}/${id}`, { method: 'DELETE' })
    await fetchAll()
  }, [path, fetchAll])

  return { data, loading, error, create, update, remove, refresh: fetchAll }
}
```

Every mutation (create / update / remove) re-fetches the full list from the server. The server always returns decrypted, typed data — the hook only needs to store what it receives.

---

## Shared State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `editRow` | `T \| null` | Row being edited; `null` when adding |
| `isAdding` | `boolean` | Whether the "Add" modal is open |
| `saving` | `boolean` | While the form is submitting |

Pages with computed fields (holdings, crypto, mutual-funds, nps, foreign) also track:

| Variable | Purpose |
|----------|---------|
| `qty` | Controlled quantity input |
| `avgCost` / `avgCostUsd` | Controlled avg cost input |
| `currentPrice` / `currentPriceUsd` | Controlled current price input |

These three drive computed read-only fields: `purchaseAmount = qty × avgCost`, `currentAmount = qty × currentPrice`, `pnl = currentAmount - purchaseAmount`.

---

## Shared handleSubmit Pattern

```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setSaving(true)
  const form = e.target as HTMLFormElement
  const fd = new FormData(form)
  const fields = {
    // build from fd.get() + controlled state
  }
  if (editRow) {
    await update(editRow.id, fields)   // PUT /api/<asset>/:id
  } else {
    await create(fields)               // POST /api/<asset>
  }
  setSaving(false)
  closeModal()
}
```

Form data comes from two sources:
1. `FormData` — text fields (`fd.get('name')`)
2. Controlled state — numeric fields that have live computed dependencies (`qty`, `avgCost`, etc.)

---

## Server-Side: API Route Pattern

Every `route.ts` follows this exact pattern:

```typescript
// GET + POST
const service = new AssetService<MyType>(
  new AssetRepository(prisma.myTable),
  new EncryptionService()
)

export async function GET() {
  const session = await sessionService.requireVault()
  const data = await service.getAll(session.userId!, session.encryptionKey!)
  return NextResponse.json({ data, total: data.length })
}

export async function POST(req: Request) {
  const session = await sessionService.requireVault()
  const body = await req.json()
  const item = await service.create(session.userId!, session.encryptionKey!, body)
  return NextResponse.json({ data: item }, { status: 201 })
}
```

The `[id]/route.ts` pattern:

```typescript
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await sessionService.requireVault()
  const body = await req.json()
  const item = await service.update(session.userId!, session.encryptionKey!, Number(params.id), body)
  return NextResponse.json({ data: item })
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await sessionService.requireVault()
  await service.delete(session.userId!, session.encryptionKey!, Number(params.id))
  return NextResponse.json({ success: true })
}
```

`service.delete()` throws `NotFoundError` if the record doesn't exist — the route catches it and returns 404.

---

## Per-Page Reference

### Holdings (`/holdings`, type: `EquityHolding`)

**API route:** `/api/holdings`

**Summary cards:** Invested · Current Value · P&L

**Unique fields:** `nclt` (NCLT status badge — amber if 'Yes', neutral otherwise), `platform`

**Computed fields:** `purchaseAmount`, `currentAmount`, `pnl`, `netChange` (all derived from qty/avgCost/currentPrice)

**Form fields:** Symbol, Platform, Quantity, Avg Cost, [Purchase Amount — readOnly], Current Price, [Current Amount — readOnly], NCLT

**Column highlights:**
- `instrument` — bold, dark text
- `netChange` — Badge (gain/loss)
- `nclt` — Badge (amber = Yes, neutral = No)

**TypeScript type:**
```typescript
interface EquityHolding {
  id, instrument, quantity, avgCost, purchaseAmount,
  currentPrice, currentAmount, pnl, netChange,
  nclt: string | null, platform, createdAt, updatedAt
}
```

---

### Crypto (`/crypto`, type: `CryptoHolding`)

**API route:** `/api/crypto`

**Summary cards:** Invested · Current Value · P&L

**Unique fields:** `name` (full coin name, e.g. "Bitcoin"), `instrument` (ticker, e.g. "BTC"), `platform`

**Computed fields:** `purchaseAmount`, `currentAmount`, `pnl`, `netChange`

**Form fields:** Symbol, Name, Platform, Quantity (step=0.00000001), Avg Cost, [Invested — readOnly], Current Price, [Current Amount — readOnly]

**Column highlights:**
- `instrument` — bold monospace
- `netChange` — Badge (gain/loss)

**TypeScript type:**
```typescript
interface CryptoHolding {
  id, instrument, name, quantity, avgCost, purchaseAmount,
  currentPrice, currentAmount, pnl, netChange, platform, createdAt, updatedAt
}
```

---

### Mutual Funds (`/mutual-funds`, type: `MutualFund`)

**API route:** `/api/mutual-funds`

**Summary cards:** Invested · Current Value · P&L

**Unique fields:** `folioNumber` (fund account identifier)

**Computed fields:** `purchaseAmount`, `currentAmount`, `pnl`, `netChange`

**Form fields:** Symbol/Fund Name, Folio Number, Platform, Quantity (NAV units), Avg Cost, [Purchase Amount — readOnly], Current Price (NAV), [Current Amount — readOnly]

**TypeScript type:**
```typescript
interface MutualFund {
  id, folioNumber, instrument, quantity, avgCost, purchaseAmount,
  currentPrice, currentAmount, pnl, netChange, platform, createdAt, updatedAt
}
```

---

### NPS (`/nps`, type: `NpsHolding`)

**API route:** `/api/nps`

**Summary cards:** Invested · Current Value · P&L

**Unique fields:** `folioNumber`, `purchasedUnits` (units at time of purchase), `currentUnits` (units today — may differ due to tier changes)

**Computed fields:** `purchaseAmount = purchasedUnits × avgCost`, `currentAmount = currentUnits × currentPrice`, `pnl`, `netChange`

**Form fields:** Fund Name, Folio Number, Platform, Purchased Units, Avg Cost, [Purchase Amount — readOnly], Current Units, Current Price, [Current Amount — readOnly]

**TypeScript type:**
```typescript
interface NpsHolding {
  id, folioNumber, instrument, purchasedUnits, avgCost, purchaseAmount,
  currentUnits, currentPrice, currentAmount, pnl, netChange, platform, createdAt, updatedAt
}
```

---

### FD/RD/PPF (`/fd-rd-ppf`, type: `FixedDeposit`)

**API route:** `/api/fd-rd-ppf`

**Summary cards:** Invested · Current Value · Expected Gain

**No computed qty/price fields.** User enters amounts directly.

**Unique fields:** `investmentAmount` (original principal), `currentAmount` (maturity/current), `tenure`, `startDate`, `endDate`, `platform`, `notes`, `daysLeft` badge

**Days Left badge:** `daysRemaining(endDate)` — indigo if > 0, amber if matured

**Form fields:** Instrument (FD/RD/PPF), Account #, Bank/Provider, Invested Amount, Current Amount, Tenure, Start Date, End Date, Notes

**TypeScript type:**
```typescript
interface FixedDeposit {
  id, instrument, accountNumber, purchaseAmount, investmentAmount,
  currentAmount, tenure, startDate, endDate, platform, notes: string | null,
  createdAt, updatedAt
}
```

---

### Post Office (`/post-office`, type: `PostOfficeScheme`)

**API route:** `/api/post-office`

**Summary cards:** Invested · Maturity Value · Expected Gain

**No qty/price computed fields.** P&L = `maturityAmount - purchaseAmount` (computed in column render, not stored).

**Unique fields:** `purchaseAmount`, `maturityAmount` (fixed at purchase), `daysLeft` badge, `platform`

**Days Left badge:** `daysRemaining(endDate)` — indigo if > 0, amber if matured

**Form fields:** Scheme (KVP/NSC), Account #, Invested, Maturity Amount, Tenure, Platform, Start Date, End Date

**TypeScript type:**
```typescript
interface PostOfficeScheme {
  id, instrument, accountNumber, purchaseAmount, maturityAmount,
  tenure, startDate, endDate, platform, createdAt, updatedAt
}
```

---

### Foreign Holdings (`/foreign`, type: `ForeignHolding`)

**API route:** `/api/foreign`

**Summary cards:** Invested · Current Value · P&L (all in selected currency, via USD conversion)

**Key difference:** All values stored in **USD**, displayed by multiplying by `usdRate`:

```typescript
const usdRate = currencies.find((c) => c.currencyCode === 'USD')?.rate ?? 90
const fmtUsd = (usdAmount: number) => format(usdAmount * usdRate)
```

`currencies` comes from `useCurrency()` which loads `/api/currencies`. This means foreign holdings display in the user's selected currency, same as all other pages, but the intermediate conversion goes through USD first.

**Computed fields:** `purchaseAmountUsd = qty × avgCostUsd`, `currentAmountUsd = qty × currentPriceUsd`, `pnlUsd`, `netChange`

**Form fields:** Stock Name, Platform, Quantity (step=0.0001), Avg Cost ($), [Purchase Amount ($) — readOnly], Current Price ($), [Current Amount ($) — readOnly], [P&L ($) — readOnly]

**TypeScript type:**
```typescript
interface ForeignHolding {
  id, instrument, quantity, avgCostUsd, purchaseAmountUsd,
  currentPriceUsd, currentAmountUsd, pnlUsd, netChange, platform, createdAt, updatedAt
}
```

---

### Bank Accounts (`/bank`, type: `BankAccount`)

**API route:** `/api/bank`

**Summary cards:** Total Balance only (single card, `max-w-xs`)

**Simplest page** — no P&L, no computed fields, no dates.

**Form fields:** Bank Name, IFSC Code, Account Number, Balance

**Column highlights:**
- `balance` — bold emerald green

**TypeScript type:**
```typescript
interface BankAccount {
  id, bankName, ifscCode, accountNumber, balance, createdAt, updatedAt
}
```

---

### Others / Insurance (`/others`, type: `OtherInvestment`)

**API route:** `/api/others`

**Summary cards:** Invested · Current Value · P&L

**Unique fields:** `brokerName`, `accountNumber`, `annualPremium`, `sumAssured`, `tenure`, `notes`

**Days Left badge:** `daysRemaining(endDate)` — indigo if > 0, amber if matured

**Form fields:** Type (LIC/NPS), Broker/Policy Name, Account #, Annual Premium, Total Investment, Current Amount, Sum Assured, Tenure, Start Date, End Date, Notes

**TypeScript type:**
```typescript
interface OtherInvestment {
  id, instrument, brokerName, accountNumber, annualPremium,
  currentAmount, totalInvestment, sumAssured, tenure,
  startDate, endDate, notes: string | null, createdAt, updatedAt
}
```

---

## Summary: What's Unique Per Page

| Page | Computed Fields | Date/Days-Left | Currency Note | Unique Fields |
|------|----------------|----------------|---------------|---------------|
| Holdings | qty×price | — | INR | nclt badge |
| Crypto | qty×price | — | INR | name (full coin name) |
| Mutual Funds | qty×price (NAV) | — | INR | folioNumber |
| NPS | units×price | — | INR | folioNumber, purchasedUnits vs currentUnits |
| FD/RD/PPF | — | endDate badge | INR | investmentAmount, notes |
| Post Office | pnl inline | endDate badge | INR | maturityAmount |
| Foreign | qty×price (USD) | — | USD×rate | all values in USD |
| Bank | — | — | INR | ifscCode |
| Others | — | endDate badge | INR | annualPremium, sumAssured, brokerName |

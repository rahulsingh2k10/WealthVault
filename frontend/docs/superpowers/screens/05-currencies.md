# Screen: Currencies (`/currencies`)

> Read `00-global-architecture.md` first.

---

## Purpose

The currencies page lets the user manage exchange rates stored in the `CurrencyRate` database table. These rates are the source of truth for all monetary conversions in the app — every call to `useCurrency().format()` on any other page uses rates loaded from this table.

It is also the only page with a **bulk-populate action**: "Load All World Currencies" hits a server-side endpoint that seeds the table with ~170 currency records.

---

## File Map

| File | Role |
|------|------|
| `src/app/currencies/page.tsx` | The page — client component, all state, all flows |
| `src/app/api/currencies/route.ts` | GET (list all) + POST (create one) |
| `src/app/api/currencies/[id]/route.ts` | PUT (update by id) + DELETE (delete by id) |
| `src/app/api/currencies/populate/route.ts` | POST — seeds ~170 world currencies from a static list |
| `src/context/CurrencyContext.tsx` | Global context — this page calls `refetchCurrencies()` after any mutation |
| `src/components/layout/AppShell.tsx` | Shell — Sidebar, Header, InactivityLock |
| `src/components/ui/DataTable.tsx` | Sortable, searchable table |
| `src/components/ui/EditModal.tsx` | Add/edit modal |
| `src/components/ui/Card.tsx` | Card wrapper for the table |

**Note:** Unlike the 9 asset pages, the currencies page does **not** use `useAsset<T>()`. It manages its own local `useState<CurrencyRate[]>` and `load()` callback because currency records are not encrypted (no userId/encryptionKey involved) and the page needs direct control over `refetchCurrencies()` timing.

---

## Component Hierarchy

```
AppShell (title="Currencies")
└── <main>
    ├── Top bar
    │   ├── Amber info box (rate format explanation)
    │   └── "Load All World Currencies" button → handlePopulate()
    ├── <Card>
    │   └── DataTable<CurrencyRate>
    │       ├── Search input (searchKey="currencyCode")
    │       ├── "Add Currency" button → setIsAdding(true)
    │       └── Rows with Edit / Delete per row
    └── EditModal
        └── FieldGrid
            ├── Field: Currency Code
            ├── Field: Currency Name
            └── Field: Rate (INR per 1 unit) — full width
```

---

## `CurrencyRate` Type

```typescript
// Defined in src/context/CurrencyContext.tsx
export interface CurrencyRate {
  id:           number
  currencyCode: string   // "USD", "EUR", etc.
  currencyName: string   // "US Dollar", etc.
  rate:         number   // INR value of 1 unit — e.g. 90 for USD
}
```

**Rate convention:** Rate = INR per 1 unit of the foreign currency. If 1 USD = ₹90, rate = 90. If 1 INR = ₹1, rate = 1.

---

## State

| Variable | Type | Purpose |
|----------|------|---------|
| `data` | `CurrencyRate[]` | List of all currencies from `/api/currencies` |
| `loading` | `boolean` | True while fetching |
| `editRow` | `CurrencyRate \| null` | Row being edited |
| `isAdding` | `boolean` | True when Add modal is open |
| `saving` | `boolean` | True while modal is submitting |
| `populating` | `boolean` | True while `/api/currencies/populate` is running |

---

## Data Flow

### Load

```
mount
  │
  ▼
load()   → GET /api/currencies
           → setData(json.data)
```

`load` is a `useCallback` memoised on `[]` — it does not depend on any state, so it's stable across renders. `useEffect(() => { load() }, [load])` runs it on mount.

### Add / Edit

```
User fills EditModal form → handleSubmit()
  │
  ├── editRow? → PUT /api/currencies/:id
  └── !editRow → POST /api/currencies
  │
  ▼
load()             ← re-fetch local state
refetchCurrencies() ← re-fetch CurrencyContext global state
```

### Delete

```
User clicks delete in DataTable row → handleDelete(id)
  │
  ▼
DELETE /api/currencies/:id
  │
  ▼
load()
refetchCurrencies()
```

### Populate

```
User clicks "Load All World Currencies" → handlePopulate()
  │
  ▼
POST /api/currencies/populate
  └── Server seeds ~170 currencies (upsert by currencyCode)
      Returns { success: true }
  │
  ▼
load()
refetchCurrencies()
```

The populate endpoint uses `upsert` — existing rates are not overwritten if the user has customised them (the server checks by `currencyCode`).

---

## `CurrencyContext` Integration

This page imports `refetchCurrencies` from `useCurrency()`:

```typescript
const { refetchCurrencies } = useCurrency()
```

Every mutation (add, edit, delete, populate) calls `refetchCurrencies()` after `load()`. This ensures the global context state is synchronised — any open page that formats values using `format()` will pick up the new rates immediately without a full page reload.

`load()` updates the local `data` state (drives this page's table).
`refetchCurrencies()` updates `CurrencyContext.currencies` (drives `format()` everywhere else).

---

## Table Columns

| Key | Label | Render |
|-----|-------|--------|
| `currencyCode` | Code | Indigo monospace bold |
| `currencyName` | Currency Name | Plain text |
| `rate` | Rate (INR per 1 unit) | `₹` prefix + `toLocaleString` (2–4 decimal places) |

Search is by `currencyCode` (case-sensitive substring).

---

## EditModal Fields

| Field | Name | Type | Notes |
|-------|------|------|-------|
| Currency Code | `currencyCode` | text | Uppercased before POST/PUT |
| Currency Name | `currencyName` | text | |
| Rate | `rate` | number (step=0.0001) | Full-width; placeholder "90.0" |

Code is forced to uppercase in `handleSubmit`:
```typescript
currencyCode: (fd.get('currencyCode') as string).toUpperCase()
```

---

## Why No `useAsset` Hook

`useAsset<T>()` is designed for **encrypted asset types** that pass `userId` and `encryptionKey` through the API routes. Currency rates:
- Are **not** per-user (shared DB table, no `userId` column)
- Are **not** encrypted
- Need `refetchCurrencies()` called in the same handler as `load()`, which would require a ref or callback prop if done through a generic hook

The direct `fetch()` + `useCallback(load)` pattern is simpler and more explicit for this case.

---

## API Routes

### `GET /api/currencies`
Returns all `CurrencyRate` rows: `{ data: CurrencyRate[], total: number }`

### `POST /api/currencies`
Body: `{ currencyCode, currencyName, rate }`
Creates one row. Returns `{ data: CurrencyRate }` with status 201.

### `PUT /api/currencies/:id`
Body: `{ currencyCode?, currencyName?, rate? }`
Updates the row. Returns `{ data: CurrencyRate }`.

### `DELETE /api/currencies/:id`
Deletes the row. Returns `{ success: true }`.

### `POST /api/currencies/populate`
No body. Seeds ~170 world currencies via upsert on `currencyCode`. Returns `{ success: true, count: number }`.

**None of these routes require authentication** — currency rates are not sensitive data. They have no `sessionService.requireVault()` call.

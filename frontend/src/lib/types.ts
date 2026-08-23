// ── Portfolio Summary ─────────────────────────────────────────────────────

export interface CategorySummary {
  name: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
}

export interface PortfolioSummary {
  totalInvested: number;
  currentValue: number;
  totalPnL: number;
  overallReturn: number;
  bankBalance: number;
  totalAssets: number;
  categories: CategorySummary[];
  usdRate: number;
}

// ── Equity ────────────────────────────────────────────────────────────────

export interface EquityHolding {
  id: number;
  instrument: string;
  quantity: number;
  avgCost: number;
  purchaseAmount: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  nclt: string | null;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Mutual Funds ──────────────────────────────────────────────────────────

export interface MutualFund {
  id: number;
  folioNumber: string;
  instrument: string;
  quantity: number;
  avgCost: number;
  purchaseAmount: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── NPS ───────────────────────────────────────────────────────────────────

export interface NpsHolding {
  id: number;
  folioNumber: string;
  instrument: string;
  purchasedUnits: number;
  avgCost: number;
  purchaseAmount: number;
  currentUnits: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Crypto ────────────────────────────────────────────────────────────────

export interface CryptoHolding {
  id: number;
  instrument: string;
  name: string;
  quantity: number;
  avgCost: number;
  purchaseAmount: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Post Office ───────────────────────────────────────────────────────────

export interface PostOfficeScheme {
  id: number;
  instrument: string;
  accountNumber: string;
  purchaseAmount: number;
  maturityAmount: number;
  tenure: string;
  startDate: string;
  endDate: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Fixed Deposits ────────────────────────────────────────────────────────

export interface FixedDeposit {
  id: number;
  instrument: string;
  accountNumber: string;
  purchaseAmount: number;
  investmentAmount: number;
  currentAmount: number;
  tenure: string;
  startDate: string;
  endDate: string;
  platform: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Foreign Holdings ──────────────────────────────────────────────────────

export interface ForeignHolding {
  id: number;
  instrument: string;
  quantity: number;
  avgCostUsd: number;
  purchaseAmountUsd: number;
  currentPriceUsd: number;
  currentAmountUsd: number;
  pnlUsd: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Other Investments ─────────────────────────────────────────────────────

export interface OtherInvestment {
  id: number;
  instrument: string;
  brokerName: string;
  accountNumber: string;
  annualPremium: number;
  currentAmount: number;
  totalInvestment: number;
  sumAssured: number;
  tenure: string;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Bank Accounts ─────────────────────────────────────────────────────────

export interface BankAccount {
  id: number;
  bankName: string;
  ifscCode: string;
  accountNumber: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

// ── Stocks ────────────────────────────────────────────────────────────────

export interface StockHolding {
  id: number;
  name: string;
  instrument: string;
  quantity: number;
  avgCost: number;
  purchaseAmount: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Gold & Commodities ────────────────────────────────────────────────────

export interface GoldHolding {
  id: number;
  instrument: string;
  type: string;
  quantity: number;
  unit: string;
  avgCost: number;
  purchaseAmount: number;
  currentPrice: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Real Estate ───────────────────────────────────────────────────────────

export interface RealEstateHolding {
  id: number;
  instrument: string;
  type: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Insurance ─────────────────────────────────────────────────────────────

export interface InsurancePolicy {
  id: number;
  instrument: string;
  policyNumber: string;
  type: string;
  annualPremium: number;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Cash & Banking ────────────────────────────────────────────────────────

export interface CashAccount {
  id: number;
  instrument: string;
  accountNumber: string;
  type: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Liabilities ───────────────────────────────────────────────────────────

export interface Liability {
  id: number;
  instrument: string;
  type: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Fixed Income (new) ────────────────────────────────────────────────────

export interface FixedIncomeHolding {
  id: number;
  instrument: string;
  accountNumber: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  tenure: string;
  startDate: string;
  endDate: string;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── Government Schemes ────────────────────────────────────────────────────

export interface GovernmentScheme {
  id: number;
  instrument: string;
  accountNumber: string;
  purchaseAmount: number;
  currentAmount: number;
  pnl: number;
  netChange: number;
  platform: string;
  createdAt: string;
  updatedAt: string;
}

// ── API Response ──────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  error?: string;
}

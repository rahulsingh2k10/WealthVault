/**
 * categoryInfo.ts
 *
 * Static config driving the ℹ info popover on each sidebar nav item.
 * Structure: category slug → country code → list of instrument examples.
 *
 * Country codes in use: IN, US, SG, JP, GB
 * Each country list includes universal instruments merged in (no ALL key).
 *
 * To add a new country: add its code block to every category below.
 * To add a new category: add a top-level key matching the NavConfig href slug.
 */

export interface CategoryCountryInfo {
  /** One-line description shown above the instrument list. */
  description: string
  /** Specific instrument names, schemes, or account types for this country. */
  instruments: string[]
}

export type CategoryInfo = Partial<Record<string, CategoryCountryInfo>>

export const CATEGORY_INFO: Record<string, CategoryInfo> = {
  // ── Stocks ──────────────────────────────────────────────────────────────────
  stocks: {
    IN: {
      description: 'Primarily for Indian Market holdings, with support for international stocks.',
      instruments: ['NSE', 'BSE', 'SME', 'Equity ETFs', 'REITs', 'InvITs', 'Listed Companies', 'ADRs / GDRs', 'Preferred Shares'],
    },
    US: {
      description: 'Primarily for U.S. Market holdings, with support for global stocks.',
      instruments: ['NYSE', 'NASDAQ', 'AMEX', 'OTC', 'ETFs', 'ADRs', 'REITs', 'Listed Companies', 'Preferred Shares'],
    },
    SG: {
      description: 'Primarily for Singapore Market holdings, with support for international stocks.',
      instruments: ['SGX Mainboard', 'SGX Catalist', 'Listed REITs', 'Business Trusts', 'ETFs', 'Listed Companies', 'ADRs / GDRs', 'Preferred Shares'],
    },
    JP: {
      description: 'Primarily for Japanese Market holdings, with support for overseas stocks.',
      instruments: ['TSE Prime', 'TSE Standard', 'TSE Growth', 'ETFs', 'J-REITs', 'Foreign Stocks', 'Listed Companies', 'ADRs / GDRs', 'Preferred Shares'],
    },
    GB: {
      description: 'Primarily for UK Market holdings, with support for international stocks.',
      instruments: ['LSE Main Market', 'AIM', 'ETFs', 'Investment Trusts', 'REITs', 'International Shares', 'Listed Companies', 'ADRs / GDRs', 'Preferred Shares'],
    },
  },

  // ── Mutual Funds ─────────────────────────────────────────────────────────────
  'mutual-funds': {
    IN: {
      description: 'Primarily for Indian mutual fund investments, with support for global fund holdings.',
      instruments: ['Equity Funds', 'Debt Funds', 'Hybrid Funds', 'ELSS', 'Liquid Funds', 'Index Funds', 'ETFs', 'Actively Managed Funds'],
    },
    US: {
      description: 'Primarily for U.S. fund investments, including taxable and retirement account holdings.',
      instruments: ['Index Funds', 'Active Mutual Funds', '401(k) Funds', 'IRA Funds', 'Roth IRA Funds', 'Target Date Funds', 'ETFs', 'Balanced / Hybrid Funds'],
    },
    SG: {
      description: 'Primarily for Singapore fund investments through banks, CPF schemes, or robo-advisors.',
      instruments: ['Unit Trusts', 'CPFIS Funds', 'SRS Funds', 'Robo Portfolios', 'Index Funds', 'Actively Managed Funds', 'ETFs', 'Balanced / Hybrid Funds'],
    },
    JP: {
      description: 'Primarily for Japanese fund investments through securities firms and tax-advantaged accounts.',
      instruments: ['Domestic Investment Trusts', 'Foreign Investment Trusts', 'iDeCo Funds', 'NISA Funds', 'Balanced Funds', 'Index Funds', 'Actively Managed Funds', 'ETFs'],
    },
    GB: {
      description: 'Primarily for UK fund investments held in brokerage, ISA, pension, or general investment accounts.',
      instruments: ['OEICs', 'Unit Trusts', 'Investment Trusts', 'ISA Funds', 'SIPP Funds', 'Pension Funds', 'Index Funds', 'Actively Managed Funds', 'ETFs', 'Balanced / Hybrid Funds'],
    },
  },

  // ── Gold & Commodities ───────────────────────────────────────────────────────
  'gold-commodities': {
    IN: {
      description: 'Gold and commodity investments available through exchanges, AMCs, and RBI-backed schemes.',
      instruments: ['Sovereign Gold Bonds (SGBs)', 'Gold ETFs (Nippon / HDFC / SBI)', 'Digital Gold (PhonePe / Paytm / Google Pay)', 'Physical gold / jewellery', 'MCX-traded gold, silver, copper, crude oil', 'Physical gold / silver', 'Silver ETFs', 'Commodity futures', 'Precious metal certificates'],
    },
    US: {
      description: 'Gold and commodity investments through ETFs, futures markets, and physical bullion.',
      instruments: ['Gold ETFs (GLD, IAU)', 'Silver ETFs (SLV)', 'Commodity mutual funds', 'Physical gold (APMEX, JM Bullion)', 'Futures contracts via CME / NYMEX', 'Commodity futures', 'Precious metal certificates'],
    },
    SG: {
      description: 'Gold savings plans and bullion investments offered through local banks and vault providers.',
      instruments: ['Gold savings accounts (DBS / OCBC / UOB)', 'Physical gold bars (UOB, BullionStar)', 'Silver bullion', 'Gold ETFs on SGX', 'Silver / platinum via vaults', 'Silver ETFs', 'Commodity futures', 'Precious metal certificates'],
    },
    JP: {
      description: 'Gold and commodity investments through TOCOM, domestic dealers, and accumulation plans.',
      instruments: ['TOCOM-traded gold / silver / platinum', 'Tanaka Kikinzoku gold bars', 'Gold investment accounts (純金積立)', 'Gold ETFs (国内 ETF)', 'Commodity funds', 'Physical gold / silver', 'Silver ETFs', 'Commodity futures', 'Precious metal certificates'],
    },
    GB: {
      description: 'Gold and commodity investments through LSE-listed ETPs, dealers, and pension wrappers.',
      instruments: ['Royal Mint gold coins / bars', 'Physical silver', 'Gold ETPs on LSE (PHAU, SGLN)', 'Commodity ETFs', 'Precious metal SIPPs', 'Physical gold / silver', 'Gold ETFs', 'Silver ETFs', 'Commodity futures', 'Precious metal certificates'],
    },
  },

  // ── Real Estate ──────────────────────────────────────────────────────────────
  'real-estate': {
    IN: {
      description: 'Physical property investments across residential, commercial, and land assets in India.',
      instruments: ['Residential property', 'Commercial property', 'Land / plots', 'Agricultural land', 'Fractional ownership platforms (hBits, Strata, PropertyShare)'],
    },
    US: {
      description: 'Physical real estate ownership across residential, commercial, and rental property assets.',
      instruments: ['Residential property', 'Commercial / industrial property', 'Land / lots', 'Vacation / short-term rentals', '1031 exchange properties', 'Agricultural land', 'Fractional ownership'],
    },
    SG: {
      description: 'Physical property ownership across public and private housing segments in Singapore.',
      instruments: ['HDB flat', 'Private condominium', 'Landed property', 'Commercial property', 'Industrial property', 'Residential property', 'Land / plots', 'Agricultural land', 'Fractional ownership'],
    },
    JP: {
      description: 'Physical property investments across Japanese residential, commercial, and land assets.',
      instruments: ['Residential マンション (apartment)', 'Residential 一戸建て (detached house)', 'Commercial property', 'Land (土地)', 'Rental property', 'Agricultural land', 'Fractional ownership'],
    },
    GB: {
      description: 'Physical property ownership across UK residential, commercial, and holiday rental assets.',
      instruments: ['Buy-to-let residential property', 'Commercial property', 'Land / plots', 'Holiday lets', 'Agricultural land', 'Fractional ownership'],
    },
  },

  // ── Cryptocurrency ───────────────────────────────────────────────────────────
  crypto: {
    IN: {
      description: 'Crypto asset investments in major cryptocurrencies and related digital holdings.',
      instruments: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'Major altcoins', 'Stablecoins (USDT, USDC)', 'DeFi tokens', 'NFTs'],
    },
    US: {
      description: 'Crypto asset investments across cryptocurrencies, ETFs, and blockchain-based holdings.',
      instruments: ['Bitcoin (BTC)', 'Spot Bitcoin ETFs', 'Ethereum (ETH)', 'Altcoins', 'Stablecoins', 'DeFi positions', 'NFTs'],
    },
    SG: {
      description: 'Crypto asset investments in major cryptocurrencies and digital token holdings.',
      instruments: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'Major altcoins', 'Stablecoins', 'Token holdings', 'DeFi tokens', 'NFTs'],
    },
    JP: {
      description: 'Crypto asset investments in major cryptocurrencies and digital token holdings.',
      instruments: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'XRP (widely held in Japan)', 'Major altcoins', 'Token holdings', 'Stablecoins', 'DeFi tokens', 'NFTs'],
    },
    GB: {
      description: 'Crypto asset investments across cryptocurrencies and exchange-traded crypto products.',
      instruments: ['Bitcoin (BTC)', 'Ethereum (ETH)', 'Altcoins', 'Crypto ETPs', 'Stablecoins', 'DeFi tokens', 'NFTs'],
    },
  },

  // ── Insurance ────────────────────────────────────────────────────────────────
  insurance: {
    IN: {
      description: 'Life, Health, and Investment-linked insurance products in India.',
      instruments: ['LIC policies (term, endowment, money-back)', 'Term insurance', 'ULIPs (Unit Linked Insurance Plans)', 'Endowment / money-back plans', 'Health insurance', 'Whole life insurance', 'Annuities'],
    },
    US: {
      description: 'Life Insurance, Protection, and Annuity Products in the United States.',
      instruments: ['Term life insurance', 'Whole life insurance', 'Universal life insurance', 'Variable annuities', 'Fixed indexed annuities', 'Employer group life insurance', 'Endowment plans', 'Unit-linked plans'],
    },
    SG: {
      description: 'Life, Protection, and Savings-oriented Insurance products in Singapore.',
      instruments: ['Whole life', 'Term insurance', 'Endowment plans', 'Investment-linked policies (ILPs)', 'Shield plans', 'Annuities', 'Unit-linked plans'],
    },
    JP: {
      description: 'Life, Medical, and Protection-Oriented Insurance products in Japan.',
      instruments: ['Term insurance (定期保険)', 'Whole life (終身保険)', 'Endowment (養老保険)', 'Medical insurance (医療保険)', 'Cancer insurance (がん保険)', 'Child insurance (学資保険)', 'Annuities', 'Unit-linked plans'],
    },
    GB: {
      description: 'Life Assurance, Protection, and Retirement-linked insurance products in the United Kingdom.',
      instruments: ['Term assurance', 'Whole of life', 'Endowment policies', 'Income protection', 'Critical illness cover', 'Pension annuities', 'Unit-linked plans'],
    },
  },

  // ── Cash & Banking ───────────────────────────────────────────────────────────
  'cash-banking': {
    IN: {
      description: 'Cash Holdings, Bank Accounts, and wallet balances in India.',
      instruments: ['Savings accounts', 'Jan Dhan accounts', 'Recurring deposit-linked savings', 'Sweep accounts', 'Digital wallet balances', 'Current / checking accounts', 'Emergency fund', 'Money market accounts'],
    },
    US: {
      description: 'Cash Holdings, Savings Accounts, and Banking balances in the United States.',
      instruments: ['Savings accounts', 'High-Yield Savings Accounts (HYSA)', 'Money market accounts', 'Checking accounts', 'Brokerage cash / sweep accounts', 'Emergency fund'],
    },
    SG: {
      description: 'Cash Holdings, Bank Accounts, and CPF cash balances in Singapore.',
      instruments: ['DBS Multiplier account', 'OCBC 360 account', 'UOB One account', 'Bonus Saver accounts', 'CPF Ordinary Account (OA) cash balance', 'Savings accounts', 'Current / checking accounts', 'Emergency fund', 'Money market accounts'],
    },
    JP: {
      description: 'Cash Holdings, Bank Savings, and Postal savings balances in Japan.',
      instruments: ['Bank savings 普通預金 (ordinary deposit)', 'Japan Post savings ゆうちょ銀行', 'Foreign currency deposits', 'Liquid money market funds (MRF)', 'Savings accounts', 'Current / checking accounts', 'Emergency fund'],
    },
    GB: {
      description: 'Cash Holdings, Savings Accounts, and Protected cash balances in the United Kingdom.',
      instruments: ['Easy-access savings', 'Cash ISA', 'NS&I savings accounts', 'Current account surplus', 'Premium Bonds (cash component)', 'Emergency fund', 'Money market accounts'],
    },
  },

  // ── Liabilities ──────────────────────────────────────────────────────────────
  liabilities: {
    IN: {
      description: 'Outstanding loans and credit obligations in India.',
      instruments: ['Home loan', 'Car / two-wheeler loan', 'Personal loan', 'Education loan', 'Gold loan', 'Credit card outstanding', 'Overdraft'],
    },
    US: {
      description: 'Outstanding loans and debt obligations in the United States.',
      instruments: ['30-year fixed mortgage', 'Adjustable-rate mortgage (ARM)', 'Federal student loans', 'Private student loans', 'Auto loan', 'Credit card debt', 'HELOC (Home Equity Line of Credit)', 'Personal loan', 'Overdraft'],
    },
    SG: {
      description: 'Outstanding loans and credit obligations in Singapore.',
      instruments: ['HDB concessionary loan', 'Bank housing loan', 'Car loan (with COE financing)', 'Personal loan', 'Renovation loan', 'Credit card balance', 'Education loan', 'Overdraft'],
    },
    JP: {
      description: 'Outstanding loans and debt obligations in Japan.',
      instruments: ['Housing loan 住宅ローン', 'Car loan カーローン', 'Education loan 教育ローン', 'Card loan カードローン', 'Consumer credit 消費者ローン', 'Personal loan', 'Credit card debt', 'Overdraft'],
    },
    GB: {
      description: 'Outstanding loans and debt obligations in the United Kingdom.',
      instruments: ['Residential mortgage (fixed / tracker / SVR)', 'Student loan (Plan 1 / 2 / 5)', 'Personal loan', 'Credit card balance', 'Car finance (PCP / HP)', 'Overdraft'],
    },
  },

  // ── Fixed Income ─────────────────────────────────────────────────────────────
  'fixed-income': {
    IN: {
      description: 'Bank and post office deposit products with fixed or predictable returns in India.',
      instruments: ['Fixed Deposit (FD)', 'Recurring Deposit (RD)', 'Post Office Time Deposit', 'Tax Saver FD', 'Senior Citizen FD', 'Certificate of Deposit (CD)'],
    },
    US: {
      description: 'Deposit-based savings products with fixed or predictable returns in the United States.',
      instruments: ['Certificates of Deposit (CDs)', 'High-Yield CDs', 'Jumbo CDs', 'Time Deposits', 'Brokered CDs', 'Fixed Deposit (FD)', 'Recurring Deposit (RD)'],
    },
    SG: {
      description: 'Deposit-based savings products with fixed or predictable returns in Singapore.',
      instruments: ['Fixed Deposit', 'Time Deposit', 'Foreign Currency Deposit', 'Promotional Bank Deposits', 'Recurring Deposit (RD)', 'Certificate of Deposit (CD)'],
    },
    JP: {
      description: 'Deposit-based savings products with fixed or predictable returns in Japan.',
      instruments: ['Time Deposit 定期預金', 'Fixed Deposit', 'Foreign Currency Deposit', 'Postal Time Savings', 'Recurring Deposit (RD)', 'Certificate of Deposit (CD)'],
    },
    GB: {
      description: 'Deposit-based savings products with fixed or predictable returns in the United Kingdom.',
      instruments: ['Fixed Rate Bonds', 'Fixed Term Deposits', 'Cash Deposits', 'Notice Deposits', 'Savings Bonds', 'Fixed Deposit (FD)', 'Recurring Deposit (RD)', 'Time Deposit', 'Certificate of Deposit (CD)'],
    },
  },

  // ── Government Schemes ───────────────────────────────────────────────────────
  'government-schemes': {
    IN: {
      description: 'Government-backed savings, pension, and welfare schemes in India.',
      instruments: ['Public Provident Fund (PPF)', 'National Savings Certificate (NSC)', 'Kisan Vikas Patra (KVP)', 'Sukanya Samriddhi Yojana (SSY)', 'Senior Citizen Savings Scheme (SCSS)', 'Employees\' Provident Fund (EPF)', 'National Pension System (NPS)', 'Atal Pension Yojana (APY)', 'PM Jan Dhan Yojana (PMJDY)', 'PM Awas Yojana', 'Gratuity', 'Government savings plans', 'State pensions'],
    },
    US: {
      description: 'Government-backed retirement, savings, and welfare programmes in the United States.',
      instruments: ['Social Security', 'Medicare / Medicaid', '529 Education Savings Plans', 'ABLE Accounts', 'Thrift Savings Plan (TSP)', 'State Pension Benefits', 'Provident funds', 'National pension schemes'],
    },
    SG: {
      description: 'Government-backed retirement, healthcare, and savings programmes in Singapore.',
      instruments: ['CPF Ordinary Account (OA)', 'CPF Special Account (SA)', 'CPF MediSave Account (MA)', 'CPF Retirement Account (RA)', 'MediShield Life', 'Supplementary Retirement Scheme (SRS)', 'HDB Housing Grants', 'Baby Bonus / CDA', 'Edusave', 'National pension schemes', 'State pensions'],
    },
    JP: {
      description: 'Government-backed pension, savings, and welfare programmes in Japan.',
      instruments: ['National Pension 国民年金', 'Employees\' Pension 厚生年金', 'NISA (少額投資非課税制度)', 'Junior NISA', 'Child Allowance 児童手当', 'Employment Insurance 雇用保険', 'Provident funds'],
    },
    GB: {
      description: 'Government-backed pension, savings, and welfare programmes in the United Kingdom.',
      instruments: ['State Pension', 'Lifetime ISA (LISA)', 'Help to Buy ISA', 'NS&I Premium Bonds', 'Universal Credit', 'Child Benefit', 'Provident funds'],
    },
  },
}

/**
 * Returns instrument info for a given category and country.
 * Falls back to empty if the category or country is not found.
 */
export function getCategoryInfo(
  categorySlug: string,
  countryCode: string
): { description: string; instruments: string[] } | null {
  const info = CATEGORY_INFO[categorySlug]
  if (!info) return null

  return info[countryCode] ?? null
}

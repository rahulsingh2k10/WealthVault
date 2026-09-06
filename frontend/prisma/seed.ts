import { PrismaClient } from "@prisma/client";
import { deriveKey, encrypt } from "../src/lib/encryption";

const prisma = new PrismaClient();

async function main() {
  const passphrase = process.env.SEED_PASSPHRASE;
  if (!passphrase) throw new Error("SEED_PASSPHRASE is required in .env");
  const seedUserId = process.env.SEED_USER_ID ?? "seed-user";

  console.log("🔑 Deriving encryption key from SEED_PASSPHRASE...");
  const keyHex = deriveKey(passphrase);
  const enc = (fields: object) => encrypt(JSON.stringify(fields), keyHex);

  console.log("🌱 Seeding database with encrypted portfolio data...");

  // Clear all existing data
  await prisma.navConfig.deleteMany();
  await prisma.subscriptionPlan.deleteMany();
  await prisma.appConfig.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.otherInvestment.deleteMany();
  await prisma.foreignHolding.deleteMany();
  await prisma.fixedDeposit.deleteMany();
  await prisma.postOfficeScheme.deleteMany();
  await prisma.cryptoHolding.deleteMany();
  await prisma.npsHolding.deleteMany();
  await prisma.mutualFund.deleteMany();
  await prisma.equityHolding.deleteMany();

  // Seed nav config — 10 universal categories, country-independent
  // Instrument subcategories are handled in src/i18n/categoryInfo.ts (static config)
  await prisma.navConfig.createMany({
    data: [
      { country: 'ALL', href: '/dashboard',          labelKey: 'dashboard',         iconName: 'LayoutDashboard', sortOrder: 1  },
      { country: 'ALL', href: '/stocks',             labelKey: 'stocks',            iconName: 'TrendingUp',      sortOrder: 2  },
      { country: 'ALL', href: '/mutual-funds',       labelKey: 'mutualFunds',       iconName: 'BarChart3',       sortOrder: 3  },
      { country: 'ALL', href: '/gold-commodities',   labelKey: 'goldCommodities',   iconName: 'Gem',             sortOrder: 4  },
      { country: 'ALL', href: '/real-estate',        labelKey: 'realEstate',        iconName: 'Home',            sortOrder: 5  },
      { country: 'ALL', href: '/crypto',             labelKey: 'cryptocurrency',    iconName: 'Bitcoin',         sortOrder: 6  },
      { country: 'ALL', href: '/insurance',          labelKey: 'insurance',         iconName: 'Shield',          sortOrder: 7  },
      { country: 'ALL', href: '/cash-banking',       labelKey: 'cashBanking',       iconName: 'Building2',       sortOrder: 8  },
      { country: 'ALL', href: '/liabilities',        labelKey: 'liabilities',       iconName: 'CreditCard',      sortOrder: 9  },
      { country: 'ALL', href: '/fixed-income',       labelKey: 'fixedIncome',       iconName: 'PiggyBank',       sortOrder: 10 },
      { country: 'ALL', href: '/government-schemes', labelKey: 'governmentSchemes', iconName: 'Landmark',        sortOrder: 11 },
    ],
  });
  console.log("✅ Nav config seeded");

  // Subscription plans — per-cycle amounts in whole INR.
  //   price      = list amount charged per billing cycle
  //   offerPrice = current intro amount (60% off) charged per cycle — matches the live Razorpay Plans
  // razorpayPlanId comes from the RAZORPAY_PLAN_ID_* env (test values in frontend/.env).
  // intervalMonths/termMonths are day counts now — the 3 Razorpay plans bill
  // daily (interval 7/9/12), so termMonths (still 3-year term intent) is
  // expressed as 1095 days (365 * 3) instead of 36 months.
  const offerStart = new Date('2026-08-01T00:00:00Z');
  const offerEnd = new Date('2026-09-30T23:59:59Z');
  await prisma.subscriptionPlan.createMany({
    data: [
      { tier: 'FREE',      price: 0,     offerPrice: null,  currency: 'INR', isActive: true, intervalMonths: null, termMonths: null, razorpayPlanId: null },
      { tier: 'MONTHLY',   price: 9000,  offerPrice: 3600,  currency: 'INR', isActive: true, intervalMonths: 7,  termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_MONTHLY ?? null,   offerStartDate: offerStart, offerEndDate: offerEnd },
      { tier: 'QUARTERLY', price: 18000, offerPrice: 7200,  currency: 'INR', isActive: true, intervalMonths: 9,  termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_QUARTERLY ?? null, offerStartDate: offerStart, offerEndDate: offerEnd },
      { tier: 'ANNUAL',    price: 36000, offerPrice: 14400, currency: 'INR', isActive: true, intervalMonths: 12, termMonths: 1095, razorpayPlanId: process.env.RAZORPAY_PLAN_ID_ANNUAL ?? null,    offerStartDate: offerStart, offerEndDate: offerEnd },
    ],
  });
  console.log("✅ Subscription plans seeded (list + 60% intro, Razorpay plan ids)");

  // Store passphrase verifier
  await prisma.appConfig.create({
    data: { userId: seedUserId, key: "verifier", value: encrypt("PORTFOLIO_APP_V1", keyHex) },
  });

  // ── Equity Holdings ───────────────────────────────────────────────────────
  const equityData = [
    { instrument: "TMCV", quantity: 10, avgCost: 32.71, purchaseAmount: 327.1, currentPrice: 438.5, currentAmount: 4385.0, pnl: 4057.9, netChange: 12.4056863344543, nclt: "No", platform: "Zerodha" },
    { instrument: "ADANIPOWER", quantity: 10, avgCost: 18.0, purchaseAmount: 180.0, currentPrice: 142.63, currentAmount: 1426.3, pnl: 1246.3, netChange: 6.92388888888889, nclt: "No", platform: "Zerodha" },
    { instrument: "SALASAR", quantity: 10, avgCost: 1.08, purchaseAmount: 10.8, currentPrice: 8.47, currentAmount: 84.7, pnl: 73.9, netChange: 6.84259259259259, nclt: "No", platform: "Zerodha" },
    { instrument: "COCHINSHIP", quantity: 10, avgCost: 205.5, purchaseAmount: 2055.0, currentPrice: 1526.55, currentAmount: 15265.5, pnl: 13210.5, netChange: 6.42846715328467, nclt: "No", platform: "Zerodha" },
  ];
  await prisma.equityHolding.createMany({ data: equityData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Equity holdings seeded (encrypted)");

  // ── Mutual Funds ──────────────────────────────────────────────────────────
  const mutualFundData = [
    { folioNumber: "488253246456", instrument: "NIPPON INDIA NIFTY MIDCAP 150 INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "19362809/23", instrument: "ICICI PRUDENTIAL NASDAQ 100 INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "91029885491", instrument: "MOTILAL OSWAL NIFTY BANK INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "19362809/23", instrument: "ICICI PRUDENTIAL NIFTY IT INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "588341244331", instrument: "UTI NIFTY NEXT 50 INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "19362809/23", instrument: "ICICI PRUDENTIAL S&P BSE SENSEX INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
    { folioNumber: "19362809/23", instrument: "ICICI PRUDENTIAL NIFTY 50 INDEX FUND - DIRECT PLAN", quantity: 100, avgCost: 10.0, purchaseAmount: 1000.0, currentPrice: 11.0, currentAmount: 1100.0, pnl: 100.0, netChange: 0.1, platform: "Coin By Zerodha" },
  ];
  await prisma.mutualFund.createMany({ data: mutualFundData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Mutual funds seeded (encrypted)");

  // ── NPS Holdings ──────────────────────────────────────────────────────────
  const npsData = [
    { folioNumber: "110183936441", instrument: "SBI PENSION FUND SCHEME E - TIER 1", purchasedUnits: 5798.69253937699, avgCost: 40.3539243391478, purchaseAmount: 234000.0, currentUnits: 6079.201876186459, currentPrice: 52.5434, currentAmount: 319421.93586121604, pnl: 85421.935861216, netChange: 0.36505100795391504, platform: "NPS (CDSL)" },
    { folioNumber: "110183936441", instrument: "SBI PENSION FUND SCHEME C - TIER 1", purchasedUnits: 2422.1672509281198, avgCost: 34.6796861231664, purchaseAmount: 84000.0, currentUnits: 1574.5058582161998, currentPrice: 45.2303, currentAmount: 71215.37231887621, pnl: -12784.6276811238, netChange: -0.152197948584807, platform: "NPS (CDSL)" },
    { folioNumber: "110183936441", instrument: "SBI PENSION FUND SCHEME G - TIER 1", purchasedUnits: 2413.02871970315, avgCost: 33.98218982246, purchaseAmount: 82000.0, currentUnits: 3171.5798841501496, currentPrice: 40.1756, currentAmount: 127420.12479366301, pnl: 45420.124793663, netChange: 0.553903960898329, platform: "NPS (CDSL)" },
  ];
  await prisma.npsHolding.createMany({ data: npsData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ NPS holdings seeded (encrypted)");

  // ── Crypto Holdings ───────────────────────────────────────────────────────
  const cryptoData = [
    { instrument: "TRX", name: "Tron", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "BTC", name: "Bitcoin", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "BNB", name: "Binance Coin", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "XRP", name: "Ripple", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "DASH", name: "Dash", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "ETH", name: "Ethereum", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "FET", name: "Artificial Superintelligence Alliance", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "DOGE", name: "Dogecoin", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "ADA", name: "Cardano", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "SHIB", name: "Shiba Inu", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "DOT", name: "Polkadot", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "SAND", name: "The Sandbox", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "CoinSwitch" },
    { instrument: "BTC", name: "Bitcoin", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "WazirX" },
    { instrument: "DOGE", name: "Dogecoin", quantity: 10, avgCost: 10, purchaseAmount: 100, currentPrice: 13, currentAmount: 130, pnl: 30, netChange: 0.3, platform: "WazirX" },
  ];
  await prisma.cryptoHolding.createMany({ data: cryptoData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Crypto holdings seeded (encrypted)");

  // ── Post Office Schemes ───────────────────────────────────────────────────
  const postOfficeData = [
    { instrument: "KVP", accountNumber: "12345", purchaseAmount: 10.0, maturityAmount: 100.0, tenure: "One Time", startDate: "2021-09-13T00:00:00.000Z", endDate: "2032-01-13T00:00:00.000Z", platform: "Post Office (Sunil Patna)" },
    { instrument: "NSC", accountNumber: "12345", purchaseAmount: 10.0, maturityAmount: 1000.0, tenure: "One Time", startDate: "2024-06-04T00:00:00.000Z", endDate: "2034-01-04T00:00:00.000Z", platform: "Post Office (Sunil Patna)" },
  ];
  await prisma.postOfficeScheme.createMany({ data: postOfficeData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Post office schemes seeded (encrypted)");

  // ── Fixed Deposits / RD / PPF ─────────────────────────────────────────────
  const fdData = [
    { instrument: "RD", accountNumber: "123", purchaseAmount: 1000.0, investmentAmount: 12000.0, currentAmount: 6000.0, tenure: "Monthly", startDate: "2026-01-03T00:00:00.000Z", endDate: "2026-12-03T00:00:00.000Z", platform: "SBI", notes: null },
    { instrument: "PPF", accountNumber: "123", purchaseAmount: 100000.0, investmentAmount: 120000.0, currentAmount: 60000.0, tenure: "Yearly", startDate: "2013-03-31T00:00:00.000Z", endDate: "2029-03-31T00:00:00.000Z", platform: "SBI", notes: "Last Payment 01 Apr 2028" },
  ];
  await prisma.fixedDeposit.createMany({ data: fdData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ FD/RD/PPF seeded (encrypted)");

  // ── Foreign Holdings ──────────────────────────────────────────────────────
  const foreignData = [
    { instrument: "TEXAS INSTRUMENTS INC.", quantity: 0.1, avgCostUsd: 100.0, purchaseAmountUsd: 10.0, currentPriceUsd: 105.0, currentAmountUsd: 10.5, pnlUsd: 0.5, netChange: 0.05, platform: "IndMoney" },
    { instrument: "Coinbase", quantity: 1.0, avgCostUsd: 20.0, purchaseAmountUsd: 20.0, currentPriceUsd: 100.0, currentAmountUsd: 100.0, pnlUsd: 80.0, netChange: 4.0, platform: "Vested" },
    { instrument: "Intel", quantity: 1.5, avgCostUsd: 5.0, purchaseAmountUsd: 7.5, currentPriceUsd: 10.0, currentAmountUsd: 15.0, pnlUsd: 7.5, netChange: 1.0, platform: "Vested" },
  ];
  await prisma.foreignHolding.createMany({ data: foreignData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Foreign holdings seeded (encrypted)");

  // ── Other Investments ─────────────────────────────────────────────────────
  const otherData = [
    { instrument: "LIC", brokerName: "Insurance - XYZ", accountNumber: "12345", annualPremium: 10000.0, currentAmount: 90000.0, totalInvestment: 20000.0, sumAssured: 100000.0, tenure: "Yearly", startDate: "2017-03-27T00:00:00.000Z", endDate: "2041-03-27T00:00:00.000Z", notes: "Last Payment 27 Mar 2031" },
    { instrument: "LIC", brokerName: "Insurance - ABC", accountNumber: "12345", annualPremium: 10000.0, currentAmount: 120000.0, totalInvestment: 20000.0, sumAssured: 100000.0, tenure: "Yearly", startDate: "2013-08-27T00:00:00.000Z", endDate: "2087-08-27T00:00:00.000Z", notes: "Last Payment 19 Aug 2087" },
  ];
  await prisma.otherInvestment.createMany({ data: otherData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Other investments seeded (encrypted)");

  // ── Bank Accounts ─────────────────────────────────────────────────────────
  const bankData = [
    { bankName: "ICICI Bank", ifscCode: "ICIC0000061", accountNumber: "12345", balance: 100000.0 },
  ];
  await prisma.bankAccount.createMany({ data: bankData.map((f) => ({ userId: seedUserId, encryptedData: enc(f) })) });
  console.log("✅ Bank accounts seeded (encrypted)");

  console.log("\n🎉 Database seeded successfully with encrypted data!");
  console.log(`🔐 Passphrase used: "${passphrase}" (from SEED_PASSPHRASE in .env)`);
  console.log("   Use this passphrase to unlock the app at /unlock");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

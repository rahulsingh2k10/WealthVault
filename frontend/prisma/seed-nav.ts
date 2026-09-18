import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** India's sidebar. Order = sortOrder. labelKey → t.nav[key] (translated by
 *  language). iconName → ICON_MAP in src/i18n/navConfig.ts. */
export const IN_NAV = [
  { href: "/dashboard",          labelKey: "dashboard",         iconName: "LayoutDashboard",  sortOrder: 1  },
  { href: "/stocks",             labelKey: "stocks",            iconName: "CandlestickChart", sortOrder: 2  },
  { href: "/mutual-funds",       labelKey: "mutualFunds",       iconName: "BarChart3",        sortOrder: 3  },
  { href: "/gold-commodities",   labelKey: "goldCommodities",   iconName: "Gem",              sortOrder: 4  },
  { href: "/real-estate",        labelKey: "realEstate",        iconName: "Home",             sortOrder: 5  },
  { href: "/crypto",             labelKey: "cryptocurrency",    iconName: "Bitcoin",          sortOrder: 6  },
  { href: "/insurance",          labelKey: "insurance",         iconName: "Shield",           sortOrder: 7  },
  { href: "/cash-banking",       labelKey: "cashBanking",       iconName: "Wallet",           sortOrder: 8  },
  { href: "/liabilities",        labelKey: "liabilities",       iconName: "HandCoins",        sortOrder: 9  },
  { href: "/fixed-income",       labelKey: "fixedIncome",       iconName: "Vault",            sortOrder: 10 },
  { href: "/government-schemes", labelKey: "governmentSchemes", iconName: "Landmark",         sortOrder: 11 },
] as const;

async function main() {
  await prisma.navConfig.deleteMany({ where: { country: "IN" } });
  await prisma.navConfig.createMany({
    data: IN_NAV.map((r) => ({ ...r, country: "IN" })),
  });
  console.log(`Seeded ${IN_NAV.length} nav_config rows for IN`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

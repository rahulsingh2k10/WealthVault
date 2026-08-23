import { redirect } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { SummaryCards } from '@/components/dashboard/SummaryCards'
import { AssetAllocationChart } from '@/components/dashboard/AssetAllocationChart'
import { PLBarChart } from '@/components/dashboard/PLBarChart'
import { CategoryCards } from '@/components/dashboard/CategoryCards'
import { prisma } from '@/lib/prisma'
import { AssetRepository } from '@/lib/repositories/AssetRepository'
import { EncryptionService } from '@/lib/services/EncryptionService'
import { PortfolioService } from '@/lib/services/PortfolioService'
import { getSession } from '@/lib/session'

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
  new EncryptionService()
)

export default async function DashboardPage() {
  const session = await getSession()
  if (!session.encryptionKey) redirect('/unlock')

  const summary = await portfolioService.getSummary(session.userId!, session.encryptionKey)

  return (
    <AppShell title="Dashboard" subtitle="Your complete investment portfolio overview">
      <div className="flex flex-col gap-6">
        <SummaryCards summary={summary} />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <AssetAllocationChart categories={summary.categories} />
          <PLBarChart categories={summary.categories} />
        </div>
        <CategoryCards categories={summary.categories} />
      </div>
    </AppShell>
  )
}

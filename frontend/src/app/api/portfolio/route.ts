import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { AssetRepository } from '@/lib/repositories/AssetRepository'
import { EncryptionService } from '@/lib/services/EncryptionService'
import { PortfolioService } from '@/lib/services/PortfolioService'
import { sessionService } from '@/lib/services/SessionService'
import { UnauthorizedError } from '@/lib/errors'

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

export async function GET() {
  try {
    const session = await sessionService.requireVault()
    const data = await portfolioService.getSummary(session.userId!, session.encryptionKey!)
    return NextResponse.json({ data })
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    console.error('Portfolio summary error:', e)
    return NextResponse.json({ error: 'Failed to fetch portfolio summary' }, { status: 500 })
  }
}

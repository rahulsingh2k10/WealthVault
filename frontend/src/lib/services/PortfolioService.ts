import type { IAssetRepository, EncryptedRecord } from '@/lib/interfaces/IAssetRepository'
import type { IEncryptionService } from '@/lib/interfaces/IEncryptionService'
import type { IPortfolioService } from '@/lib/interfaces/IPortfolioService'
import type { PortfolioSummary } from '@/lib/types'

const DEFAULT_USD_RATE = 84

export interface PortfolioRepositories {
  equityHoldings:    IAssetRepository<EncryptedRecord>
  mutualFunds:       IAssetRepository<EncryptedRecord>
  npsHoldings:       IAssetRepository<EncryptedRecord>
  cryptoHoldings:    IAssetRepository<EncryptedRecord>
  postOfficeSchemes: IAssetRepository<EncryptedRecord>
  fixedDeposits:     IAssetRepository<EncryptedRecord>
  foreignHoldings:   IAssetRepository<EncryptedRecord>
  otherInvestments:  IAssetRepository<EncryptedRecord>
  bankAccounts:      IAssetRepository<EncryptedRecord>
}

export class PortfolioService implements IPortfolioService {
  constructor(
    private repos: PortfolioRepositories,
    private encryption: IEncryptionService
  ) {}

  async getSummary(userId: string, encryptionKey: string): Promise<PortfolioSummary> {
    const [eq, mf, nps, crypto, po, fd, fh, oi, bank] = await Promise.all([
      this.repos.equityHoldings.findAll(userId),
      this.repos.mutualFunds.findAll(userId),
      this.repos.npsHoldings.findAll(userId),
      this.repos.cryptoHoldings.findAll(userId),
      this.repos.postOfficeSchemes.findAll(userId),
      this.repos.fixedDeposits.findAll(userId),
      this.repos.foreignHoldings.findAll(userId),
      this.repos.otherInvestments.findAll(userId),
      this.repos.bankAccounts.findAll(userId),
    ])

    const dec = <T>(records: EncryptedRecord[]): T[] =>
      records.map((r) => JSON.parse(this.encryption.decrypt(r.encryptedData, encryptionKey)) as T)

    const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = <T = any>(records: EncryptedRecord[]) => dec<T>(records) as any[]

    const categories = [
      { name: 'Holdings',         purchaseAmount: sum(d(eq).map((h) => h.purchaseAmount)),               currentAmount: sum(d(eq).map((h) => h.currentAmount)),               pnl: sum(d(eq).map((h) => h.pnl)) },
      { name: 'Mutual Funds',     purchaseAmount: sum(d(mf).map((h) => h.purchaseAmount)),               currentAmount: sum(d(mf).map((h) => h.currentAmount)),               pnl: sum(d(mf).map((h) => h.pnl)) },
      { name: 'NPS',              purchaseAmount: sum(d(nps).map((h) => h.purchaseAmount)),              currentAmount: sum(d(nps).map((h) => h.currentAmount)),              pnl: sum(d(nps).map((h) => h.pnl)) },
      { name: 'Cryptocurrency',   purchaseAmount: sum(d(crypto).map((h) => h.purchaseAmount)),           currentAmount: sum(d(crypto).map((h) => h.currentAmount)),           pnl: sum(d(crypto).map((h) => h.pnl)) },
      { name: 'Post Office',      purchaseAmount: sum(d(po).map((h) => h.purchaseAmount)),               currentAmount: sum(d(po).map((h) => h.maturityAmount)),              pnl: sum(d(po).map((h) => h.maturityAmount - h.purchaseAmount)) },
      { name: 'FD/RD/PPF',        purchaseAmount: sum(d(fd).map((h) => h.investmentAmount)),             currentAmount: sum(d(fd).map((h) => h.currentAmount)),               pnl: sum(d(fd).map((h) => h.currentAmount - h.investmentAmount)) },
      { name: 'Foreign Holdings', purchaseAmount: sum(d(fh).map((h) => h.purchaseAmountUsd * DEFAULT_USD_RATE)), currentAmount: sum(d(fh).map((h) => h.currentAmountUsd * DEFAULT_USD_RATE)), pnl: sum(d(fh).map((h) => h.pnlUsd * DEFAULT_USD_RATE)) },
      { name: 'Others',           purchaseAmount: sum(d(oi).map((h) => h.totalInvestment)),              currentAmount: sum(d(oi).map((h) => h.currentAmount)),               pnl: sum(d(oi).map((h) => h.currentAmount - h.totalInvestment)) },
    ].map((c) => ({ ...c, netChange: c.purchaseAmount > 0 ? c.pnl / c.purchaseAmount : 0 }))

    const totalInvested = sum(categories.map((c) => c.purchaseAmount))
    const currentValue  = sum(categories.map((c) => c.currentAmount))
    const totalPnL      = currentValue - totalInvested
    const bankBalance   = sum(d(bank).map((b) => b.balance))

    return {
      totalInvested,
      currentValue,
      totalPnL,
      overallReturn: totalInvested > 0 ? totalPnL / totalInvested : 0,
      bankBalance,
      totalAssets: currentValue + bankBalance,
      categories,
      usdRate: DEFAULT_USD_RATE,
    }
  }
}

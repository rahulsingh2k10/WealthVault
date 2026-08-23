import { PortfolioService } from '@/lib/services/PortfolioService'
import type { IAssetRepository, EncryptedRecord } from '@/lib/interfaces/IAssetRepository'
import type { IEncryptionService } from '@/lib/interfaces/IEncryptionService'

const NOW = new Date()
const makeRecord = (): EncryptedRecord => ({
  id: 1, userId: 'u1', encryptedData: 'blob', createdAt: NOW, updatedAt: NOW,
})

const makeRepo = (decryptedData: object): IAssetRepository<EncryptedRecord> => ({
  findAll: jest.fn().mockResolvedValue([makeRecord()]),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
})

const emptyRepo = (): IAssetRepository<EncryptedRecord> => ({
  findAll: jest.fn().mockResolvedValue([]),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
})

describe('PortfolioService', () => {
  it('aggregates equity holdings into summary', async () => {
    const equityData = { purchaseAmount: 10000, currentAmount: 12000, pnl: 2000 }

    const mockEncryption: IEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn().mockReturnValue(JSON.stringify(equityData)),
    }

    const service = new PortfolioService(
      {
        equityHoldings:    makeRepo(equityData),
        mutualFunds:       emptyRepo(),
        npsHoldings:       emptyRepo(),
        cryptoHoldings:    emptyRepo(),
        postOfficeSchemes: emptyRepo(),
        fixedDeposits:     emptyRepo(),
        foreignHoldings:   emptyRepo(),
        otherInvestments:  emptyRepo(),
        bankAccounts:      emptyRepo(),
      },
      mockEncryption
    )

    const summary = await service.getSummary('u1', 'key')

    expect(summary.totalInvested).toBe(10000)
    expect(summary.currentValue).toBe(12000)
    expect(summary.totalPnL).toBe(2000)
    expect(summary.categories).toHaveLength(8)
    const holdings = summary.categories.find((c) => c.name === 'Holdings')
    expect(holdings?.currentAmount).toBe(12000)
  })

  it('calculates overallReturn correctly', async () => {
    const data = { purchaseAmount: 10000, currentAmount: 11000, pnl: 1000 }
    const mockEncryption: IEncryptionService = {
      encrypt: jest.fn(),
      decrypt: jest.fn().mockReturnValue(JSON.stringify(data)),
    }
    const service = new PortfolioService(
      {
        equityHoldings:    makeRepo(data),
        mutualFunds:       emptyRepo(),
        npsHoldings:       emptyRepo(),
        cryptoHoldings:    emptyRepo(),
        postOfficeSchemes: emptyRepo(),
        fixedDeposits:     emptyRepo(),
        foreignHoldings:   emptyRepo(),
        otherInvestments:  emptyRepo(),
        bankAccounts:      emptyRepo(),
      },
      mockEncryption
    )
    const summary = await service.getSummary('u1', 'key')
    expect(summary.overallReturn).toBeCloseTo(0.1)
  })
})

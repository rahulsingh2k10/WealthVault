import type { PortfolioSummary } from '@/lib/types'

export interface IPortfolioService {
  getSummary(userId: string, encryptionKey: string): Promise<PortfolioSummary>
}

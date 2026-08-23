import type { IAssetRepository, EncryptedRecord } from '@/lib/interfaces/IAssetRepository'
import type { IEncryptionService } from '@/lib/interfaces/IEncryptionService'
import type { IAssetService } from '@/lib/interfaces/IAssetService'
import { NotFoundError } from '@/lib/errors'

export class AssetService<T extends { id?: number; createdAt?: string | Date; updatedAt?: string | Date }>
  implements IAssetService<T>
{
  constructor(
    private repo: IAssetRepository<EncryptedRecord>,
    private encryption: IEncryptionService
  ) {}

  async getAll(userId: string, encryptionKey: string): Promise<T[]> {
    const records = await this.repo.findAll(userId)
    return records.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      ...JSON.parse(this.encryption.decrypt(r.encryptedData, encryptionKey)),
    })) as T[]
  }

  async create(
    userId: string,
    encryptionKey: string,
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<T> {
    const encryptedData = this.encryption.encrypt(JSON.stringify(data), encryptionKey)
    const record = await this.repo.create(userId, encryptedData)
    return { id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt, ...data } as T
  }

  async update(
    id: number,
    userId: string,
    encryptionKey: string,
    data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<T> {
    const existing = await this.repo.findById(id, userId)
    if (!existing) throw new NotFoundError(`Record ${id} not found`)
    const current = JSON.parse(this.encryption.decrypt(existing.encryptedData, encryptionKey))
    const merged = { ...current, ...data }
    const encryptedData = this.encryption.encrypt(JSON.stringify(merged), encryptionKey)
    const record = await this.repo.update(id, userId, encryptedData)
    return { id: record.id, createdAt: record.createdAt, updatedAt: record.updatedAt, ...merged } as T
  }

  async delete(id: number, userId: string): Promise<void> {
    await this.repo.delete(id, userId)
  }
}

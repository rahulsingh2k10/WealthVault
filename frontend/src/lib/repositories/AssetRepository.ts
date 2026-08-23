import type { IAssetRepository, EncryptedRecord } from '@/lib/interfaces/IAssetRepository'

type PrismaDelegate = {
  findMany(args: { where: { userId: string }; orderBy?: { createdAt: 'asc' | 'desc' } }): Promise<EncryptedRecord[]>
  findFirst(args: { where: { id: number; userId: string } }): Promise<EncryptedRecord | null>
  create(args: { data: { userId: string; encryptedData: string } }): Promise<EncryptedRecord>
  update(args: { where: { id: number }; data: { encryptedData: string } }): Promise<EncryptedRecord>
  deleteMany(args: { where: { id: number; userId: string } }): Promise<{ count: number }>
}

export class AssetRepository<T> implements IAssetRepository<EncryptedRecord> {
  constructor(private delegate: PrismaDelegate) {}

  findAll(userId: string): Promise<EncryptedRecord[]> {
    return this.delegate.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } })
  }

  findById(id: number, userId: string): Promise<EncryptedRecord | null> {
    return this.delegate.findFirst({ where: { id, userId } })
  }

  create(userId: string, encryptedData: string): Promise<EncryptedRecord> {
    return this.delegate.create({ data: { userId, encryptedData } })
  }

  update(id: number, _userId: string, encryptedData: string): Promise<EncryptedRecord> {
    return this.delegate.update({ where: { id }, data: { encryptedData } })
  }

  async delete(id: number, userId: string): Promise<void> {
    await this.delegate.deleteMany({ where: { id, userId } })
  }
}

export type EncryptedRecord = {
  id: number
  userId: string
  encryptedData: string
  createdAt: Date
  updatedAt: Date
}

export interface IReadableRepository<T> {
  findAll(userId: string): Promise<T[]>
  findById(id: number, userId: string): Promise<T | null>
}

export interface IWritableRepository<T> {
  create(userId: string, encryptedData: string): Promise<T>
  update(id: number, userId: string, encryptedData: string): Promise<T>
  delete(id: number, userId: string): Promise<void>
}

export interface IAssetRepository<T>
  extends IReadableRepository<T>,
    IWritableRepository<T> {}

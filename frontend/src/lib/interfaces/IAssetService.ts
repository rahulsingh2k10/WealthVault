export interface IAssetService<T> {
  getAll(userId: string, encryptionKey: string): Promise<T[]>
  create(userId: string, encryptionKey: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<T>
  update(id: number, userId: string, encryptionKey: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<T>
  delete(id: number, userId: string): Promise<void>
}

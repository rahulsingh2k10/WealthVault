import { AssetService } from '@/lib/services/AssetService'
import type { IAssetRepository, EncryptedRecord } from '@/lib/interfaces/IAssetRepository'
import type { IEncryptionService } from '@/lib/interfaces/IEncryptionService'
import { NotFoundError } from '@/lib/errors'

const NOW = new Date()

const record: EncryptedRecord = {
  id: 1, userId: 'u1', encryptedData: 'blob', createdAt: NOW, updatedAt: NOW,
}

const mockRepo: IAssetRepository<EncryptedRecord> = {
  findAll:  jest.fn().mockResolvedValue([record]),
  findById: jest.fn().mockResolvedValue(record),
  create:   jest.fn().mockResolvedValue({ ...record, id: 2 }),
  update:   jest.fn().mockResolvedValue({ ...record, encryptedData: 'blob2' }),
  delete:   jest.fn().mockResolvedValue(undefined),
}

const mockEncryption: IEncryptionService = {
  encrypt: jest.fn().mockReturnValue('encrypted-blob'),
  decrypt: jest.fn().mockReturnValue('{"instrument":"AAPL","quantity":10}'),
}

type TestAsset = { id: number; createdAt: string; updatedAt: string; instrument: string; quantity: number }

describe('AssetService', () => {
  let service: AssetService<TestAsset>

  beforeEach(() => {
    jest.clearAllMocks()
    ;(mockRepo.findAll  as jest.Mock).mockResolvedValue([record])
    ;(mockRepo.findById as jest.Mock).mockResolvedValue(record)
    ;(mockRepo.create   as jest.Mock).mockResolvedValue({ ...record, id: 2 })
    ;(mockEncryption.decrypt as jest.Mock).mockReturnValue('{"instrument":"AAPL","quantity":10}')
    ;(mockEncryption.encrypt as jest.Mock).mockReturnValue('encrypted-blob')
    service = new AssetService(mockRepo, mockEncryption)
  })

  describe('getAll', () => {
    it('fetches records and decrypts each one', async () => {
      const result = await service.getAll('u1', 'key123')
      expect(mockRepo.findAll).toHaveBeenCalledWith('u1')
      expect(mockEncryption.decrypt).toHaveBeenCalledWith('blob', 'key123')
      expect(result[0]).toMatchObject({ id: 1, instrument: 'AAPL', quantity: 10 })
    })
  })

  describe('create', () => {
    it('encrypts fields and stores, returns with db id', async () => {
      const data = { instrument: 'AAPL', quantity: 10 }
      const result = await service.create('u1', 'key123', data)
      expect(mockEncryption.encrypt).toHaveBeenCalledWith(JSON.stringify(data), 'key123')
      expect(mockRepo.create).toHaveBeenCalledWith('u1', 'encrypted-blob')
      expect(result).toMatchObject({ id: 2, instrument: 'AAPL', quantity: 10 })
    })
  })

  describe('update', () => {
    it('merges patch with existing decrypted data, re-encrypts, returns merged', async () => {
      const result = await service.update(1, 'u1', 'key123', { quantity: 20 })
      const encryptCallArg = (mockEncryption.encrypt as jest.Mock).mock.calls[0][0]
      expect(JSON.parse(encryptCallArg)).toMatchObject({ instrument: 'AAPL', quantity: 20 })
      expect(result).toMatchObject({ instrument: 'AAPL', quantity: 20 })
    })

    it('throws NotFoundError when record does not exist', async () => {
      ;(mockRepo.findById as jest.Mock).mockResolvedValueOnce(null)
      await expect(service.update(99, 'u1', 'key', { quantity: 5 })).rejects.toThrow(NotFoundError)
    })
  })

  describe('delete', () => {
    it('delegates to repository', async () => {
      await service.delete(1, 'u1')
      expect(mockRepo.delete).toHaveBeenCalledWith(1, 'u1')
    })
  })
})

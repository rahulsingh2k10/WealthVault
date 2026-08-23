import { AssetRepository } from '@/lib/repositories/AssetRepository'

const hasDb = !!process.env.TEST_DATABASE_URL

const describeOrSkip = hasDb ? describe : describe.skip

describeOrSkip('AssetRepository (integration)', () => {
  let prisma: any
  let repo: AssetRepository<any>

  beforeAll(async () => {
    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL } } })
    repo = new AssetRepository(prisma.equityHolding)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('create persists an encrypted record scoped to userId', async () => {
    const record = await repo.create('test-user', 'encrypted-blob')
    expect(record.encryptedData).toBe('encrypted-blob')
    expect(record.userId).toBe('test-user')
    expect(typeof record.id).toBe('number')
    await repo.delete(record.id, 'test-user')
  })

  it('findAll returns only records for the given userId', async () => {
    const r = await repo.create('user-a', 'blob-a')
    const results = await repo.findAll('user-a')
    expect(results.every((x: any) => x.userId === 'user-a')).toBe(true)
    await repo.delete(r.id, 'user-a')
  })

  it('findById returns null for wrong userId', async () => {
    const r = await repo.create('user-a', 'blob')
    const result = await repo.findById(r.id, 'user-b')
    expect(result).toBeNull()
    await repo.delete(r.id, 'user-a')
  })

  it('delete removes only the specified record', async () => {
    const r = await repo.create('user-a', 'blob')
    await repo.delete(r.id, 'user-a')
    const found = await repo.findById(r.id, 'user-a')
    expect(found).toBeNull()
  })
})

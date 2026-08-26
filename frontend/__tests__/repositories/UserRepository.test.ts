import { UserRepository } from '@/lib/repositories/UserRepository'

jest.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      upsert: jest.fn().mockResolvedValue({
        id: 'u1',
        fullName: 'Test User',
        username: 'test@example.com',
        avatar: null,
      }),
    },
  },
}))

import { prisma } from '@/lib/prisma'

describe('UserRepository.upsert', () => {
  it('creates a new user with subscription defaulted to FREE', async () => {
    const repo = new UserRepository()

    await repo.upsert({ id: 'test@example.com', fullName: 'Test User', platform: 'Google' })

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ subscription: 'FREE' }),
      })
    )
  })
})

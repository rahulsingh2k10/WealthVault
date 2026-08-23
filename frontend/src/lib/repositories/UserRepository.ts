import { prisma } from '@/lib/prisma'
import type { IUserRepository, OAuthProfile } from '@/lib/interfaces/IUserRepository'

export class UserRepository implements IUserRepository {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id }, select: { id: true, verifier: true } })
  }

  async upsert(profile: OAuthProfile) {
    return prisma.user.upsert({
      where: { username: profile.id },
      update: { fullName: profile.fullName, platform: profile.platform, avatar: profile.avatar },
      create: { username: profile.id, fullName: profile.fullName, platform: profile.platform, avatar: profile.avatar, plan: 'FREE' },
      select: { id: true, fullName: true, username: true, avatar: true },
    })
  }

  async updateVerifier(userId: string, verifier: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { verifier } })
  }

  async updateAvatar(userId: string, avatar: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { avatar } })
  }

  async deleteAllData(userId: string): Promise<void> {
    await Promise.all([
      prisma.equityHolding.deleteMany({ where: { userId } }),
      prisma.mutualFund.deleteMany({ where: { userId } }),
      prisma.npsHolding.deleteMany({ where: { userId } }),
      prisma.cryptoHolding.deleteMany({ where: { userId } }),
      prisma.postOfficeScheme.deleteMany({ where: { userId } }),
      prisma.fixedDeposit.deleteMany({ where: { userId } }),
      prisma.foreignHolding.deleteMany({ where: { userId } }),
      prisma.otherInvestment.deleteMany({ where: { userId } }),
      prisma.bankAccount.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { verifier: null } }),
    ])
  }
}

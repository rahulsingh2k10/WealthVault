import { getSession } from '@/lib/session'
import { UnauthorizedError } from '@/lib/errors'
import type { ISessionService } from '@/lib/interfaces/ISessionService'
import type { SessionData } from '@/lib/session'

export class SessionService implements ISessionService {
  async getSession(): Promise<SessionData> {
    return getSession()
  }

  async requireAuth(): Promise<SessionData> {
    const session = await getSession()
    if (!session.userId) throw new UnauthorizedError()
    return session
  }

  async requireVault(): Promise<SessionData> {
    const session = await getSession()
    if (!session.encryptionKey) throw new UnauthorizedError()
    return session
  }

  async setEncryptionKey(keyHex: string): Promise<void> {
    const session = await getSession()
    session.encryptionKey = keyHex
    await session.save()
  }

  async clearEncryptionKey(): Promise<void> {
    const session = await getSession()
    session.encryptionKey = undefined
    await session.save()
  }

  async destroy(): Promise<void> {
    const session = await getSession()
    session.destroy()
  }
}

export const sessionService = new SessionService()

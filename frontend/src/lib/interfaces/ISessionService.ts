import type { SessionData } from '@/lib/session'

export interface ISessionService {
  getSession(): Promise<SessionData>
  requireAuth(): Promise<SessionData>
  requireVault(): Promise<SessionData>
  setEncryptionKey(keyHex: string): Promise<void>
  clearEncryptionKey(): Promise<void>
  destroy(): Promise<void>
}

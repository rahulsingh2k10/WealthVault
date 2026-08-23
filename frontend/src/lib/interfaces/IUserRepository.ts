export interface OAuthProfile {
  id: string
  fullName: string
  avatar?: string
  platform: string
}

export interface IUserRepository {
  findById(id: string): Promise<{ id: string; verifier: string | null } | null>
  upsert(profile: OAuthProfile): Promise<{ id: string; fullName: string; username: string; avatar: string | null }>
  updateVerifier(userId: string, verifier: string): Promise<void>
  updateAvatar(userId: string, avatar: string): Promise<void>
  deleteAllData(userId: string): Promise<void>
}

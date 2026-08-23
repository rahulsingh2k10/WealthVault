import { encrypt, decrypt, deriveKey } from '@/lib/encryption'
import type { IEncryptionService, IKeyDerivationService } from '@/lib/interfaces/IEncryptionService'

const VERIFIER_PLAINTEXT = 'PORTFOLIO_APP_V1'

export class EncryptionService implements IEncryptionService, IKeyDerivationService {
  encrypt(plaintext: string, keyHex: string): string {
    return encrypt(plaintext, keyHex)
  }

  decrypt(ciphertext: string, keyHex: string): string {
    return decrypt(ciphertext, keyHex)
  }

  deriveKey(passphrase: string): string {
    return deriveKey(passphrase)
  }

  createVerifier(keyHex: string): string {
    return encrypt(VERIFIER_PLAINTEXT, keyHex)
  }

  verifyKey(keyHex: string, verifier: string): boolean {
    try {
      return decrypt(verifier, keyHex) === VERIFIER_PLAINTEXT
    } catch {
      return false
    }
  }
}

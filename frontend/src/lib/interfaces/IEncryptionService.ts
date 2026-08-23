export interface IEncryptionService {
  encrypt(plaintext: string, keyHex: string): string
  decrypt(ciphertext: string, keyHex: string): string
}

export interface IKeyDerivationService {
  deriveKey(passphrase: string): string
  createVerifier(keyHex: string): string
  verifyKey(keyHex: string, verifier: string): boolean
}

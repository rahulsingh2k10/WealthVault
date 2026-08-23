import { EncryptionService } from '@/lib/services/EncryptionService'

const svc = new EncryptionService()

describe('EncryptionService', () => {
  it('encrypt → decrypt round-trips correctly', () => {
    const key = svc.deriveKey('MyVault99!!secret')
    const plaintext = JSON.stringify({ instrument: 'RELIANCE', quantity: 10 })
    const ciphertext = svc.encrypt(plaintext, key)
    expect(ciphertext).not.toBe(plaintext)
    expect(svc.decrypt(ciphertext, key)).toBe(plaintext)
  })

  it('decrypt throws with wrong key', () => {
    const key1 = svc.deriveKey('MyVault99!!secret')
    const key2 = svc.deriveKey('DifferentPass11!!')
    const ciphertext = svc.encrypt('hello', key1)
    expect(() => svc.decrypt(ciphertext, key2)).toThrow()
  })

  it('deriveKey returns same hex for same passphrase', () => {
    expect(svc.deriveKey('MyVault99!!secret')).toBe(svc.deriveKey('MyVault99!!secret'))
  })

  it('createVerifier + verifyKey returns true for correct key', () => {
    const key = svc.deriveKey('MyVault99!!secret')
    const verifier = svc.createVerifier(key)
    expect(svc.verifyKey(key, verifier)).toBe(true)
  })

  it('verifyKey returns false for wrong key', () => {
    const key1 = svc.deriveKey('MyVault99!!secret')
    const key2 = svc.deriveKey('WrongPass22!!')
    const verifier = svc.createVerifier(key1)
    expect(svc.verifyKey(key2, verifier)).toBe(false)
  })
})

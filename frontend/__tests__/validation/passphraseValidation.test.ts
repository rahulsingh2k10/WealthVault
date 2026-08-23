import { validatePassphrase } from '@/lib/validation/passphraseValidation'

describe('validatePassphrase', () => {
  it('rejects passphrase shorter than 12 characters', () => {
    const result = validatePassphrase('Short1!!')
    expect(result.valid).toBe(false)
    expect(result.checks.minLength).toBe(false)
  })

  it('rejects passphrase with no number', () => {
    const result = validatePassphrase('MyVaultSecret!!')
    expect(result.valid).toBe(false)
    expect(result.checks.hasAlphanumeric).toBe(false)
  })

  it('rejects passphrase with fewer than 2 uppercase letters', () => {
    const result = validatePassphrase('myvault99!!secret')
    expect(result.valid).toBe(false)
    expect(result.checks.hasUpper).toBe(false)
  })

  it('rejects passphrase with fewer than 2 special characters', () => {
    const result = validatePassphrase('MyVault99secret!')
    expect(result.valid).toBe(false)
    expect(result.checks.hasSpecial).toBe(false)
  })

  it('rejects passphrase over 256 characters', () => {
    const result = validatePassphrase('A'.repeat(200) + '1!!aB' + 'x'.repeat(60))
    expect(result.valid).toBe(false)
    expect(result.checks.underMax).toBe(false)
  })

  it('accepts a strong passphrase', () => {
    const result = validatePassphrase('MyVault99!!secret')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
    expect(result.checks.minLength).toBe(true)
    expect(result.checks.hasAlphanumeric).toBe(true)
    expect(result.checks.hasUpper).toBe(true)
    expect(result.checks.hasSpecial).toBe(true)
    expect(result.checks.underMax).toBe(true)
  })

  it('returns all failing checks when everything is wrong', () => {
    const result = validatePassphrase('abc')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

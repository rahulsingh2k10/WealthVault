export interface PassphraseChecks {
  minLength: boolean
  hasAlphanumeric: boolean
  hasUpper: boolean
  hasSpecial: boolean
  underMax: boolean
}

export interface PassphraseValidationResult {
  valid: boolean
  errors: string[]
  checks: PassphraseChecks
}

export function validatePassphrase(passphrase: string): PassphraseValidationResult {
  const checks: PassphraseChecks = {
    minLength:       passphrase.length >= 12,
    hasAlphanumeric: /[a-zA-Z]/.test(passphrase) && /\d/.test(passphrase),
    hasUpper:        (passphrase.match(/[A-Z]/g) ?? []).length >= 2,
    hasSpecial:      (passphrase.match(/[^a-zA-Z0-9]/g) ?? []).length >= 2,
    underMax:        passphrase.length <= 256,
  }

  const errors: string[] = []
  if (!checks.minLength)       errors.push('Passphrase must be at least 12 characters')
  if (!checks.hasAlphanumeric) errors.push('Passphrase must contain a letter and a number')
  if (!checks.hasUpper)        errors.push('Passphrase must contain at least two uppercase letters')
  if (!checks.hasSpecial)      errors.push('Passphrase must contain at least two special characters')
  if (!checks.underMax)        errors.push('Passphrase must be 256 characters or fewer')

  return { valid: errors.length === 0, errors, checks }
}

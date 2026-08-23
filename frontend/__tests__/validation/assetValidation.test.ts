import { validateRequiredString, validatePositiveNumber, validateNonNegativeNumber } from '@/lib/validation/assetValidation'

describe('validateRequiredString', () => {
  it('returns null for a valid string', () => {
    expect(validateRequiredString('RELIANCE', 'instrument')).toBeNull()
  })
  it('returns error for empty string', () => {
    expect(validateRequiredString('', 'instrument')).toBe('instrument is required')
  })
  it('returns error for whitespace-only string', () => {
    expect(validateRequiredString('   ', 'instrument')).toBe('instrument is required')
  })
  it('returns error for null', () => {
    expect(validateRequiredString(null, 'instrument')).toBe('instrument is required')
  })
  it('returns error for undefined', () => {
    expect(validateRequiredString(undefined, 'instrument')).toBe('instrument is required')
  })
})

describe('validatePositiveNumber', () => {
  it('returns null for a positive number', () => {
    expect(validatePositiveNumber(10, 'quantity')).toBeNull()
  })
  it('returns error for zero', () => {
    expect(validatePositiveNumber(0, 'quantity')).toBe('quantity must be a positive number')
  })
  it('returns error for negative', () => {
    expect(validatePositiveNumber(-5, 'quantity')).toBe('quantity must be a positive number')
  })
  it('returns error for NaN string', () => {
    expect(validatePositiveNumber('abc', 'quantity')).toBe('quantity must be a positive number')
  })
})

describe('validateNonNegativeNumber', () => {
  it('returns null for zero', () => {
    expect(validateNonNegativeNumber(0, 'balance')).toBeNull()
  })
  it('returns null for positive number', () => {
    expect(validateNonNegativeNumber(100, 'balance')).toBeNull()
  })
  it('returns error for negative', () => {
    expect(validateNonNegativeNumber(-1, 'balance')).toBe('balance must be zero or positive')
  })
})

export function validateRequiredString(value: unknown, fieldName: string): string | null {
  if (!value || typeof value !== 'string' || value.trim() === '') {
    return `${fieldName} is required`
  }
  return null
}

export function validatePositiveNumber(value: unknown, fieldName: string): string | null {
  const n = Number(value)
  if (isNaN(n) || n <= 0) {
    return `${fieldName} must be a positive number`
  }
  return null
}

export function validateNonNegativeNumber(value: unknown, fieldName: string): string | null {
  const n = Number(value)
  if (isNaN(n) || n < 0) {
    return `${fieldName} must be zero or positive`
  }
  return null
}

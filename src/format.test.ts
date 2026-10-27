import { describe, expect, it } from 'vitest'
import { formatCurrency, formatMonth, formatShortDate, parseCurrencyInput } from './format'

describe('currency formatting', () => {
  it('parses decimal currency without losing cents', () => {
    expect(parseCurrencyInput('1234.5')).toBe(123_450)
    expect(parseCurrencyInput('0.01')).toBe(1)
  })

  it('rejects zero, malformed, over-precise, and unsafe amounts', () => {
    expect(parseCurrencyInput('0')).toBeNull()
    expect(parseCurrencyInput('1.234')).toBeNull()
    expect(parseCurrencyInput('1,000.00')).toBe(100_000)
    expect(parseCurrencyInput('-4')).toBeNull()
    expect(parseCurrencyInput('90071992547410')).toBeNull()
  })

  it('formats cents as currency and months as readable dates', () => {
    expect(formatCurrency(1_234_567)).toContain('12,345.67')
    expect(formatMonth('2025-04')).toBe('April 2025')
    expect(formatShortDate('2025-04-03')).toContain('3')
  })
})
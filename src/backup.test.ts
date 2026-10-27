import { describe, expect, it } from 'vitest'
import { createBackup, mergeBackup, parseBackup } from './backup'
import type { Expense, Member } from './types'
import { BACKUP_FORMAT } from './types'

const member: Member = { id: 'alex', name: 'Alex', monthlyIncomeCents: 250_000, color: '#347b62', createdAt: '2025-01-01' }
const expense: Expense = { id: 'rent', title: 'Rent', amountCents: 120_000, category: 'Housing', type: 'shared', memberId: null, date: '2025-04-01', createdAt: '2025-04-01' }

describe('backup validation and merge', () => {
  it('round-trips a valid versioned backup', () => {
    const backup = createBackup([member], [expense], { monthlyBudgetCents: null }, '2025-04-05T12:00:00.000Z')
    expect(parseBackup(JSON.stringify(backup))).toEqual(backup)
  })

  it('rejects malformed JSON, unsupported versions, and invalid references', () => {
    expect(() => parseBackup('{')).toThrow('not valid JSON')
    expect(() => parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 2, members: [], expenses: [] }))).toThrow('not a supported')
    const invalid = createBackup([], [{ ...expense, type: 'personal', memberId: 'missing' }])
    expect(() => parseBackup(JSON.stringify(invalid))).toThrow('expense entry')
    expect(() => parseBackup(JSON.stringify(createBackup([], [{ ...expense, date: '2025-02-31' }])))).toThrow('expense entry')
    expect(() => parseBackup(JSON.stringify(createBackup([], [{ ...expense, category: 'Unlisted' as Expense['category'] }])))).toThrow('expense entry')
  })

  it('merges by stable IDs and allows imported records to update existing ones', () => {
    const existing = createBackup([member], [expense], { monthlyBudgetCents: 100_000 })
    const changedMember = { ...member, name: 'Alexandra' }
    const addedExpense = { ...expense, id: 'food', title: 'Groceries' }
    const merged = mergeBackup(existing, createBackup([changedMember], [addedExpense], { monthlyBudgetCents: 200_000 }))

    expect(merged.members).toEqual([changedMember])
    expect(merged.expenses.map((item) => item.id)).toEqual(['rent', 'food'])
    expect(merged.settings?.monthlyBudgetCents).toBe(200_000)
  })
})
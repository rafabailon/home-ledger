import { describe, expect, it } from 'vitest'
import { calculateSharedShares, filterExpensesByMonth, filterExpensesByRange, getBudgetSummary, getExpenseTotalsByCategory, getMonthlyTrend, getRecentMonths, summarizeMembers } from './finance'
import type { Expense, Member } from './types'

const members: Member[] = [
  { id: 'alex', name: 'Alex', monthlyIncomeCents: 300_000, color: '#347b62', createdAt: '2025-01-01' },
  { id: 'sam', name: 'Sam', monthlyIncomeCents: 200_000, color: '#db714a', createdAt: '2025-01-01' },
]

const expenses: Expense[] = [
  { id: 'rent', title: 'Rent', amountCents: 150_000, category: 'Housing', type: 'shared', memberId: null, date: '2025-04-01', createdAt: '2025-04-01' },
  { id: 'coffee', title: 'Coffee', amountCents: 550, category: 'Leisure', type: 'personal', memberId: 'alex', date: '2025-04-03', createdAt: '2025-04-03' },
  { id: 'old', title: 'Old groceries', amountCents: 1_000, category: 'Groceries', type: 'shared', memberId: null, date: '2025-03-30', createdAt: '2025-03-30' },
]

describe('calculateSharedShares', () => {
  it('splits a common expense by income and preserves every cent', () => {
    const shares = calculateSharedShares(10_001, members)

    expect(shares.get('alex')).toBe(6_001)
    expect(shares.get('sam')).toBe(4_000)
    expect([...shares.values()].reduce((sum, amount) => sum + amount, 0)).toBe(10_001)
  })

  it('uses equal shares when all household incomes are zero', () => {
    const noIncome = members.map((member) => ({ ...member, monthlyIncomeCents: 0 }))
    expect([...calculateSharedShares(5, noIncome).values()]).toEqual([3, 2])
  })

  it('ignores invalid amounts and empty households', () => {
    expect(calculateSharedShares(-1, members).size).toBe(0)
    expect(calculateSharedShares(100, []).size).toBe(0)
  })
})

describe('household summaries', () => {
  it('combines a member share with only their personal spending', () => {
    const summary = summarizeMembers(members, expenses)
    expect(summary[0].sharedShareCents).toBe(90_600)
    expect(summary[0].personalCents).toBe(550)
    expect(summary[0].remainingCents).toBe(208_850)
    expect(summary[1].personalCents).toBe(0)
  })

  it('filters by calendar month and builds an ordered trend', () => {
    expect(filterExpensesByMonth(expenses, '2025-04')).toHaveLength(2)
    expect(getMonthlyTrend(expenses, ['2025-03', '2025-04'])).toEqual([
      { month: '2025-03', shared: 1_000, personal: 0 },
      { month: '2025-04', shared: 150_000, personal: 550 },
    ])
  })

  it('filters reports by inclusive date range and optional category', () => {
    expect(filterExpensesByRange(expenses, '2025-04-02', '2025-04-30', 'Leisure')).toEqual([expenses[1]])
    expect(filterExpensesByRange(expenses, '2025-03-30', '2025-04-01')).toEqual([expenses[0], expenses[2]])
    expect(filterExpensesByRange(expenses, '2025-05-01', '2025-04-01')).toEqual([])
  })

  it('returns recent month keys across year boundaries', () => {
    expect(getRecentMonths(3, new Date('2025-01-15T12:00:00'))).toEqual(['2024-11', '2024-12', '2025-01'])
  })
})

describe('budget and category helpers', () => {
  it('summarizes budget usage with remaining and percent', () => {
    expect(getBudgetSummary(expenses.filter((e) => e.date.startsWith('2025-04')), 200_000)).toEqual({
      spentCents: 150_550,
      budgetCents: 200_000,
      remainingCents: 49_450,
      percentUsed: 0.75275,
    })
    expect(getBudgetSummary(expenses, null)).toEqual({ spentCents: 151_550, budgetCents: null, remainingCents: null, percentUsed: null })
    expect(getBudgetSummary(expenses, 10_000)).toMatchObject({ remainingCents: -141_550 })
  })

  it('aggregates expenses by category only for non-zero totals', () => {
    const totals = getExpenseTotalsByCategory(expenses)
    expect(totals.find((item) => item.category === 'Housing')?.totalCents).toBe(150_000)
    expect(totals.find((item) => item.category === 'Leisure')?.totalCents).toBe(550)
    expect(totals.find((item) => item.category === 'Groceries')?.totalCents).toBe(1_000)
    expect(totals.some((item) => item.category === 'Transport')).toBe(false)
  })
})
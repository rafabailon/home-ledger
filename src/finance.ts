import type { Category, Expense, Member, MemberSummary } from './types'
import { CATEGORIES } from './types'

const DAY_IN_MS = 86_400_000

export function calculateSharedShares(totalCents: number, members: Member[]): Map<string, number> {
  const shares = new Map<string, number>()
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || members.length === 0) return shares

  const totalIncome = members.reduce((sum, member) => sum + Math.max(0, member.monthlyIncomeCents), 0)
  const weights = members.map((member) =>
    totalIncome > 0 ? Math.max(0, member.monthlyIncomeCents) / totalIncome : 1 / members.length,
  )
  const exactShares = weights.map((weight) => totalCents * weight)
  const roundedShares = exactShares.map(Math.floor)
  let remainingCents = totalCents - roundedShares.reduce((sum, share) => sum + share, 0)

  // Largest remainders keep integer-cent shares exact and stable between runs.
  const remainderOrder = exactShares
    .map((share, index) => ({ index, remainder: share - Math.floor(share) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index)

  for (let index = 0; index < remainderOrder.length && remainingCents > 0; index += 1) {
    roundedShares[remainderOrder[index].index] += 1
    remainingCents -= 1
  }

  members.forEach((member, index) => shares.set(member.id, roundedShares[index]))
  return shares
}

export function summarizeMembers(members: Member[], expenses: Expense[]): MemberSummary[] {
  // Current income weights apply to every shared expense in the requested period.
  const sharedExpenses = expenses.filter((expense) => expense.type === 'shared')
  const sharesByExpense = sharedExpenses.map((expense) => calculateSharedShares(expense.amountCents, members))

  return members.map((member) => {
    const sharedShareCents = sharesByExpense.reduce(
      (sum, shares) => sum + (shares.get(member.id) ?? 0),
      0,
    )
    const personalCents = expenses.reduce(
      (sum, expense) =>
        sum + (expense.type === 'personal' && expense.memberId === member.id ? expense.amountCents : 0),
      0,
    )
    const totalSpentCents = sharedShareCents + personalCents
    const totalIncome = members.reduce((sum, item) => sum + Math.max(0, item.monthlyIncomeCents), 0)

    return {
      member,
      weight: totalIncome > 0 ? Math.max(0, member.monthlyIncomeCents) / totalIncome : 1 / members.length,
      sharedShareCents,
      personalCents,
      totalSpentCents,
      remainingCents: member.monthlyIncomeCents - totalSpentCents,
    }
  })
}

export function filterExpensesByMonth(expenses: Expense[], month: string): Expense[] {
  return expenses.filter((expense) => expense.date.startsWith(`${month}-`))
}

export function filterExpensesByRange(
  expenses: Expense[],
  startDate: string,
  endDate: string,
  category: Category | 'All categories' = 'All categories',
): Expense[] {
  return expenses.filter(
    (expense) =>
      (!startDate || expense.date >= startDate) &&
      (!endDate || expense.date <= endDate) &&
      (category === 'All categories' || expense.category === category),
  )
}

export function isValidCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value
}

export function getRecentMonths(count: number, now = new Date()): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - index - 1), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

export function getMonthlyTrend(expenses: Expense[], months: string[]) {
  return months.map((month) => ({
    month,
    shared: expenses
      .filter((expense) => expense.type === 'shared' && expense.date.startsWith(`${month}-`))
      .reduce((sum, expense) => sum + expense.amountCents, 0),
    personal: expenses
      .filter((expense) => expense.type === 'personal' && expense.date.startsWith(`${month}-`))
      .reduce((sum, expense) => sum + expense.amountCents, 0),
  }))
}

export function isValidExpenseDate(date: string, now = new Date()): boolean {
  const timestamp = Date.parse(`${date}T00:00:00`)
  return Number.isFinite(timestamp) && timestamp <= now.getTime() + DAY_IN_MS
}

export function getBudgetSummary(monthExpenses: Expense[], budgetCents: number | null) {
  const spentCents = monthExpenses.reduce((sum, expense) => sum + expense.amountCents, 0)
  if (budgetCents === null) {
    return { spentCents, budgetCents: null, remainingCents: null, percentUsed: null }
  }
  const remainingCents = budgetCents - spentCents
  const percentUsed = budgetCents === 0 ? 1 : spentCents / budgetCents
  return { spentCents, budgetCents, remainingCents, percentUsed }
}

export function getExpenseTotalsByCategory(expenses: Expense[]): Array<{ category: Category; totalCents: number }> {
  const totals = new Map<Category, number>()
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountCents)
  }
  return CATEGORIES.map((category) => ({ category, totalCents: totals.get(category) ?? 0 })).filter(
    (item) => item.totalCents > 0,
  )
}

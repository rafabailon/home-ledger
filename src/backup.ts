import type { Expense, HouseholdBackup, HouseholdSettings, Member } from './types'
import { BACKUP_FORMAT, BACKUP_VERSION, CATEGORIES, MAX_BACKUP_BYTES } from './types'
import { isValidCalendarDate } from './finance'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSettings(settings: unknown): HouseholdSettings | undefined {
  if (!isRecord(settings)) return undefined
  const budget = settings.monthlyBudgetCents
  if (typeof budget !== 'number' || !Number.isSafeInteger(budget) || budget <= 0) {
    return { monthlyBudgetCents: null }
  }
  return { monthlyBudgetCents: budget }
}

export function createBackup(
  members: Member[],
  expenses: Expense[],
  settings: HouseholdSettings = { monthlyBudgetCents: null },
  exportedAt = new Date().toISOString(),
): HouseholdBackup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    members,
    expenses,
    settings: normalizeSettings(settings) ?? { monthlyBudgetCents: null },
  }
}

export function parseBackup(content: string): HouseholdBackup {
  // Reject oversized or malformed data before any IndexedDB transaction can start.
  if (new TextEncoder().encode(content).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Backup file exceeds the 10 MB limit.')
  }

  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    throw new Error('The selected file is not valid JSON.')
  }

  if (!isRecord(value) || value.format !== BACKUP_FORMAT || value.version !== BACKUP_VERSION) {
    throw new Error('This file is not a supported Home Ledger backup.')
  }
  if (!Array.isArray(value.members) || !Array.isArray(value.expenses)) {
    throw new Error('Backup members and expenses must be arrays.')
  }

  const memberIds = new Set<string>()
  const members = value.members.map((member): Member => {
    if (
      !isRecord(member) ||
      typeof member.id !== 'string' ||
      !member.id ||
      typeof member.name !== 'string' ||
      !member.name.trim() ||
      !Number.isSafeInteger(member.monthlyIncomeCents) ||
      (member.monthlyIncomeCents as number) < 0 ||
      typeof member.color !== 'string' ||
      typeof member.createdAt !== 'string' ||
      memberIds.has(member.id)
    ) {
      throw new Error('A member entry in this backup is invalid.')
    }
    memberIds.add(member.id)
    return member as unknown as Member
  })

  const expenseIds = new Set<string>()
  const expenses = value.expenses.map((expense): Expense => {
    if (
      !isRecord(expense) ||
      typeof expense.id !== 'string' ||
      !expense.id ||
      typeof expense.title !== 'string' ||
      !expense.title.trim() ||
      !Number.isSafeInteger(expense.amountCents) ||
      (expense.amountCents as number) <= 0 ||
      typeof expense.category !== 'string' ||
      !CATEGORIES.includes(expense.category as (typeof CATEGORIES)[number]) ||
      (expense.type !== 'shared' && expense.type !== 'personal') ||
      typeof expense.date !== 'string' ||
      !isValidCalendarDate(expense.date) ||
      typeof expense.createdAt !== 'string' ||
      expenseIds.has(expense.id) ||
      (expense.type === 'personal' &&
        (typeof expense.memberId !== 'string' || !memberIds.has(expense.memberId))) ||
      (expense.type === 'shared' && expense.memberId !== null)
    ) {
      throw new Error('An expense entry in this backup is invalid.')
    }
    expenseIds.add(expense.id)
    return expense as unknown as Expense
  })

  return createBackup(members, expenses, normalizeSettings(value.settings), typeof value.exportedAt === 'string' ? value.exportedAt : '')
}

export function mergeBackup(current: HouseholdBackup, imported: HouseholdBackup): HouseholdBackup {
  const members = new Map(current.members.map((member) => [member.id, member]))
  imported.members.forEach((member) => members.set(member.id, member))
  const memberIds = new Set(members.keys())
  const expenses = new Map(current.expenses.map((expense) => [expense.id, expense]))
  imported.expenses.forEach((expense) => {
    if (expense.type === 'shared' || (expense.memberId && memberIds.has(expense.memberId))) {
      expenses.set(expense.id, expense)
    }
  })

  const settings: HouseholdSettings = imported.settings?.monthlyBudgetCents
    ? normalizeSettings(imported.settings)!
    : normalizeSettings(current.settings)!

  return createBackup([...members.values()], [...expenses.values()], settings)
}

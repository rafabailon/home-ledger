export const CATEGORIES = [
  'Groceries',
  'Housing',
  'Utilities',
  'Transport',
  'Health',
  'Leisure',
  'Savings',
  'Other',
] as const

export const BACKUP_FORMAT = 'home-ledger-backup'
export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024

export type Category = (typeof CATEGORIES)[number]
export type ExpenseType = 'shared' | 'personal'

export interface Member {
  id: string
  name: string
  monthlyIncomeCents: number
  color: string
  createdAt: string
}

export interface Expense {
  id: string
  title: string
  amountCents: number
  category: Category
  type: ExpenseType
  memberId: string | null
  date: string
  createdAt: string
}

export interface HouseholdSettings {
  monthlyBudgetCents: number | null
}

export interface StoredHouseholdSettings extends HouseholdSettings {
  key: string
}

export interface HouseholdBackup {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  exportedAt: string
  members: Member[]
  expenses: Expense[]
  settings?: HouseholdSettings
}

export interface MemberSummary {
  member: Member
  weight: number
  sharedShareCents: number
  personalCents: number
  totalSpentCents: number
  remainingCents: number
}

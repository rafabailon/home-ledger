import Dexie, { type Table } from 'dexie'
import type {
  Expense,
  HouseholdBackup,
  HouseholdSettings,
  Member,
  StoredHouseholdSettings,
} from './types'

const SETTINGS_KEY = 'household'
const DEFAULT_SETTINGS: HouseholdSettings = { monthlyBudgetCents: null }

class HouseholdDatabase extends Dexie {
  members!: Table<Member, string>
  expenses!: Table<Expense, string>
  settings!: Table<StoredHouseholdSettings, string>

  constructor() {
    super('home-ledger-household')
    this.version(1).stores({ members: 'id, name', expenses: 'id, date, type, category, memberId' })
    this.version(2).stores({
      members: 'id, name',
      expenses: 'id, date, type, category, memberId',
      settings: 'key',
    })
  }
}

export const database = new HouseholdDatabase()

function normalizeSettings(settings?: HouseholdSettings | null): HouseholdSettings {
  const budget = settings?.monthlyBudgetCents
  return {
    monthlyBudgetCents:
      typeof budget === 'number' && Number.isSafeInteger(budget) && budget > 0 ? budget : null,
  }
}

export async function readHousehold(): Promise<{ members: Member[]; expenses: Expense[] }> {
  const [members, expenses] = await Promise.all([database.members.toArray(), database.expenses.toArray()])
  return {
    members,
    expenses: [...expenses].sort((left, right) => right.date.localeCompare(left.date)),
  }
}

export async function readSettings(): Promise<HouseholdSettings> {
  const stored = await database.settings.get(SETTINGS_KEY)
  return stored ? normalizeSettings(stored) : { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: HouseholdSettings): Promise<void> {
  const normalized = normalizeSettings(settings)
  await database.settings.put({ key: SETTINGS_KEY, ...normalized })
}

export async function saveMember(member: Member): Promise<void> {
  await database.members.put(member)
}

export async function removeMember(memberId: string): Promise<void> {
  // Delete private expenses and the member together so no dangling owner IDs remain.
  await database.transaction('rw', database.members, database.expenses, async () => {
    await database.expenses.where('memberId').equals(memberId).delete()
    await database.members.delete(memberId)
  })
}

export async function saveExpense(expense: Expense): Promise<void> {
  await database.expenses.put(expense)
}

export async function removeExpense(expenseId: string): Promise<void> {
  await database.expenses.delete(expenseId)
}

export async function replaceHousehold(backup: HouseholdBackup): Promise<void> {
  // Validation happens before this transaction; a failed write preserves the old ledger.
  await database.transaction('rw', database.members, database.expenses, database.settings, async () => {
    await database.members.clear()
    await database.expenses.clear()
    await database.settings.clear()
    await database.members.bulkPut(backup.members)
    await database.expenses.bulkPut(backup.expenses)
    if (backup.settings) {
      await database.settings.put({ key: SETTINGS_KEY, ...normalizeSettings(backup.settings) })
    }
  })
}

export async function mergeHousehold(backup: HouseholdBackup): Promise<void> {
  // Stable IDs make imports idempotent and let backups update matching records.
  await database.transaction('rw', database.members, database.expenses, database.settings, async () => {
    await database.members.bulkPut(backup.members)
    await database.expenses.bulkPut(backup.expenses)
    if (backup.settings) {
      await database.settings.put({ key: SETTINGS_KEY, ...normalizeSettings(backup.settings) })
    }
  })
}

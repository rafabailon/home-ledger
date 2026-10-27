import { beforeEach, describe, expect, it } from 'vitest'
import { database, mergeHousehold, readHousehold, readSettings, removeMember, replaceHousehold, saveExpense, saveMember, saveSettings } from './database'
import { createBackup } from './backup'
import type { Expense, Member } from './types'

const member: Member = { id: 'alex', name: 'Alex', monthlyIncomeCents: 300_000, color: '#347b62', createdAt: '2025-01-01' }
const sharedExpense: Expense = { id: 'rent', title: 'Rent', amountCents: 100_000, category: 'Housing', type: 'shared', memberId: null, date: '2025-04-01', createdAt: '2025-04-01' }
const personalExpense: Expense = { ...sharedExpense, id: 'coffee', title: 'Coffee', type: 'personal', memberId: 'alex' }

describe('local household database', () => {
  beforeEach(async () => {
    await database.transaction('rw', database.members, database.expenses, database.settings, async () => {
      await database.members.clear()
      await database.expenses.clear()
      await database.settings.clear()
    })
  })

  it('persists members and expenses and removes only a departing member’s personal expenses', async () => {
    await saveMember(member)
    await saveExpense(sharedExpense)
    await saveExpense(personalExpense)
    await removeMember(member.id)

    const result = await readHousehold()
    expect(result.members).toEqual([])
    expect(result.expenses).toEqual([sharedExpense])
  })

  it('replaces the household in a single transaction', async () => {
    await saveMember({ ...member, id: 'old' })
    await saveExpense({ ...sharedExpense, id: 'old-rent' })
    await saveSettings({ monthlyBudgetCents: 50_000 })

    await replaceHousehold(createBackup([member], [sharedExpense], { monthlyBudgetCents: 150_000 }))

    expect(await readHousehold()).toEqual({ members: [member], expenses: [sharedExpense] })
    expect(await readSettings()).toEqual({ monthlyBudgetCents: 150_000 })
  })

  it('merges imported records by ID while preserving existing records', async () => {
    await saveMember(member)
    await saveExpense(sharedExpense)
    await mergeHousehold(
      createBackup([{ ...member, name: 'Alex Rivera' }], [{ ...sharedExpense, id: 'utilities', title: 'Utilities' }], { monthlyBudgetCents: 80_000 }),
    )

    const result = await readHousehold()
    expect(result.members).toEqual([{ ...member, name: 'Alex Rivera' }])
    expect(result.expenses.map((expense) => expense.id).sort()).toEqual(['rent', 'utilities'])
    expect(await readSettings()).toEqual({ monthlyBudgetCents: 80_000 })
  })
})
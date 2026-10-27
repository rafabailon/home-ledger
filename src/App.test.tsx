import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { database } from './database'

describe('household finance workflow', () => {
  beforeEach(async () => {
    await database.transaction('rw', database.members, database.expenses, database.settings, async () => {
      await database.members.clear()
      await database.expenses.clear()
      await database.settings.clear()
    })
  })

  afterEach(() => cleanup())

  it('creates a member and records a shared expense in the local ledger', async () => {
    const user = userEvent.setup()
    render(<App />)

    await screen.findByRole('heading', { name: /set up your household/i })
    await user.click(screen.getByRole('button', { name: 'Household' }))
    await user.click(await screen.findByRole('button', { name: /add first member/i }))

    await user.type(screen.getByLabelText('Member name'), 'Alex')
    await user.type(screen.getByLabelText(/monthly take-home income/i), '5000')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add member' }))
    expect(await screen.findByRole('heading', { name: 'Alex' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /add expense/i }))
    await user.type(screen.getByLabelText('Description'), 'Weekly groceries')
    await user.type(screen.getByLabelText(/amount/i), '125.49')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add expense' }))

    await user.click(screen.getByRole('button', { name: /transactions/i }))
    const row = await screen.findByRole('row', { name: /weekly groceries/i })
    expect(within(row).getByText('$125.49')).toBeInTheDocument()
    expect(within(row).getByText('Shared')).toBeInTheDocument()
    await waitFor(async () => expect(await database.expenses.count()).toBe(1))
  })

  it('keeps personal expenses assigned to a selected household member', async () => {
    const user = userEvent.setup()
    render(<App />)
    await screen.findByRole('heading', { name: /set up your household/i })
    await user.click(screen.getByRole('button', { name: 'Household' }))
    await user.click(await screen.findByRole('button', { name: /add first member/i }))
    await user.type(screen.getByLabelText('Member name'), 'Sam')
    await user.type(screen.getByLabelText(/monthly take-home income/i), '4000')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add member' }))
    await screen.findByRole('heading', { name: 'Sam' })

    await user.click(screen.getByRole('button', { name: /add expense/i }))
    await user.click(screen.getByRole('button', { name: /personal/i }))
    await user.type(screen.getByLabelText('Description'), 'Book')
    await user.type(screen.getByLabelText(/amount/i), '20')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add expense' }))

    const savedExpense = await database.expenses.toArray()
    expect(savedExpense).toHaveLength(1)
    expect(savedExpense[0]).toMatchObject({ type: 'personal', memberId: expect.any(String), amountCents: 2_000 })
  })
})
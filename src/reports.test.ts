import { describe, expect, it, vi } from 'vitest'
import { createExpensesCsv, createPdfReport, downloadFile } from './reports'
import { summarizeMembers } from './finance'
import type { Expense, Member } from './types'

const members: Member[] = [{ id: 'alex', name: 'Alex', monthlyIncomeCents: 300_000, color: '#347b62', createdAt: '2025-01-01' }]
const expenses: Expense[] = [{ id: 'rent', title: '=SUM(A1:A2)', amountCents: 100_000, category: 'Housing', type: 'shared', memberId: null, date: '2025-04-01', createdAt: '2025-04-01' }]

describe('report exports', () => {
  it('quotes CSV fields and neutralizes spreadsheet formulas', () => {
    const csv = createExpensesCsv(expenses, members)
    expect(csv).toContain('"Date","Description"')
    expect(csv).toContain("'=SUM(A1:A2)")
    expect(csv).toContain('"Household"')
  })

  it('creates a printable PDF blob', async () => {
    const report = await createPdfReport('2025-04', expenses, summarizeMembers(members, expenses))
    expect(report.type).toBe('application/pdf')
    expect(report.size).toBeGreaterThan(500)
  })

  it('downloads an export with a generated object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:report'), revokeObjectURL: vi.fn() })

    downloadFile('data', 'report.csv', 'text/csv')

    expect(click).toHaveBeenCalledOnce()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:report')
    vi.unstubAllGlobals()
    click.mockRestore()
  })
})
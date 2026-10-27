import { formatCurrency } from './format'
import type { Expense, Member, MemberSummary } from './types'

function csvCell(value: string | number): string {
  const text = String(value)
  const protectedText = /^[\s]*[=+@-]/.test(text) ? `'${text}` : text
  return `"${protectedText.replace(/"/g, '""')}"`
}

export function createExpensesCsv(expenses: Expense[], members: Member[]): string {
  const memberNames = new Map(members.map((member) => [member.id, member.name]))
  const rows = [
    ['Date', 'Description', 'Category', 'Type', 'Member', 'Amount'],
    ...expenses.map((expense) => [
      expense.date,
      expense.title,
      expense.category,
      expense.type,
      expense.memberId ? memberNames.get(expense.memberId) ?? 'Unknown' : 'Household',
      formatCurrency(expense.amountCents),
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}

export function createExpensesCsvRaw(expenses: Expense[], members: Member[]): string {
  const memberNames = new Map(members.map((member) => [member.id, member.name]))
  const rows = [
    ['Date', 'Description', 'Category', 'Type', 'Member', 'AmountCents'],
    ...expenses.map((expense) => [
      expense.date,
      expense.title,
      expense.category,
      expense.type,
      expense.memberId ? memberNames.get(expense.memberId) ?? 'Unknown' : 'Household',
      String(expense.amountCents),
    ]),
  ]
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`
}

export function downloadFile(content: string | Blob, filename: string, type = 'text/plain'): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export async function createPdfReport(
  periodLabel: string,
  expenses: Expense[],
  summaries: MemberSummary[],
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const margin = 48
  let cursorY = 54

  document.setTextColor(35, 65, 50)
  document.setFont('helvetica', 'bold')
  document.setFontSize(23)
  document.text('Home Ledger', margin, cursorY)
  cursorY += 26
  document.setTextColor(80, 90, 82)
  document.setFont('helvetica', 'normal')
  document.setFontSize(12)
  document.text(`Household report · ${periodLabel}`, margin, cursorY)
  cursorY += 34

  document.setFont('helvetica', 'bold')
  document.text('Member summary', margin, cursorY)
  cursorY += 20
  document.setFont('helvetica', 'normal')
  document.setFontSize(10)
  summaries.forEach(({ member, totalSpentCents, remainingCents, weight }) => {
    document.text(member.name, margin, cursorY)
    document.text(`${Math.round(weight * 100)}% share`, margin + 180, cursorY)
    document.text(formatCurrency(totalSpentCents), margin + 290, cursorY)
    document.text(`${formatCurrency(remainingCents)} left`, pageWidth - margin, cursorY, { align: 'right' })
    cursorY += 17
  })

  cursorY += 17
  document.setFont('helvetica', 'bold')
  document.text('Spending contribution', margin, cursorY)
  cursorY += 14
  const highestSpend = Math.max(1, ...summaries.map((summary) => summary.totalSpentCents))
  summaries.forEach(({ member, totalSpentCents }) => {
    if (cursorY > 720) {
      document.addPage()
      cursorY = 54
    }
    const barWidth = (totalSpentCents / highestSpend) * (pageWidth - margin * 2 - 180)
    document.setFont('helvetica', 'normal')
    document.text(member.name.slice(0, 20), margin, cursorY + 8)
    document.setFillColor(52, 123, 98)
    document.roundedRect(margin + 120, cursorY, Math.max(2, barWidth), 11, 3, 3, 'F')
    document.setTextColor(80, 90, 82)
    document.text(formatCurrency(totalSpentCents), pageWidth - margin, cursorY + 8, { align: 'right' })
    cursorY += 19
  })

  cursorY += 18
  document.setFont('helvetica', 'bold')
  document.text('Expenses', margin, cursorY)
  cursorY += 18
  document.setFont('helvetica', 'normal')
  expenses.forEach((expense) => {
    if (cursorY > 760) {
      document.addPage()
      cursorY = 54
    }
    document.text(expense.date, margin, cursorY)
    document.text(expense.title.slice(0, 42), margin + 76, cursorY)
    document.text(expense.category, margin + 315, cursorY)
    document.text(formatCurrency(expense.amountCents), pageWidth - margin, cursorY, { align: 'right' })
    cursorY += 16
  })

  return document.output('blob')
}
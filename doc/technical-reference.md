# Technical Reference

## Network/API Surface

Home Ledger exposes **no application HTTP API**. The production Nginx container serves static assets only. Household data is read and written by the browser through Dexie/IndexedDB; browser requests to `/api/*` are not part of this application.

## Type Contracts

### Categories and Types

```ts
type Category =
  | 'Groceries'
  | 'Housing'
  | 'Utilities'
  | 'Transport'
  | 'Health'
  | 'Leisure'
  | 'Savings'
  | 'Other'

type ExpenseType = 'shared' | 'personal'
```

### Member

```ts
interface Member {
  id: string
  name: string
  monthlyIncomeCents: number
  color: string
  createdAt: string
}
```

### Expense

```ts
interface Expense {
  id: string
  title: string
  amountCents: number
  category: Category
  type: ExpenseType
  memberId: string | null
  date: string
  createdAt: string
}
```

A `shared` expense has `memberId: null`. A `personal` expense has a member ID that exists in the backup/current household. `amountCents` is a positive safe integer; member incomes are non-negative safe integers in stored/backup data. UI entry requires positive amounts and up to two decimal places.

### Backup Envelope

```ts
interface HouseholdBackup {
  format: 'commonplace-backup'
  version: 1
  exportedAt: string
  members: Member[]
  expenses: Expense[]
}
```

Example:

```json
{
  "format": "commonplace-backup",
  "version": 1,
  "exportedAt": "2026-10-03T12:00:00.000Z",
  "members": [],
  "expenses": []
}
```

The parser enforces a 10 MiB byte limit, valid JSON, supported envelope/version, arrays, unique non-empty IDs, supported categories/types, required fields, real `YYYY-MM-DD` calendar dates, and valid personal member references. Shared expenses must have a null owner. It returns a validated version-1 envelope before persistence starts.

## Persistence Module

Database name: `commonplace-household`. Dexie schema version 1:

```ts
members: 'id, name'
expenses: 'id, date, type, category, memberId'
```

Important functions in `src/domain/database.ts`:

| Function | Contract |
| --- | --- |
| `readHousehold()` | Returns members and expenses sorted newest date first |
| `saveMember(member)` | Inserts or replaces one member by ID |
| `removeMember(id)` | Transactionally deletes the member and owned personal expenses |
| `saveExpense(expense)` | Inserts or replaces one expense by ID |
| `removeExpense(id)` | Deletes one expense by ID |
| `replaceHousehold(backup)` | Clears both stores and writes the validated backup in one transaction |
| `mergeHousehold(backup)` | Upserts validated records by ID in one transaction |

The UI validates backups using `parseBackup` before calling either restore operation. `mergeBackup(current, imported)` applies imported records after current records in ID maps, so matching imported IDs replace current values; unmatched current records are retained.

## Finance Module

- `calculateSharedShares(totalCents, members)` returns a `Map<memberId, shareCents>`. It ignores invalid totals/empty households, uses income weights or equal shares when total income is zero, floors exact shares, and distributes leftover cents by largest remainder then original member order.
- `summarizeMembers(members, expenses)` returns each member's weight, shared share, personal amount, total spent, and remaining income. Current incomes are used for every shared item in the supplied period.
- `filterExpensesByMonth(expenses, month)` accepts a `YYYY-MM` key.
- `filterExpensesByRange(expenses, startDate, endDate, category)` uses inclusive lexical ISO-date bounds; empty date bounds are unbounded and the category may be `'All categories'`.
- `isValidCalendarDate(value)` rejects malformed and impossible calendar dates.
- `getRecentMonths(count, now)` returns ordered month keys; `getMonthlyTrend(expenses, months)` aggregates shared/personal cents per month.

## Formatting and Input

`formatCurrency(cents, currency = 'USD', locale = 'en-US')` formats cents with `Intl.NumberFormat`. `parseCurrencyInput(value)` returns positive safe integer cents or `null`; it accepts no more than two decimal places. `formatMonth` and `formatShortDate` render month/date labels for the UI.

## Export Formats

### CSV

`createExpensesCsv(expenses, members)` creates a UTF-8 CSV with BOM and CRLF rows. Columns are `Date`, `Description`, `Category`, `Type`, `Member`, and `Amount`. Cells are quoted and embedded quotes doubled. Text beginning with optional whitespace and `=`, `+`, `@`, or `-` is prefixed with an apostrophe to reduce spreadsheet formula execution risk. Shared rows use `Household` for the member value.

### PDF

`createPdfReport(periodLabel, expenses, summaries)` dynamically imports jsPDF and returns an `application/pdf` Blob. The report contains the selected period, member summary, contribution bars, and expense rows. The download helper creates a temporary object URL and clicks a download anchor.

## Tests and Source Map

```text
src/App.test.tsx                 UI member/expense workflows
src/domain/finance.test.ts       allocations, summaries, date filters
src/domain/database.test.ts      IndexedDB transactions and merge/replace
src/domain/backup.test.ts        backup validation and merge semantics
src/domain/reports.test.ts       CSV safety and PDF generation
src/domain/format.test.ts        currency/date formatting
```

Run the complete suite with `make test`; the Docker test service enforces domain coverage thresholds. `make lint` and `make build` run ESLint and strict TypeScript/Vite production compilation.
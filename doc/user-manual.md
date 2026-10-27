# User Manual

## First Use

Open Home Ledger and choose **Set up household** or **Household**. Add each person with a name and monthly take-home income. Income determines each person's percentage of common expenses. The application saves changes to this browser's local IndexedDB database as you go; there is no sign-in or cloud account.

## Household Members

In **Household**, add a member, edit a member's name/income, or remove a member. The cards show monthly income, current common-expense percentage, and spending for the selected month.

Removing a member asks for confirmation. Their personal expenses are removed with them; shared expenses remain in the household ledger. Changing income recalculates that person's share for the current report period using the updated household weights.

## Record an Expense

1. Select **Add expense** from the top bar or a page action.
2. Choose **Shared** or **Personal**.
3. Enter a description, positive amount, calendar date, and category.
4. For a personal expense, choose the member it belongs to. Shared expenses have no individual owner.
5. Save the expense. A shared purchase is split automatically; a personal one is charged only to its selected member.

Categories are Groceries, Housing, Utilities, Transport, Health, Leisure, Savings, and Other. Amounts accept up to two decimal places and are stored as integer cents. Expenses can be edited from **Transactions**. Deleting one asks for confirmation.

## Overview

Use the month picker and previous/next arrows in the top bar to choose a period. The Overview shows total household spending, shared and personal totals, a six-month trend, category distribution, recent expenses, member contributions, and remaining income. The charts and member balances update for the selected month.

Shared-cost percentages use current household incomes. If all incomes are zero in imported data, shared costs are split equally. Rounding is deterministic and preserves every cent.

## Transactions

**Transactions** lists expenses for the selected month. Search by description and filter by category or type. Select the edit action to change an expense. The delete action requires confirmation. The list distinguishes personal expenses (with their member) from household-wide shared items.

## Reports and Backup

1. Open **Reports & backup**.
2. Choose inclusive **From** and **To** dates. The range defaults to the selected month and may span months.
3. Choose a category or **All categories**.
4. Download **CSV** for spreadsheet analysis or **PDF** for a printable summary. Both exports use the same date/category filters. The PDF includes member totals, a contribution bar chart, and itemized expenses.

The **Your local data** section exports a JSON backup containing all members and expenses, independent of the report filters. Keep the file outside the browser/device if it is your only backup.

To restore, choose **Restore backup** and select a supported Home Ledger JSON file. Select **replace existing data** to replace both stores, or **merge with existing data** to keep local records and add/update imported records by ID. Replacing requires confirmation. Files over 10 MiB or invalid records are rejected before data is changed. A successful restore is written transactionally.

## Privacy and Important Limits

- Data belongs to this browser profile and origin; it is not sent to a Home Ledger server.
- The development and production URLs have separate data stores. Export/import a backup when switching between them.
- Anyone using the same browser profile and origin can access its ledger. The app does not provide login or local encryption.
- Clearing site data, deleting the browser profile, or losing the device may erase the ledger. Export backups regularly.
- Backups are JSON, not encrypted. Store them somewhere private.

## Troubleshooting

- **A household looks empty:** check the browser profile and URL/port; another origin has a separate database.
- **A personal expense cannot be saved:** add a household member and select its owner.
- **A report is empty:** check the date range and selected category.
- **An imported file is rejected:** export a fresh backup from Home Ledger. Only version 1 (`commonplace-backup`) is supported.
- **Browser storage is unavailable:** enable site storage for the origin and retry. Existing data is not modified when a write fails.
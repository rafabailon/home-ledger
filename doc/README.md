# Home Ledger documentation

This directory contains the project documentation for Home Ledger, a local-first household finance tracker. The application keeps the data in the browser using IndexedDB and avoids a backend by design.

## Start here

- [Main project README](../README.md): quick overview, app purpose, and setup commands
- [Architecture](architecture.md): browser boundary, data model, calculations, reports, and privacy assumptions
- [Installation and operations](installation-guide.md): Docker, Make targets, environment setup, and troubleshooting
- [User manual](user-manual.md): day-to-day usage, member management, transactions, and reporting flows
- [Technical reference](technical-reference.md): implementation details, storage schema, backup logic, and export behavior

## What the app does

Home Ledger helps a household:

- manage members and monthly net income
- record personal and shared expenses
- split shared costs according to income-weighted contribution
- review balances, trends, filters, and category summaries
- export PDFs and CSV reports
- keep a versioned JSON backup of the household ledger

## Design principles

- privacy first: data remains local to the browser and origin
- deterministic calculations: cent allocation is stable and reproducible
- no network dependency: there is no application server or remote API
- clear reporting: summaries and exports keep household decisions transparent

## Operating model

The project is designed for local development through Docker. Host-side Node.js is not required for the standard workflow. The Makefile wraps the most common development, test, lint, and build commands.

## Quick links

```text
README.md                Main GitHub landing page
architecture.md          Architecture and privacy model
installation-guide.md    Setup and container lifecycle
user-manual.md           User workflows and reporting
technical-reference.md   Technical implementation reference
```

For detailed operational guidance, read the guide that matches your goal and use the repository root README as the entry point for setup commands.

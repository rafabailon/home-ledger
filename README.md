# Home Ledger

A local-first household finance tracker designed for shared budgets, member balances, and transparent monthly reporting.

Home Ledger runs entirely in the browser with IndexedDB, so your household data stays on the device you use. There is no server-side database, no account system, and no remote sync layer.

## Why this project?

This app helps households manage:

- monthly member income and personal expenses
- shared purchases split by income-weighted contribution
- balances and spending trends across a billing period
- printable reports, CSV exports, and versioned backups

It is built for privacy and simplicity: the ledger lives in the browser profile, and the application can be used offline once installed.

## Highlights

- Local-first architecture with IndexedDB persistence
- Shared expense allocation based on monthly income weights
- Personal expenses tracked against a single member
- Search, filters, summaries, and itemized ledger views
- CSV export and printable PDF reports
- Versioned JSON backups with restore validation
- Docker-based development, testing, and production workflows

## Tech stack

- React + TypeScript + Vite
- Dexie for IndexedDB access
- Recharts for reporting charts
- jsPDF for printable reports
- Docker and Make for local workflows

## Quick start

From the project root, run:

```sh
make help
make up
```

Then open:

- <http://localhost:5173> for the development app

All application commands run inside Docker, so you do not need a host-side Node.js/npm setup for normal development.

## Documentation

The full documentation set is indexed in [doc/README.md](doc/README.md).

- [Architecture](doc/architecture.md)
- [Installation and operations](doc/installation-guide.md)
- [User manual](doc/user-manual.md)
- [Technical reference](doc/technical-reference.md)

## Project structure

```text
.
├── src/
│   ├── App.tsx
│   ├── App.test.tsx
│   ├── main.tsx
│   ├── styles.css
│   └── domain/
│       ├── backup.ts
│       ├── database.ts
│       ├── finance.ts
│       ├── format.ts
│       ├── reports.ts
│       └── *.test.ts
├── doc/
│   ├── README.md
│   ├── architecture.md
│   ├── installation-guide.md
│   ├── user-manual.md
│   └── technical-reference.md
├── compose.yaml
├── compose.prod.yaml
├── Dockerfile
├── Makefile
├── package.json
├── vite.config.ts
├── index.html
├── nginx.conf
└── README.md
```

## Privacy note

The application stores data in the browser under a local IndexedDB database. Data is not synchronized to a server, so the ledger stays with the specific browser profile and device where it was created. Regular exports are strongly recommended before resetting data or switching devices.

## Common tasks

```sh
make dev
make test
make lint
make build
make production
```

For more operational details, including Docker commands, quality gates, and troubleshooting, see the documentation in [doc/README.md](doc/README.md).
```
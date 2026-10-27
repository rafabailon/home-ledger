# Installation and Operations

## Host Requirements

- Docker Engine or Docker Desktop with Docker Compose v2.
- GNU Make for the `make` shortcuts.
- Internet access for the first image build.

Do not install Node.js, npm, or application dependencies on the host. The development, test, lint, build, and production runtimes are containerized. Make runs Docker commands on the host; the application itself runs inside containers.

## Start Development

From the project root:

```sh
make help
make up
```

The Vite app is served at <http://localhost:5173>. The source tree is bind-mounted for hot reload and npm dependencies live in the named `home-ledger-dev_app_node_modules` Docker volume. To run Vite in the foreground instead, use `make dev` and press `Ctrl+C` to stop it.

## Tests and Build Checks

```sh
make test
make lint
make build
```

- `make test` runs Vitest with coverage thresholds in Docker.
- `make lint` runs ESLint in Docker.
- `make build` runs the strict TypeScript build and creates optimized Vite assets inside Docker.
- `make test-watch` runs Vitest watch mode inside Docker.

The test suite uses fake IndexedDB; it does not access a household database in your normal browser profile.

## Production Preview

```sh
make production
```

The Makefile defaults to port 8081 and starts the Nginx static image at <http://localhost:8081>. Override the port if needed:

```sh
make PORT=8082 production
```

The production Compose file itself defaults to port 8080 if invoked directly. Nginx serves the built assets and does not store or proxy household information. The container exposes a health check. For an internet-facing deployment, configure HTTPS at a trusted reverse proxy and understand that browser storage is not a server backup.

## Lifecycle Commands

| Command | Effect |
| --- | --- |
| `make stop` | Stop development and production containers without removing them |
| `make down` | Remove both Compose stacks and networks; keep the npm dependency volume |
| `make restart` | Build/start the development app in the background |
| `make logs` | Follow development Vite logs |
| `make production-logs` | Follow Nginx logs |
| `make production-stop` | Remove the production container and network |
| `make status` | Show both named Compose projects |
| `make clean` | Remove `node_modules`, `dist`, `coverage`, `.vite`, both stacks, and the development dependency volume |

`make clean` runs its file cleanup through a temporary Docker container. It does not clear browser IndexedDB. It removes the development npm volume, so the next start recreates dependencies from the image. It does not delete Docker images or perform a global Docker prune.

Development and production use separate Compose project names (`commonplace-dev` and `commonplace-prod`), so both can run at once without Compose treating the other stack as an orphan.

## Data Continuity

IndexedDB is keyed by browser origin. The development app at port 5173 and production app at port 8081 do not share a ledger. Export a JSON backup under **Reports & backup** before switching URLs or devices, then restore it in the destination origin. Browser profile removal or clearing site data can erase the only copy of the data.

## Troubleshooting

- **Port already allocated:** run production with `make PORT=8082 production`, or choose another unused port.
- **Container is stopped:** use `make up` and/or `make production`; `make status` shows both stacks.
- **Dependency volume removed:** the next development/test run recreates it from the Docker image using the lockfile.
- **Blank/old production assets:** rebuild with `make production`; the Nginx entry point is non-cached while hashed assets are immutable.
- **Cannot access existing records:** confirm the browser profile and exact origin. Development and production stores are separate.
- **Data loss risk:** restore a previously exported JSON backup; Docker cleanup cannot recover deleted browser data.

See [Architecture](architecture.md) for persistence boundaries and calculations.
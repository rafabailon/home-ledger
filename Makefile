.DEFAULT_GOAL := help

COMPOSE ?= docker compose
PORT ?= 8081

.PHONY: help dev up stop down restart logs test test-watch lint build production production-logs production-stop status clean

help:
	@printf '%s\n' \
	  'Home Ledger Docker commands:' \
	  '  make dev              Run the development server in the foreground' \
	  '  make up               Start the development server in the background' \
	  '  make stop             Stop both stacks without removing containers' \
	  '  make down             Remove both stacks but preserve dependencies' \
	  '  make restart          Build and start the development server' \
	  '  make logs             Follow development server logs' \
	  '  make test             Run tests and coverage in Docker' \
	  '  make test-watch       Run Vitest in watch mode in Docker' \
	  '  make lint             Run ESLint in Docker' \
	  '  make build            Run TypeScript and production build in Docker' \
	  '  make production       Build and start the Nginx image (PORT=8081)' \
	  '  make production-stop  Stop and remove the production stack' \
	  '  make status           Show both Compose stacks' \
	  '  make clean            Stop stacks and remove generated/dependency files'

dev:
	$(COMPOSE) up --build app

up:
	$(COMPOSE) up --build -d app

stop:
	$(COMPOSE) stop app
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml stop web

down:
	$(COMPOSE) down --remove-orphans
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml down --remove-orphans

restart:
	$(COMPOSE) up --build -d app

logs:
	$(COMPOSE) logs --follow app

test:
	$(COMPOSE) run --build --rm test

test-watch:
	$(COMPOSE) run --rm test npm run test:watch

lint:
	$(COMPOSE) run --build --rm lint

build:
	$(COMPOSE) run --build --rm test npm run build

production:
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml up --build -d

production-logs:
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml logs --follow web

production-stop:
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml down --remove-orphans

status:
	$(COMPOSE) ps
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml ps

clean:
	docker run --rm --volume "$(CURDIR):/workspace" --workdir /workspace node:22-alpine sh -c 'rm -rf node_modules dist coverage .vite'
	$(COMPOSE) down --remove-orphans --volumes
	PORT=$(PORT) $(COMPOSE) -f compose.prod.yaml down --remove-orphans --volumes

purge:
	docker rm -f $(docker ps -a -q) 
	docker system prune -a --volumes 

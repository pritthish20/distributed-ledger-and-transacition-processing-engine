# Distributed Ledger and Transaction Processing Engine

A modular-monolith NestJS backend that models the core of a financial transaction engine: concurrency-safe money movement, double-entry ledger accounting, idempotent write APIs, durable post-commit event processing, and audit-oriented reconciliation.

## Why This Project

This project is meant to demonstrate backend engineering beyond CRUD:

- ACID-safe transaction handling with PostgreSQL
- row-level locking to prevent double spending and overdraw
- double-entry ledger design for accounting correctness
- idempotency protection for retry-safe write APIs
- transactional outbox for reliable post-commit events
- BullMQ and Redis for async webhook delivery and retries
- reconciliation jobs for auditability and anomaly detection
- structured logs and operational read APIs for inspection

## Architecture

```text
Client
  -> NestJS API
  -> Transactions / Accounts / Ledger / Idempotency modules
  -> PostgreSQL (source of truth)
  -> Outbox events persisted in the same DB transaction
  -> BullMQ jobs backed by Redis
  -> Webhook delivery + reconciliation workers
```

## Core Domain Model

- `accounts`: current balance snapshot for fast reads
- `transactions`: business-level money movement record
- `ledger_entries`: accounting truth through balanced debit/credit entries
- `idempotency_records`: duplicate retry protection for write APIs
- `outbox_events`: durable post-commit event queue stored in PostgreSQL
- `webhook_subscriptions`: downstream endpoints that want transaction notifications
- `webhook_deliveries`: delivery attempts, retries, and terminal status
- `reconciliation_runs`: audit job history
- `reconciliation_issues`: mismatches found during reconciliation

## V1 Capabilities

### Financial core

- create accounts
- fetch balances and statements
- deposit, withdraw, and transfer funds
- reject insufficient funds and invalid currency flows
- keep all balance mutations and ledger writes atomic

### Reliability layer

- require `Idempotency-Key` on write APIs
- replay the original logical result for safe retries
- write outbox events in the same DB transaction as committed money movement
- deliver transaction-completed webhooks asynchronously
- retry webhook delivery with backoff and terminal failure handling
- recover stale outbox rows after interrupted processing

### Operational visibility

- `GET /api/health`
- `GET /api/ops/outbox/events`
- `GET /api/ops/webhook-deliveries`
- `GET /api/ops/reconciliation/runs`
- `GET /api/ops/reconciliation/runs/:runId/issues`

## Tech Stack

- NestJS + TypeScript
- PostgreSQL + TypeORM
- Redis + BullMQ
- Docker Compose for local infrastructure
- Jest for unit and integration testing
- Swagger for API exploration

## Correctness Rules

- amounts are stored in minor units only
- no negative balances
- no balance mutation without matching ledger entries
- transfers lock both accounts before mutation
- retries must not duplicate money movement
- outbox rows are committed with business data, not after it

## Local Run

1. Copy environment defaults.
2. Start Postgres and Redis.
3. Run migrations.
4. Start the API.

```powershell
Copy-Item .env.example .env

docker compose up -d
cmd /c npm run migration:run
cmd /c npm run start:dev
```

Local endpoints:

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Tests

```powershell
cmd /c npm test -- --runInBand
cmd /c npm run test:int
cmd /c npm run build
```

Integration tests expect local Docker-backed Postgres and Redis.

## Demo Flow

For a complete Postman or curl verification flow, use [docs/ACCEPTANCE_FLOW.md](docs/ACCEPTANCE_FLOW.md).

## Documentation Map

Use the root README as the public project overview. Keep the rest as supporting design notes and implementation history.

- [docs/PHASES.md](docs/PHASES.md): milestone-by-milestone build history and what each phase added
- [docs/PROJECT_SCOPE.md](docs/PROJECT_SCOPE.md): deeper scope, module boundaries, and data model notes
- [docs/ACCEPTANCE_FLOW.md](docs/ACCEPTANCE_FLOW.md): manual end-to-end verification steps
- [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md): original structural planning notes

## Resume-Friendly Summary

Architected a distributed-ledger-style transaction engine in NestJS using PostgreSQL, Redis, and BullMQ, implementing ACID-safe money movement, concurrency-safe balance updates, double-entry ledger accounting, idempotent APIs, transactional outbox processing, webhook retries, and reconciliation workflows.

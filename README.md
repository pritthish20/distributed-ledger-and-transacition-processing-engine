# Distributed Ledger and Transaction Processing Engine

NestJS backend for a transaction engine with PostgreSQL as the source of truth and Redis as the queue backbone for BullMQ jobs.

## Local infrastructure

This project uses Docker Compose to run the infrastructure services locally:

- PostgreSQL for transactional ledger storage
- Redis for BullMQ queues and Redis-backed workflows

BullMQ itself is a Node library, so there is no separate BullMQ container.

## Database mental model

- `accounts` = current balance snapshot
- `transactions` = business operation
- `ledger_entries` = accounting truth
- `idempotency_records` = duplicate retry protection
- `outbox_events` = durable event queue in DB
- `webhook_subscriptions` = who wants event notifications
- `webhook_deliveries` = delivery attempts
- `reconciliation_runs` = audit job history
- `reconciliation_issues` = audit mismatches

## Environment

Copy local defaults from `.env.example` into `.env` if you want to run against local Docker services:

```bash
cp .env.example .env
```

Local defaults:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ledger_engine
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
QUEUE_PREFIX=ledger-engine
```

Your current `.env` can still point to a hosted Postgres instance if you want. Only switch it to the local connection string when you want Docker-backed local infra.

## Phase 2 reliability flow

Successful money movement writes business data, ledger entries, and an `outbox_events` row in the same PostgreSQL transaction. A background job poller reads processable outbox rows, marks them `processing`, and dispatches matching webhook deliveries through BullMQ.

Webhook delivery jobs persist attempt state in `webhook_deliveries`, sign outgoing payloads, retry with exponential backoff, and eventually mark the outbox event `published` or `failed`. Stale `processing` outbox rows are recovered by the poller so a crash after `processing` does not permanently strand an event.

Reconciliation also runs in the background. It compares account balance snapshots against ledger-derived balances and records anomalies in `reconciliation_runs` and `reconciliation_issues`.

Useful worker knobs:

```env
OUTBOX_POLL_INTERVAL_MS=5000
OUTBOX_BATCH_SIZE=20
OUTBOX_BACKOFF_MS=5000
OUTBOX_MAX_ATTEMPTS=5
OUTBOX_STALE_AFTER_MS=30000
RECONCILIATION_INTERVAL_MS=60000
WEBHOOK_MAX_ATTEMPTS=5
WEBHOOK_BACKOFF_MS=5000
```

## Start local infrastructure

```bash
docker compose up -d
```

To stop it:

```bash
docker compose down
```

To stop it and remove persisted volumes:

```bash
docker compose down -v
```

## Run the Nest app

Install dependencies:

```bash
npm install
```

Start in watch mode:

```bash
npm run start:dev
```

Start in debug mode:

```bash
npm run start:debug
```

## Services

- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/docs`

## Verification

Useful checks after `docker compose up -d`:

```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
```

## Tests

```bash
npm run test
npm run test:e2e
```

Integration tests require local Postgres and Redis:

```bash
docker compose up -d
npm run test:int
```

The integration harness uses `ledger_engine_test` and rebuilds its `public` schema before running migrations.

Manual end-to-end demo flow:

```text
docs/ACCEPTANCE_FLOW.md
```

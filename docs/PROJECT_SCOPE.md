# Distributed Ledger and Transaction Processing Engine

## Purpose

This project is a backend transaction engine built to demonstrate financial correctness under concurrency, retries, and partial failures.

The system focuses on:

- ACID-compliant transaction handling
- concurrency-safe money movement
- double-entry ledger integrity
- idempotent write APIs
- reliable post-transaction event delivery
- reconciliation and auditability

This is not a full consumer product in v1. It is an account-centric financial engine with a deliberately limited API surface.

## V1 Scope

Version 1 will prioritize correctness of transaction processing over broad product features.

Included in scope:

- account creation
- balance retrieval
- account statement retrieval
- deposits
- withdrawals
- transfers
- transaction status lookup
- webhook registration
- health checks

Explicitly out of scope for v1:

- users module
- JWT authentication
- authorization guards
- admin dashboard
- multi-currency conversion
- external payment gateway integration
- distributed microservice decomposition
- advanced rate limiting
- webhook delivery management APIs
- reconciliation admin APIs

## Architecture Direction

The system will be implemented first as a modular monolith in NestJS.

Reasoning:

- financial correctness is easier to guarantee inside a single database transaction boundary
- the project objective is reliability and consistency, not service sprawl
- modular separation inside one codebase is enough for clear design and interview value

Core patterns:

- PostgreSQL as source of truth
- row-level locking for concurrent balance updates
- double-entry ledger for all money movement
- idempotency keys for write requests
- transactional outbox for reliable event publication
- asynchronous workers for webhook delivery and reconciliation

## Planned Modules

### `config`

Application configuration, environment validation, database and Redis setup.

### `database`

Database connection, ORM integration, migrations, and transaction helpers.

### `accounts`

Owns account creation, balance retrieval, and statement queries.

### `transactions`

Owns deposit, withdrawal, and transfer orchestration.

This is the core financial module and must execute all money movement inside database transactions.

### `ledger`

Owns creation and retrieval of double-entry ledger records.

No balance mutation should happen without matching ledger entries.

### `idempotency`

Prevents duplicate processing of retried write requests and supports safe response replay.

### `outbox`

Stores post-commit domain events to guarantee reliable asynchronous processing after successful database commits.

### `webhooks`

Handles webhook registration and downstream delivery orchestration.

### `jobs`

Owns background workers for:

- outbox processing
- webhook retries
- reconciliation scheduling

Phase 2 reliability expectations:

- outbox polling is configurable
- stale `processing` outbox rows are recovered
- dispatch failures are retried per event without blocking the full batch
- webhook delivery creation is idempotent per subscription/outbox event
- duplicate queue jobs must not redeliver terminal webhook deliveries

### `reconciliation`

Runs background consistency checks between balances and ledger-derived totals and flags anomalies.

### `health`

Provides readiness and liveness endpoints.

### `ops`

Provides read-only operational visibility for local debugging and demos.

V1 ops endpoints are internal/demo-only and intentionally unauthenticated because auth is out of scope.

Included read APIs:

- list outbox events
- list webhook deliveries
- list reconciliation runs
- list reconciliation issues for a run

## Database Scope

PostgreSQL will be the source of truth.

Balances will be stored on accounts for fast reads, but every balance update must happen in the same transaction as ledger entry creation.

Quick mental model:

- `accounts` = current balance snapshot
- `transactions` = business operation
- `ledger_entries` = accounting truth
- `idempotency_records` = duplicate retry protection
- `outbox_events` = durable event queue in DB
- `webhook_subscriptions` = who wants event notifications
- `webhook_deliveries` = delivery attempts
- `reconciliation_runs` = audit job history
- `reconciliation_issues` = audit mismatches

### `accounts`

Stores account state and current balance snapshot.

Suggested fields:

- `id`
- `currency`
- `balance`
- `status`
- `created_at`
- `updated_at`

### `transactions`

Stores business-level transaction records.

Suggested fields:

- `id`
- `idempotency_key`
- `type`
- `status`
- `amount`
- `currency`
- `from_account_id`
- `to_account_id`
- `description`
- `request_hash`
- `error_code`
- `created_at`
- `completed_at`

### `ledger_entries`

Stores double-entry journal lines for each transaction.

Suggested fields:

- `id`
- `transaction_id`
- `account_id`
- `entry_type`
- `amount`
- `currency`
- `created_at`

Invariant:

- total debits must equal total credits per transaction

### `idempotency_records`

Stores request identity and replayable results for safe retries.

Suggested fields:

- `id`
- `idempotency_key`
- `endpoint`
- `request_hash`
- `status`
- `transaction_id`
- `response_code`
- `response_body`
- `created_at`
- `updated_at`

### `outbox_events`

Stores events created in the same transaction as successful money movement.

Suggested fields:

- `id`
- `aggregate_type`
- `aggregate_id`
- `event_type`
- `payload`
- `status`
- `retry_count`
- `next_retry_at`
- `published_at`
- `created_at`

### `webhook_subscriptions`

Stores downstream webhook registrations.

Suggested fields:

- `id`
- `target_url`
- `secret`
- `event_type`
- `status`
- `created_at`

### `webhook_deliveries`

Stores webhook delivery attempts and retry state.

Suggested fields:

- `id`
- `webhook_subscription_id`
- `outbox_event_id`
- `status`
- `attempt_count`
- `last_attempt_at`
- `next_retry_at`
- `response_status`
- `response_body`
- `created_at`
- `updated_at`

### `reconciliation_runs`

Stores execution history of integrity verification jobs.

### `reconciliation_issues`

Stores anomalies detected during reconciliation.

## V1 API List

The first release is intentionally limited to 9 APIs.

### Accounts

- `POST /accounts`
- `GET /accounts/:accountId/balance`
- `GET /accounts/:accountId/statement`

### Transactions

- `POST /transactions/deposit`
- `POST /transactions/withdraw`
- `POST /transactions/transfer`
- `GET /transactions/:transactionId`

### Webhooks

- `POST /webhooks`

### Operations

- `GET /health`

## API Rules

All write APIs must support idempotent behavior.

Required expectations for write endpoints:

- accept an `Idempotency-Key` header
- validate request payloads
- accept amounts in minor units
- reject invalid currency or account states
- prevent negative balances
- return the original logical result for safe retries

## Core Financial Rules

- no negative account balance
- every successful monetary transaction must create balanced ledger entries
- all balance updates and ledger writes must be atomic
- transfers must lock affected account rows to avoid race conditions
- idempotency keys must prevent duplicate logical processing
- outbox events must be written in the same database transaction as the committed business transaction

## Non-Functional Goals

- ACID compliance
- concurrency safety
- retry-safe API behavior
- reliable asynchronous event delivery
- structured logging
- observability of transaction outcomes
- horizontal scalability of stateless API instances

## Suggested Build Order

1. database and app infrastructure
2. accounts module
3. ledger module
4. transactions module
5. idempotency module
6. outbox module
7. webhooks module
8. jobs and workers
9. reconciliation module
10. concurrency, integration, and failure-path testing

## Planned Improvements After V1

These are valid future extensions, but they should not block the first release.

### Identity and Access

- users module
- JWT authentication
- role-based authorization
- API key protection for internal/admin endpoints

### Operational Controls

- reconciliation trigger and reporting APIs
- webhook delivery history APIs
- dead-letter queue inspection
- rate limiting

### Product and Platform Expansion

- multi-currency support
- account ownership models
- merchant or organization entities
- external payment provider integration
- service decomposition if scale justifies it

### Reliability and Observability

- metrics dashboards
- distributed tracing
- alerting on failed transactions and delivery backlog
- stronger audit event streams

## Scope Discipline

The success criterion for v1 is not feature count.

The success criterion is a working transaction engine that can clearly demonstrate:

- safe concurrent transfers
- correct ledger balancing
- duplicate request protection
- reliable post-commit event handling
- audit and reconciliation readiness



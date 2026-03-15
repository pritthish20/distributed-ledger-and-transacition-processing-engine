# Folder Structure Plan

## Purpose

This document defines the intended NestJS folder structure for v1 of the distributed ledger and transaction processing engine.

The goal is to keep the codebase:

- modular
- easy to grow
- aligned with the agreed scope
- strict about separating financial core logic from infrastructure concerns

This structure is for a modular monolith, not a microservice split.

## High-Level Layout

```text
src/
  main.ts
  app.module.ts
  common/
  config/
  database/
  modules/
    accounts/
    transactions/
    ledger/
    idempotency/
    outbox/
    webhooks/
    reconciliation/
    health/
  jobs/
```

## Recommended Detailed Structure

```text
src/
  main.ts
  app.module.ts

  common/
    constants/
    decorators/
    dto/
    exceptions/
    filters/
    guards/
    interceptors/
    interfaces/
    pipes/
    utils/

  config/
    app.config.ts
    database.config.ts
    redis.config.ts
    queue.config.ts
    env.validation.ts

  database/
    database.module.ts
    database.service.ts
    migrations/
    seeds/
    transactions/

  modules/
    accounts/
      accounts.module.ts
      accounts.controller.ts
      accounts.service.ts
      accounts.repository.ts
      dto/
        create-account.dto.ts
        get-statement.dto.ts
      entities/
        account.entity.ts
      types/
      tests/

    transactions/
      transactions.module.ts
      transactions.controller.ts
      transactions.service.ts
      transactions.repository.ts
      dto/
        deposit.dto.ts
        withdraw.dto.ts
        transfer.dto.ts
        get-transaction.dto.ts
      entities/
        transaction.entity.ts
      enums/
        transaction-status.enum.ts
        transaction-type.enum.ts
      types/
      tests/

    ledger/
      ledger.module.ts
      ledger.service.ts
      ledger.repository.ts
      dto/
      entities/
        ledger-entry.entity.ts
      enums/
        ledger-entry-type.enum.ts
      tests/

    idempotency/
      idempotency.module.ts
      idempotency.service.ts
      idempotency.repository.ts
      dto/
      entities/
        idempotency-record.entity.ts
      interceptors/
        idempotency.interceptor.ts
      tests/

    outbox/
      outbox.module.ts
      outbox.service.ts
      outbox.repository.ts
      dto/
      entities/
        outbox-event.entity.ts
      enums/
        outbox-status.enum.ts
      tests/

    webhooks/
      webhooks.module.ts
      webhooks.controller.ts
      webhooks.service.ts
      webhooks.repository.ts
      dto/
        register-webhook.dto.ts
      entities/
        webhook-subscription.entity.ts
        webhook-delivery.entity.ts
      enums/
        webhook-delivery-status.enum.ts
      tests/

    reconciliation/
      reconciliation.module.ts
      reconciliation.service.ts
      reconciliation.repository.ts
      dto/
      entities/
        reconciliation-run.entity.ts
        reconciliation-issue.entity.ts
      tests/

    health/
      health.module.ts
      health.controller.ts
      health.service.ts

  jobs/
    processors/
      outbox.processor.ts
      webhook-delivery.processor.ts
      reconciliation.processor.ts
    schedulers/
      reconciliation.scheduler.ts
    jobs.module.ts
```

## Module Responsibility Boundaries

### `common/`

Shared utilities and cross-cutting concerns that are not domain-specific.

Use this only for truly reusable pieces. Do not dump business logic here.

Good fit:

- base response types
- custom exception classes
- request context helpers
- logging helpers
- generic validation utilities

Avoid:

- transaction logic
- ledger rules
- account-specific calculations

### `config/`

Environment and runtime configuration.

Expected responsibilities:

- load env variables
- validate env schema
- expose database and Redis config
- centralize queue settings

### `database/`

Infrastructure for persistence and transaction execution.

Expected responsibilities:

- ORM integration
- migrations
- shared transaction runner utilities
- database module exports

### `modules/accounts/`

Owns account creation and read operations.

Expected responsibilities:

- create account
- get current balance
- get account statement

Should not own:

- transfer orchestration
- idempotency policy
- webhook delivery

### `modules/transactions/`

Owns deposit, withdrawal, and transfer workflows.

Expected responsibilities:

- validate money movement requests
- open database transaction
- lock account rows
- call ledger service to create double-entry records
- update balances
- create transaction record
- create outbox event

This should be the most carefully designed module in the codebase.

### `modules/ledger/`

Owns journal creation and ledger queries.

Expected responsibilities:

- create debit and credit entries
- verify transaction-level balancing rules
- support statement and audit queries

### `modules/idempotency/`

Owns safe handling of retried write requests.

Expected responsibilities:

- store request key and request hash
- detect duplicate retry
- replay original response
- reject key reuse with changed payload

### `modules/outbox/`

Owns reliable event persistence.

Expected responsibilities:

- write outbox event inside same DB transaction
- mark publish status
- support background polling or queue handoff

### `modules/webhooks/`

Owns downstream webhook subscriptions and delivery tracking.

Expected responsibilities:

- register webhook
- store secrets
- track delivery attempts
- schedule retries and dead-letter handling

### `modules/reconciliation/`

Owns consistency verification.

Expected responsibilities:

- compare account balances with ledger-derived totals
- verify debit/credit balancing
- record anomalies

### `modules/health/`

Owns health endpoints.

Expected responsibilities:

- app health
- DB readiness
- Redis readiness if used

### `jobs/`

Owns asynchronous processing.

Expected responsibilities:

- outbox dispatch
- webhook retry workers
- reconciliation scheduling

Keep workers separate from HTTP controllers to avoid mixing synchronous API logic with background execution paths.

## Naming Conventions

Use consistent names from the start.

- modules: plural where the domain is plural in usage, such as `accounts`, `transactions`, `webhooks`
- DTO files: `*.dto.ts`
- enum files: `*.enum.ts`
- entity files: `*.entity.ts`
- repository files: `*.repository.ts`
- processor files: `*.processor.ts`
- scheduler files: `*.scheduler.ts`

## What Not To Add Yet

To keep v1 disciplined, do not create folders for postponed concerns.

Do not add yet:

- `users/`
- `auth/`
- `roles/`
- `permissions/`
- `admin/`
- `organizations/`
- `currencies/`
- `payments/`

These can be introduced later if the scope expands.

## Suggested Implementation Order

Create the folder structure in this order:

1. `config/`
2. `database/`
3. `modules/accounts/`
4. `modules/ledger/`
5. `modules/transactions/`
6. `modules/idempotency/`
7. `modules/outbox/`
8. `modules/webhooks/`
9. `jobs/`
10. `modules/reconciliation/`
11. `modules/health/`

Reasoning:

- accounts, ledger, and transactions form the financial core
- idempotency and outbox are reliability layers on top of the core flow
- webhooks and reconciliation depend on transaction completion data

## Folder Structure Principles

- keep controllers thin
- keep transaction orchestration in services
- keep persistence access isolated in repositories or ORM service layers
- keep entities and DTOs close to their domain module
- keep shared helpers in `common/` only if multiple modules truly need them
- keep async processors outside HTTP modules

## Future Expansion

When post-v1 features are added, the structure can grow without major refactoring.

Likely future folders:

```text
src/
  modules/
    users/
    auth/
    admin/
```

These should remain separate from the transaction and ledger core so the accounting model stays clean.

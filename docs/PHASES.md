# Phases

This document keeps the implementation history out of the main README while preserving the reasoning behind the build.

## How To Use The Docs

- `README.md` is the public-facing overview for recruiters, interviewers, and demos.
- This file is the delivery history: what was built in each phase and why it mattered.
- `PROJECT_SCOPE.md` is the detailed design reference.
- `ACCEPTANCE_FLOW.md` is the manual verification playbook.

## Phase 1: Financial Core MVP

Primary goal: prove that money movement is correct before adding async infrastructure.

Delivered:

- account creation, balance, and statement APIs
- deposit, withdraw, and transfer APIs
- PostgreSQL-backed transaction orchestration
- deterministic row locking for transfer safety
- double-entry ledger persistence
- idempotency enforcement on write APIs
- core unit and integration coverage for money movement

What this phase demonstrates:

- no overdraw under concurrent access
- no duplicate logical transaction on safe retry
- balance snapshots stay aligned with ledger writes inside one DB transaction

## Phase 2: Reliability and Async Processing

Primary goal: make post-commit processing durable and retry-safe without splitting into microservices.

Delivered:

- transactional outbox events stored in PostgreSQL
- BullMQ integration backed by Redis
- background outbox polling and stale-event recovery
- webhook subscription and delivery tracking
- exponential backoff and terminal-failure handling for webhooks
- background reconciliation runs and issue recording
- health checks that include DB and Redis readiness

What this phase demonstrates:

- committed transactions reliably produce async side effects
- failures after commit do not lose events
- duplicate dispatch attempts do not duplicate webhook delivery rows
- audit jobs can detect ledger or balance inconsistencies

## Phase 3: Hardening and Operational Visibility

Primary goal: make the system easier to inspect, explain, and defend in interviews.

Delivered:

- read-only operational APIs for outbox, webhook delivery, and reconciliation state
- domain-specific error codes for predictable failure responses
- structured logging around transaction, outbox, webhook, and reconciliation workflows
- improved test coverage for reliability paths and operational read models
- documentation for manual demo and project story

What this phase demonstrates:

- production-style observability thinking
- debuggable failure states instead of opaque errors
- clear separation between core domain flows and operational inspection

## What Stayed Out Of Scope In V1

These were intentionally excluded to keep the project disciplined:

- authentication and authorization
- user ownership model
- multi-currency conversion
- microservice decomposition
- external payment gateway integrations
- admin write APIs for reconciliation or webhook replay

## Extend The Project Later

The cleanest next steps are:

1. add auth and ownership around accounts and ops APIs
2. expose controlled admin APIs for replay and reconciliation triggering
3. add metrics dashboards and alerting
4. split workers from the API process if deployment scale justifies it
5. add stronger reporting or settlement views on top of the ledger

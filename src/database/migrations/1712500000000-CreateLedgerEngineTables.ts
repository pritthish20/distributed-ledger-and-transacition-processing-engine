import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateLedgerEngineTables1712500000000 implements MigrationInterface {
  name = 'CreateLedgerEngineTables1712500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(
      `CREATE TYPE "public"."accounts_status_enum" AS ENUM('active', 'blocked')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_type_enum" AS ENUM('deposit', 'withdrawal', 'transfer')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."transactions_status_enum" AS ENUM('pending', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."ledger_entries_entry_type_enum" AS ENUM('debit', 'credit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."idempotency_records_status_enum" AS ENUM('processing', 'completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."outbox_events_status_enum" AS ENUM('pending', 'processing', 'published', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_subscriptions_status_enum" AS ENUM('active', 'inactive')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."webhook_deliveries_status_enum" AS ENUM('pending', 'success', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reconciliation_runs_status_enum" AS ENUM('completed', 'failed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."reconciliation_issues_issue_type_enum" AS ENUM('account_balance_mismatch', 'unbalanced_transaction')`,
    );

    await queryRunner.query(`
      CREATE TABLE "accounts" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "currency" character varying(3) NOT NULL,
        "balance" bigint NOT NULL DEFAULT '0',
        "status" "public"."accounts_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_accounts_currency" ON "accounts" ("currency")`);

    await queryRunner.query(`
      CREATE TABLE "transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "type" "public"."transactions_type_enum" NOT NULL,
        "status" "public"."transactions_status_enum" NOT NULL DEFAULT 'pending',
        "amount" bigint NOT NULL,
        "currency" character varying(3) NOT NULL,
        "from_account_id" uuid,
        "to_account_id" uuid,
        "description" character varying,
        "error_code" character varying,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_transactions_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_transactions_from_account" FOREIGN KEY ("from_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
        CONSTRAINT "FK_transactions_to_account" FOREIGN KEY ("to_account_id") REFERENCES "accounts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_from_account_id" ON "transactions" ("from_account_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_transactions_to_account_id" ON "transactions" ("to_account_id")`);

    await queryRunner.query(`
      CREATE TABLE "ledger_entries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "transaction_id" uuid NOT NULL,
        "account_id" uuid,
        "ledger_account" character varying,
        "entry_type" "public"."ledger_entries_entry_type_enum" NOT NULL,
        "amount" bigint NOT NULL,
        "currency" character varying(3) NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_ledger_entries_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_ledger_entries_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_ledger_entries_account" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_entries_transaction_id" ON "ledger_entries" ("transaction_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_ledger_entries_account_id" ON "ledger_entries" ("account_id")`);

    await queryRunner.query(`
      CREATE TABLE "idempotency_records" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "endpoint" character varying NOT NULL,
        "idempotency_key" character varying NOT NULL,
        "request_hash" character varying NOT NULL,
        "status" "public"."idempotency_records_status_enum" NOT NULL,
        "transaction_id" uuid,
        "response_code" integer,
        "response_body" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_idempotency_records_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_idempotency_records_endpoint_key" UNIQUE ("endpoint", "idempotency_key"),
        CONSTRAINT "FK_idempotency_records_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "aggregate_type" character varying NOT NULL,
        "aggregate_id" character varying NOT NULL,
        "event_type" character varying NOT NULL,
        "payload" jsonb NOT NULL,
        "status" "public"."outbox_events_status_enum" NOT NULL DEFAULT 'pending',
        "retry_count" integer NOT NULL DEFAULT '0',
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "published_at" TIMESTAMP WITH TIME ZONE,
        "transaction_id" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_outbox_events_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_outbox_events_transaction" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_events_event_type" ON "outbox_events" ("event_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_outbox_events_transaction_id" ON "outbox_events" ("transaction_id")`);

    await queryRunner.query(`
      CREATE TABLE "webhook_subscriptions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "target_url" character varying NOT NULL,
        "secret" character varying NOT NULL,
        "event_type" character varying NOT NULL,
        "status" "public"."webhook_subscriptions_status_enum" NOT NULL DEFAULT 'active',
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_subscriptions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_subscriptions_event_type" ON "webhook_subscriptions" ("event_type")`);

    await queryRunner.query(`
      CREATE TABLE "webhook_deliveries" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "webhook_subscription_id" uuid NOT NULL,
        "outbox_event_id" uuid NOT NULL,
        "status" "public"."webhook_deliveries_status_enum" NOT NULL DEFAULT 'pending',
        "attempt_count" integer NOT NULL DEFAULT '0',
        "last_attempt_at" TIMESTAMP WITH TIME ZONE,
        "next_retry_at" TIMESTAMP WITH TIME ZONE,
        "response_status" integer,
        "response_body" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_webhook_deliveries_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_webhook_deliveries_subscription_outbox" UNIQUE ("webhook_subscription_id", "outbox_event_id"),
        CONSTRAINT "FK_webhook_deliveries_subscription" FOREIGN KEY ("webhook_subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_webhook_deliveries_outbox_event" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_deliveries_subscription_id" ON "webhook_deliveries" ("webhook_subscription_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_webhook_deliveries_outbox_event_id" ON "webhook_deliveries" ("outbox_event_id")`);

    await queryRunner.query(`
      CREATE TABLE "reconciliation_runs" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "status" "public"."reconciliation_runs_status_enum" NOT NULL,
        "total_issues" integer NOT NULL DEFAULT '0',
        "error_message" character varying,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "completed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_runs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "reconciliation_issues" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "run_id" uuid NOT NULL,
        "issue_type" "public"."reconciliation_issues_issue_type_enum" NOT NULL,
        "reference_id" character varying,
        "details" jsonb NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_issues_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_reconciliation_issues_run" FOREIGN KEY ("run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "reconciliation_issues"`);
    await queryRunner.query(`DROP TABLE "reconciliation_runs"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_deliveries_outbox_event_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_deliveries_subscription_id"`);
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_webhook_subscriptions_event_type"`);
    await queryRunner.query(`DROP TABLE "webhook_subscriptions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_events_transaction_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_outbox_events_event_type"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`DROP TABLE "idempotency_records"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ledger_entries_account_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ledger_entries_transaction_id"`);
    await queryRunner.query(`DROP TABLE "ledger_entries"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_to_account_id"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_transactions_from_account_id"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_accounts_currency"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
    await queryRunner.query(`DROP TYPE "public"."reconciliation_issues_issue_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."reconciliation_runs_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_deliveries_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."webhook_subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."outbox_events_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."idempotency_records_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."ledger_entries_entry_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."transactions_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."accounts_status_enum"`);
  }
}

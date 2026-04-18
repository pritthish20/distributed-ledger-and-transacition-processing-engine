import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createIntegrationApp, truncateDomainTables } from './test-app';

describe('Ops read APIs integration', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createIntegrationApp();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await truncateDomainTables(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists outbox events with filters', async () => {
    const { outboxEventId, transactionId } = await seedOperationalRows(dataSource);

    const response = await request(app.getHttpServer())
      .get('/api/ops/outbox/events')
      .query({
        status: 'failed',
        eventType: 'transaction.completed',
        limit: 10,
        offset: 0,
      })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: outboxEventId,
        eventType: 'transaction.completed',
        status: 'failed',
        retryCount: 3,
        transactionId,
      }),
    ]);
    expect(response.body[0].payload).toBeUndefined();
  });

  it('lists webhook deliveries with filters', async () => {
    const { outboxEventId, webhookSubscriptionId, webhookDeliveryId } =
      await seedOperationalRows(dataSource);

    const response = await request(app.getHttpServer())
      .get('/api/ops/webhook-deliveries')
      .query({
        status: 'failed',
        outboxEventId,
        webhookSubscriptionId,
      })
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        id: webhookDeliveryId,
        status: 'failed',
        attemptCount: 3,
        responseStatus: 500,
        outboxEventId,
        webhookSubscriptionId,
      }),
    ]);
  });

  it('lists reconciliation runs and issues with filters', async () => {
    const { reconciliationRunId, reconciliationIssueId } =
      await seedOperationalRows(dataSource);

    const runsResponse = await request(app.getHttpServer())
      .get('/api/ops/reconciliation/runs')
      .query({ status: 'failed' })
      .expect(200);
    expect(runsResponse.body).toEqual([
      expect.objectContaining({
        id: reconciliationRunId,
        status: 'failed',
        totalIssues: 1,
      }),
    ]);

    const issuesResponse = await request(app.getHttpServer())
      .get(`/api/ops/reconciliation/runs/${reconciliationRunId}/issues`)
      .query({ issueType: 'account_balance_mismatch' })
      .expect(200);
    expect(issuesResponse.body).toEqual([
      expect.objectContaining({
        id: reconciliationIssueId,
        runId: reconciliationRunId,
        issueType: 'account_balance_mismatch',
      }),
    ]);
  });
});

async function seedOperationalRows(dataSource: DataSource) {
  const [account] = await dataSource.query(`
    INSERT INTO accounts (currency, balance)
    VALUES ('INR', 1000)
    RETURNING id
  `);
  const [transaction] = await dataSource.query(
    `
      INSERT INTO transactions (type, status, amount, currency, to_account_id, completed_at)
      VALUES ('deposit', 'completed', 1000, 'INR', $1, now())
      RETURNING id
    `,
    [account.id],
  );
  const [outboxEvent] = await dataSource.query(
    `
      INSERT INTO outbox_events (
        aggregate_type,
        aggregate_id,
        event_type,
        payload,
        status,
        retry_count,
        transaction_id
      )
      VALUES (
        'transaction',
        $1,
        'transaction.completed',
        $2::jsonb,
        'failed',
        3,
        $3
      )
      RETURNING id
    `,
    [
      transaction.id,
      JSON.stringify({
        transactionId: transaction.id,
        amount: 1000,
        currency: 'INR',
        toAccountId: account.id,
      }),
      transaction.id,
    ],
  );
  const [webhookSubscription] = await dataSource.query(`
    INSERT INTO webhook_subscriptions (target_url, secret, event_type)
    VALUES ('https://merchant.example/webhook', 'super-secret', 'transaction.completed')
    RETURNING id
  `);
  const [webhookDelivery] = await dataSource.query(
    `
      INSERT INTO webhook_deliveries (
        webhook_subscription_id,
        outbox_event_id,
        status,
        attempt_count,
        response_status,
        response_body
      )
      VALUES ($1, $2, 'failed', 3, 500, 'server error')
      RETURNING id
    `,
    [webhookSubscription.id, outboxEvent.id],
  );
  const [reconciliationRun] = await dataSource.query(`
    INSERT INTO reconciliation_runs (
      status,
      total_issues,
      error_message,
      started_at,
      completed_at
    )
    VALUES ('failed', 1, 'seeded failure', now(), now())
    RETURNING id
  `);
  const [reconciliationIssue] = await dataSource.query(
    `
      INSERT INTO reconciliation_issues (run_id, issue_type, reference_id, details)
      VALUES (
        $1,
        'account_balance_mismatch',
        $2,
        $3::jsonb
      )
      RETURNING id
    `,
    [
      reconciliationRun.id,
      account.id,
      JSON.stringify({
        accountBalance: 1000,
        ledgerBalance: 900,
      }),
    ],
  );

  return {
    transactionId: transaction.id as string,
    outboxEventId: outboxEvent.id as string,
    webhookSubscriptionId: webhookSubscription.id as string,
    webhookDeliveryId: webhookDelivery.id as string,
    reconciliationRunId: reconciliationRun.id as string,
    reconciliationIssueId: reconciliationIssue.id as string,
  };
}

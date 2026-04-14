import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { ReconciliationService } from '../../src/modules/reconciliation/reconciliation.service';
import { createIntegrationApp, truncateDomainTables } from './test-app';

describe('Reconciliation integration', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let reconciliationService: ReconciliationService;

  beforeAll(async () => {
    app = await createIntegrationApp();
    dataSource = app.get(DataSource);
    reconciliationService = app.get(ReconciliationService);
  });

  beforeEach(async () => {
    await truncateDomainTables(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('records reconciliation issues for account and ledger mismatches', async () => {
    const account = await createAccount(app, 'reconciliation-account-1');
    const deposit = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'reconciliation-deposit-1')
      .send({
        accountId: account.id,
        amount: 2000,
        currency: 'INR',
      })
      .expect(201);

    await dataSource.query('UPDATE accounts SET balance = 2100 WHERE id = $1', [account.id]);
    await dataSource.query(
      'DELETE FROM ledger_entries WHERE transaction_id = $1 AND account_id IS NULL',
      [deposit.body.id],
    );

    const result = await reconciliationService.runReconciliation();

    expect(result).toMatchObject({
      skipped: false,
      status: 'completed',
      totalIssues: 2,
    });

    const [run] = await dataSource.query('SELECT status, total_issues FROM reconciliation_runs');
    expect(run).toMatchObject({
      status: 'completed',
      total_issues: 2,
    });

    const issues = await dataSource.query(
      'SELECT issue_type, reference_id FROM reconciliation_issues ORDER BY issue_type',
    );
    expect(issues).toEqual([
      expect.objectContaining({
        issue_type: 'account_balance_mismatch',
        reference_id: account.id,
      }),
      expect.objectContaining({
        issue_type: 'unbalanced_transaction',
        reference_id: deposit.body.id,
      }),
    ]);
  });
});

async function createAccount(app: INestApplication<App>, idempotencyKey: string) {
  const response = await request(app.getHttpServer())
    .post('/api/accounts')
    .set('Idempotency-Key', idempotencyKey)
    .send({ currency: 'INR' })
    .expect(201);

  return response.body as { id: string };
}

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createIntegrationApp, truncateDomainTables } from './test-app';

describe('Transaction flows integration', () => {
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

  it('creates accounts and returns current balance', async () => {
    const account = await createAccount(app, 'account-create-1');

    const balanceResponse = await request(app.getHttpServer())
      .get(`/api/accounts/${account.id}/balance`)
      .expect(200);

    expect(balanceResponse.body).toMatchObject({
      accountId: account.id,
      currency: 'INR',
      balance: 0,
      status: 'active',
    });

    const rows = await dataSource.query('SELECT id, currency, balance, status FROM accounts');
    expect(rows).toEqual([
      expect.objectContaining({
        id: account.id,
        currency: 'INR',
        balance: '0',
        status: 'active',
      }),
    ]);
  });

  it('deposits funds and creates transaction, ledger, and outbox rows', async () => {
    const account = await createAccount(app, 'deposit-account-1');

    const deposit = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'deposit-1')
      .send({
        accountId: account.id,
        amount: 5000,
        currency: 'INR',
        description: 'seed funds',
      })
      .expect(201);

    expect(deposit.body).toMatchObject({
      type: 'deposit',
      status: 'completed',
      amount: 5000,
      currency: 'INR',
      toAccountId: account.id,
    });

    const [accountRow] = await dataSource.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(accountRow.balance).toBe('5000');

    const ledgerRows = await dataSource.query(
      'SELECT account_id, ledger_account, entry_type, amount FROM ledger_entries WHERE transaction_id = $1 ORDER BY account_id NULLS LAST, entry_type',
      [deposit.body.id],
    );
    expect(ledgerRows).toHaveLength(2);
    expect(ledgerRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: account.id,
          entry_type: 'credit',
          amount: '5000',
        }),
        expect.objectContaining({
          account_id: null,
          ledger_account: 'external_settlement',
          entry_type: 'debit',
          amount: '5000',
        }),
      ]),
    );

    const outboxRows = await dataSource.query(
      'SELECT event_type, aggregate_id, transaction_id FROM outbox_events WHERE transaction_id = $1',
      [deposit.body.id],
    );
    expect(outboxRows).toEqual([
      expect.objectContaining({
        event_type: 'transaction.completed',
        aggregate_id: deposit.body.id,
        transaction_id: deposit.body.id,
      }),
    ]);
  });

  it('rolls back withdrawal when funds are insufficient', async () => {
    const account = await createAccount(app, 'withdraw-account-1');

    await request(app.getHttpServer())
      .post('/api/transactions/withdraw')
      .set('Idempotency-Key', 'withdraw-fail-1')
      .send({
        accountId: account.id,
        amount: 1000,
        currency: 'INR',
      })
      .expect(400);

    const [accountRow] = await dataSource.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(accountRow.balance).toBe('0');

    const [counts] = await dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM transactions) AS transactions,
        (SELECT COUNT(*) FROM ledger_entries) AS ledger_entries,
        (SELECT COUNT(*) FROM outbox_events) AS outbox_events
    `);
    expect(Number(counts.transactions)).toBe(0);
    expect(Number(counts.ledger_entries)).toBe(0);
    expect(Number(counts.outbox_events)).toBe(0);
  });

  it('transfers funds between two accounts atomically', async () => {
    const fromAccount = await createAccount(app, 'transfer-from-1');
    const toAccount = await createAccount(app, 'transfer-to-1');

    await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'transfer-seed-1')
      .send({
        accountId: fromAccount.id,
        amount: 10000,
        currency: 'INR',
      })
      .expect(201);

    const transfer = await request(app.getHttpServer())
      .post('/api/transactions/transfer')
      .set('Idempotency-Key', 'transfer-1')
      .send({
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: 2500,
        currency: 'INR',
      })
      .expect(201);

    expect(transfer.body).toMatchObject({
      type: 'transfer',
      status: 'completed',
      amount: 2500,
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
    });

    const accountRows = await dataSource.query(
      'SELECT id, balance FROM accounts WHERE id = ANY($1) ORDER BY id',
      [[fromAccount.id, toAccount.id]],
    );
    expect(balanceByAccount(accountRows, fromAccount.id)).toBe(7500);
    expect(balanceByAccount(accountRows, toAccount.id)).toBe(2500);

    const ledgerRows = await dataSource.query(
      'SELECT account_id, entry_type, amount FROM ledger_entries WHERE transaction_id = $1 ORDER BY entry_type',
      [transfer.body.id],
    );
    expect(ledgerRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          account_id: fromAccount.id,
          entry_type: 'debit',
          amount: '2500',
        }),
        expect.objectContaining({
          account_id: toAccount.id,
          entry_type: 'credit',
          amount: '2500',
        }),
      ]),
    );
  });

  it('replays the original response for duplicate idempotency key and same payload', async () => {
    const account = await createAccount(app, 'idem-account-1');
    const payload = {
      accountId: account.id,
      amount: 3000,
      currency: 'INR',
    };

    const first = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'idem-deposit-1')
      .send(payload)
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'idem-deposit-1')
      .send(payload)
      .expect(201);

    expect(second.body.id).toBe(first.body.id);

    const [counts] = await dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM transactions) AS transactions,
        (SELECT COUNT(*) FROM ledger_entries) AS ledger_entries
    `);
    expect(Number(counts.transactions)).toBe(1);
    expect(Number(counts.ledger_entries)).toBe(2);
  });

  it('rejects duplicate idempotency key with a different payload', async () => {
    const account = await createAccount(app, 'idem-account-2');

    await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'idem-deposit-2')
      .send({
        accountId: account.id,
        amount: 1000,
        currency: 'INR',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'idem-deposit-2')
      .send({
        accountId: account.id,
        amount: 2000,
        currency: 'INR',
      })
      .expect(409);

    const [accountRow] = await dataSource.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(accountRow.balance).toBe('1000');
  });
});

async function createAccount(app: INestApplication<App>, idempotencyKey: string) {
  const response = await request(app.getHttpServer())
    .post('/api/accounts')
    .set('Idempotency-Key', idempotencyKey)
    .send({ currency: 'INR' })
    .expect(201);

  return response.body as { id: string; currency: string; balance: number; status: string };
}

function balanceByAccount(rows: Array<{ id: string; balance: string }>, accountId: string) {
  const row = rows.find((account) => account.id === accountId);
  return row ? Number(row.balance) : undefined;
}

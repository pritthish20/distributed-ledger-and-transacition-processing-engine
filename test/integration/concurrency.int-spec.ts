import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createIntegrationApp, truncateDomainTables } from './test-app';

describe('Concurrency integration', () => {
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

  it('prevents double spending with concurrent withdrawals from the same account', async () => {
    const account = await createAccount(app, 'concurrent-withdraw-account');
    await deposit(app, account.id, 1000, 'concurrent-withdraw-seed');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/transactions/withdraw')
        .set('Idempotency-Key', 'concurrent-withdraw-1')
        .send({
          accountId: account.id,
          amount: 800,
          currency: 'INR',
        }),
      request(app.getHttpServer())
        .post('/api/transactions/withdraw')
        .set('Idempotency-Key', 'concurrent-withdraw-2')
        .send({
          accountId: account.id,
          amount: 800,
          currency: 'INR',
        }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 400]);

    const [accountRow] = await dataSource.query('SELECT balance FROM accounts WHERE id = $1', [account.id]);
    expect(Number(accountRow.balance)).toBe(200);

    const [counts] = await dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM transactions WHERE type = 'withdrawal') AS withdrawals,
        (SELECT COUNT(*) FROM ledger_entries WHERE account_id = $1 AND entry_type = 'debit') AS debit_entries
    `, [account.id]);
    expect(Number(counts.withdrawals)).toBe(1);
    expect(Number(counts.debit_entries)).toBe(1);
  });

  it('prevents double spending with concurrent transfers from the same source account', async () => {
    const fromAccount = await createAccount(app, 'concurrent-transfer-from');
    const toAccountA = await createAccount(app, 'concurrent-transfer-to-a');
    const toAccountB = await createAccount(app, 'concurrent-transfer-to-b');
    await deposit(app, fromAccount.id, 1000, 'concurrent-transfer-seed');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/transactions/transfer')
        .set('Idempotency-Key', 'concurrent-transfer-1')
        .send({
          fromAccountId: fromAccount.id,
          toAccountId: toAccountA.id,
          amount: 800,
          currency: 'INR',
        }),
      request(app.getHttpServer())
        .post('/api/transactions/transfer')
        .set('Idempotency-Key', 'concurrent-transfer-2')
        .send({
          fromAccountId: fromAccount.id,
          toAccountId: toAccountB.id,
          amount: 800,
          currency: 'INR',
        }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 400]);

    const rows = await dataSource.query(
      'SELECT id, balance FROM accounts WHERE id = ANY($1)',
      [[fromAccount.id, toAccountA.id, toAccountB.id]],
    );
    expect(balanceByAccount(rows, fromAccount.id)).toBe(200);
    expect(
      balanceByAccount(rows, toAccountA.id) + balanceByAccount(rows, toAccountB.id),
    ).toBe(800);

    const [counts] = await dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM transactions WHERE type = 'transfer') AS transfers,
        (SELECT COUNT(*) FROM ledger_entries WHERE entry_type = 'debit' AND account_id = $1) AS source_debits
    `, [fromAccount.id]);
    expect(Number(counts.transfers)).toBe(1);
    expect(Number(counts.source_debits)).toBe(1);
  });

  it('does not deadlock on opposite-direction transfers', async () => {
    const accountA = await createAccount(app, 'opposite-a');
    const accountB = await createAccount(app, 'opposite-b');
    await deposit(app, accountA.id, 1000, 'opposite-seed-a');
    await deposit(app, accountB.id, 1000, 'opposite-seed-b');

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/transactions/transfer')
        .set('Idempotency-Key', 'opposite-transfer-1')
        .send({
          fromAccountId: accountA.id,
          toAccountId: accountB.id,
          amount: 100,
          currency: 'INR',
        }),
      request(app.getHttpServer())
        .post('/api/transactions/transfer')
        .set('Idempotency-Key', 'opposite-transfer-2')
        .send({
          fromAccountId: accountB.id,
          toAccountId: accountA.id,
          amount: 100,
          currency: 'INR',
        }),
    ]);

    expect([first.status, second.status].sort()).toEqual([201, 201]);

    const rows = await dataSource.query(
      'SELECT id, balance FROM accounts WHERE id = ANY($1)',
      [[accountA.id, accountB.id]],
    );
    expect(balanceByAccount(rows, accountA.id)).toBe(1000);
    expect(balanceByAccount(rows, accountB.id)).toBe(1000);

    const [counts] = await dataSource.query(`
      SELECT
        (SELECT COUNT(*) FROM transactions WHERE type = 'transfer') AS transfers,
        (SELECT COUNT(*) FROM ledger_entries WHERE entry_type = 'debit') AS debit_entries,
        (SELECT COUNT(*) FROM ledger_entries WHERE entry_type = 'credit') AS credit_entries
    `);
    expect(Number(counts.transfers)).toBe(2);
    expect(Number(counts.debit_entries)).toBe(4);
    expect(Number(counts.credit_entries)).toBe(4);
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

async function deposit(
  app: INestApplication<App>,
  accountId: string,
  amount: number,
  idempotencyKey: string,
) {
  await request(app.getHttpServer())
    .post('/api/transactions/deposit')
    .set('Idempotency-Key', idempotencyKey)
    .send({
      accountId,
      amount,
      currency: 'INR',
    })
    .expect(201);
}

function balanceByAccount(rows: Array<{ id: string; balance: string }>, accountId: string) {
  const row = rows.find((account) => account.id === accountId);
  return row ? Number(row.balance) : 0;
}

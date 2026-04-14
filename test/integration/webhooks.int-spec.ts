import { INestApplication } from '@nestjs/common';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createIntegrationApp, truncateDomainTables, waitForCondition } from './test-app';

describe('Webhook worker integration', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let receiver: TestWebhookReceiver;

  beforeAll(async () => {
    app = await createIntegrationApp();
    dataSource = app.get(DataSource);
    receiver = await createWebhookReceiver();
  });

  beforeEach(async () => {
    receiver.reset();
    await truncateDomainTables(app);
  });

  afterAll(async () => {
    await receiver.close();
    await app.close();
  });

  it('delivers a transaction.completed webhook through outbox and BullMQ', async () => {
    await registerWebhook(app, `${receiver.url}/webhook`, 'webhook-subscription-1');
    const account = await createAccount(app, 'webhook-account-1');

    const deposit = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'webhook-deposit-1')
      .send({
        accountId: account.id,
        amount: 1500,
        currency: 'INR',
      })
      .expect(201);

    await waitForCondition(async () => receiver.requests.length === 1, 20000);

    expect(receiver.requests[0]).toMatchObject({
      method: 'POST',
      path: '/webhook',
      headers: expect.objectContaining({
        'x-webhook-event': 'transaction.completed',
      }),
      body: expect.objectContaining({
        transactionId: deposit.body.id,
        amount: 1500,
        currency: 'INR',
        toAccountId: account.id,
      }),
    });
    expect(receiver.requests[0].headers['x-webhook-signature']).toEqual(expect.any(String));

    const [delivery] = await dataSource.query(`
      SELECT status, attempt_count, response_status
      FROM webhook_deliveries
      LIMIT 1
    `);
    expect(delivery).toMatchObject({
      status: 'success',
      attempt_count: 1,
      response_status: 200,
    });

    const [outboxEvent] = await dataSource.query(
      'SELECT status FROM outbox_events WHERE transaction_id = $1',
      [deposit.body.id],
    );
    expect(outboxEvent.status).toBe('published');
  });

  it('marks outbox event published when no webhook subscriptions match', async () => {
    const account = await createAccount(app, 'webhook-no-sub-account-1');

    const deposit = await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'webhook-no-sub-deposit-1')
      .send({
        accountId: account.id,
        amount: 1500,
        currency: 'INR',
      })
      .expect(201);

    await waitForCondition(async () => {
      const [outboxEvent] = await dataSource.query(
        'SELECT status FROM outbox_events WHERE transaction_id = $1',
        [deposit.body.id],
      );

      return outboxEvent?.status === 'published';
    }, 20000);

    const [counts] = await dataSource.query(
      'SELECT COUNT(*) AS deliveries FROM webhook_deliveries',
    );
    expect(Number(counts.deliveries)).toBe(0);
  });

  it('retries failed webhook delivery and eventually marks it failed', async () => {
    receiver.setStatusCode(500);
    await registerWebhook(app, `${receiver.url}/webhook`, 'webhook-subscription-fail-1');
    const account = await createAccount(app, 'webhook-fail-account-1');

    await request(app.getHttpServer())
      .post('/api/transactions/deposit')
      .set('Idempotency-Key', 'webhook-fail-deposit-1')
      .send({
        accountId: account.id,
        amount: 1500,
        currency: 'INR',
      })
      .expect(201);

    await waitForCondition(async () => {
      const [delivery] = await dataSource.query(`
        SELECT status, attempt_count
        FROM webhook_deliveries
        LIMIT 1
      `);

      return delivery?.status === 'failed' && Number(delivery.attempt_count) === 3;
    }, 25000);

    expect(receiver.requests.length).toBeGreaterThanOrEqual(3);

    const [outboxEvent] = await dataSource.query('SELECT status FROM outbox_events LIMIT 1');
    expect(outboxEvent.status).toBe('failed');
  });
});

async function registerWebhook(
  app: INestApplication<App>,
  targetUrl: string,
  idempotencyKey: string,
) {
  await request(app.getHttpServer())
    .post('/api/webhooks')
    .set('Idempotency-Key', idempotencyKey)
    .send({
      targetUrl,
      eventType: 'transaction.completed',
      secret: 'super-secret',
    })
    .expect(201);
}

async function createAccount(app: INestApplication<App>, idempotencyKey: string) {
  const response = await request(app.getHttpServer())
    .post('/api/accounts')
    .set('Idempotency-Key', idempotencyKey)
    .send({ currency: 'INR' })
    .expect(201);

  return response.body as { id: string };
}

async function createWebhookReceiver() {
  const requests: Array<{
    method: string | undefined;
    path: string | undefined;
    headers: IncomingMessage['headers'];
    body: Record<string, unknown>;
  }> = [];
  let statusCode = 200;

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const rawBody = Buffer.concat(chunks).toString('utf8');
      requests.push({
        method: req.method,
        path: req.url,
        headers: req.headers,
        body: rawBody ? JSON.parse(rawBody) : {},
      });

      res.statusCode = statusCode;
      res.end(statusCode >= 200 && statusCode < 300 ? 'ok' : 'failed');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Failed to start webhook receiver');
  }

  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    reset() {
      requests.length = 0;
      statusCode = 200;
    },
    setStatusCode(nextStatusCode: number) {
      statusCode = nextStatusCode;
    },
    close() {
      return new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });
    },
  };
}

type TestWebhookReceiver = Awaited<ReturnType<typeof createWebhookReceiver>>;

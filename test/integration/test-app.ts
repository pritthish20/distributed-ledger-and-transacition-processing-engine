import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';

export async function createIntegrationApp() {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.init();

  return app;
}

export async function truncateDomainTables(app: INestApplication) {
  const dataSource = app.get(DataSource);

  await dataSource.query(`
    TRUNCATE TABLE
      reconciliation_issues,
      reconciliation_runs,
      webhook_deliveries,
      webhook_subscriptions,
      outbox_events,
      idempotency_records,
      ledger_entries,
      transactions,
      accounts
    RESTART IDENTITY CASCADE
  `);
}

export async function waitForCondition(
  condition: () => Promise<boolean>,
  timeoutMs = 15000,
  intervalMs = 250,
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await condition()) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Condition was not met within ${timeoutMs}ms`);
}

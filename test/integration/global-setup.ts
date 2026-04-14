import { DataSource } from 'typeorm';
import { CreateLedgerEngineTables1712500000000 } from '../../src/database/migrations/1712500000000-CreateLedgerEngineTables';

const TEST_DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/ledger_engine_test';
const ADMIN_DATABASE_URL = TEST_DATABASE_URL.replace(
  /\/ledger_engine_test(\?.*)?$/,
  '/postgres$1',
);

export default async function globalSetup() {
  process.env.NODE_ENV = 'test';
  process.env.PORT = process.env.PORT ?? '3000';
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
  process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
  process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
  process.env.QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? 'ledger-engine-test';
  process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS ?? '3';
  process.env.WEBHOOK_BACKOFF_MS = process.env.WEBHOOK_BACKOFF_MS ?? '100';

  try {
    await ensureTestDatabase();

    const appDataSource = new DataSource({
      type: 'postgres',
      url: TEST_DATABASE_URL,
      migrations: [CreateLedgerEngineTables1712500000000],
    });

    await appDataSource.initialize();
    await appDataSource.query('DROP SCHEMA IF EXISTS public CASCADE');
    await appDataSource.query('CREATE SCHEMA public');
    await appDataSource.runMigrations();
    await appDataSource.destroy();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Integration test database setup failed. Ensure Docker Postgres is running on 127.0.0.1:5432. Cause: ${message}`,
    );
  }
}

async function ensureTestDatabase() {
  const adminDataSource = new DataSource({
    type: 'postgres',
    url: ADMIN_DATABASE_URL,
  });

  await adminDataSource.initialize();
  const result = await adminDataSource.query(
    `SELECT 1 FROM pg_database WHERE datname = 'ledger_engine_test'`,
  );

  if (result.length === 0) {
    await adminDataSource.query('CREATE DATABASE ledger_engine_test');
  }

  await adminDataSource.destroy();
}

process.env.NODE_ENV = 'test';
process.env.PORT = process.env.PORT ?? '3000';
process.env.DATABASE_URL =
  process.env.INTEGRATION_DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/ledger_engine_test';
process.env.REDIS_HOST = process.env.REDIS_HOST ?? '127.0.0.1';
process.env.REDIS_PORT = process.env.REDIS_PORT ?? '6379';
process.env.REDIS_PASSWORD = process.env.REDIS_PASSWORD ?? '';
process.env.QUEUE_PREFIX = process.env.QUEUE_PREFIX ?? 'ledger-engine-test';
process.env.WEBHOOK_MAX_ATTEMPTS = process.env.WEBHOOK_MAX_ATTEMPTS ?? '3';
process.env.WEBHOOK_BACKOFF_MS = process.env.WEBHOOK_BACKOFF_MS ?? '100';

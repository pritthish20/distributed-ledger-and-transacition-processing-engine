export default () =>({
    queue:{
        prefix: process.env.QUEUE_PREFIX ?? 'ledger-engine',
        webhookMaxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS ?? '5',10),
        webhookBackoffMs: parseInt(process.env.WEBHOOK_BACKOFF_MS ?? '5000',10),
        outboxPollIntervalMs: parseInt(process.env.OUTBOX_POLL_INTERVAL_MS ?? '5000',10),
        outboxBatchSize: parseInt(process.env.OUTBOX_BATCH_SIZE ?? '20',10),
        outboxBackoffMs: parseInt(process.env.OUTBOX_BACKOFF_MS ?? '5000',10),
        outboxMaxAttempts: parseInt(process.env.OUTBOX_MAX_ATTEMPTS ?? '5',10),
        outboxStaleAfterMs: parseInt(process.env.OUTBOX_STALE_AFTER_MS ?? '30000',10),
        reconciliationIntervalMs: parseInt(process.env.RECONCILIATION_INTERVAL_MS ?? '60000',10),
    },
})

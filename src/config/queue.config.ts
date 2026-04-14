export default () =>({
    queue:{
        prefix: process.env.QUEUE_PREFIX ?? 'ledger-engine',
        webhookMaxAttempts: parseInt(process.env.WEBHOOK_MAX_ATTEMPTS ?? '5',10),
        webhookBackoffMs: parseInt(process.env.WEBHOOK_BACKOFF_MS ?? '5000',10),
    },
})

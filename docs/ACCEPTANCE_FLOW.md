# Acceptance Flow

This is the manual end-to-end demo flow for the distributed ledger engine.

Run it after local infrastructure and migrations are ready:

```powershell
docker compose up -d
cmd /c npm run migration:run
cmd /c npm run start:dev
```

The API base URL is:

```text
http://localhost:3000/api
```

## 1. Check Health

```powershell
curl.exe http://localhost:3000/api/health
```

Expected result:

- `status` is `ok`
- database check is `up`
- Redis check is `up`

## 2. Create Two Accounts

Create account A:

```powershell
curl.exe -X POST http://localhost:3000/api/accounts `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: create-account-a-1" `
  -d "{\"currency\":\"INR\"}"
```

Create account B:

```powershell
curl.exe -X POST http://localhost:3000/api/accounts `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: create-account-b-1" `
  -d "{\"currency\":\"INR\"}"
```

Save the returned `id` values as `ACCOUNT_A` and `ACCOUNT_B`.

## 3. Deposit Into Account A

Replace `<ACCOUNT_A>` with the first account id.

```powershell
curl.exe -X POST http://localhost:3000/api/transactions/deposit `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: deposit-a-1" `
  -d "{\"accountId\":\"<ACCOUNT_A>\",\"amount\":10000,\"currency\":\"INR\",\"description\":\"Initial funds\"}"
```

Expected result:

- transaction `type` is `deposit`
- transaction `status` is `completed`
- amount is `10000`
- `toAccountId` is `ACCOUNT_A`

## 4. Transfer From A To B

Replace `<ACCOUNT_A>` and `<ACCOUNT_B>`.

```powershell
curl.exe -X POST http://localhost:3000/api/transactions/transfer `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: transfer-a-to-b-1" `
  -d "{\"fromAccountId\":\"<ACCOUNT_A>\",\"toAccountId\":\"<ACCOUNT_B>\",\"amount\":2500,\"currency\":\"INR\",\"description\":\"A to B transfer\"}"
```

Expected result:

- transaction `type` is `transfer`
- transaction `status` is `completed`
- amount is `2500`
- `fromAccountId` is `ACCOUNT_A`
- `toAccountId` is `ACCOUNT_B`

## 5. Verify Balances

Account A:

```powershell
curl.exe http://localhost:3000/api/accounts/<ACCOUNT_A>/balance
```

Expected balance:

```text
7500
```

Account B:

```powershell
curl.exe http://localhost:3000/api/accounts/<ACCOUNT_B>/balance
```

Expected balance:

```text
2500
```

## 6. Verify Statement

```powershell
curl.exe "http://localhost:3000/api/accounts/<ACCOUNT_A>/statement?limit=10"
```

Expected result:

- one deposit ledger entry
- one transfer debit ledger entry
- entries include transaction metadata

## 7. Verify Idempotency Replay

Repeat the same transfer request with the same `Idempotency-Key` and same payload:

```powershell
curl.exe -X POST http://localhost:3000/api/transactions/transfer `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: transfer-a-to-b-1" `
  -d "{\"fromAccountId\":\"<ACCOUNT_A>\",\"toAccountId\":\"<ACCOUNT_B>\",\"amount\":2500,\"currency\":\"INR\",\"description\":\"A to B transfer\"}"
```

Expected result:

- same transaction response as the first transfer
- balances do not change again
- no duplicate money movement

## 8. Verify Idempotency Conflict

Reuse the same idempotency key with a different payload:

```powershell
curl.exe -X POST http://localhost:3000/api/transactions/transfer `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: transfer-a-to-b-1" `
  -d "{\"fromAccountId\":\"<ACCOUNT_A>\",\"toAccountId\":\"<ACCOUNT_B>\",\"amount\":100,\"currency\":\"INR\",\"description\":\"Different payload\"}"
```

Expected result:

```text
409 Conflict
```

## 9. Verify Insufficient Funds

```powershell
curl.exe -X POST http://localhost:3000/api/transactions/withdraw `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: withdraw-too-much-1" `
  -d "{\"accountId\":\"<ACCOUNT_B>\",\"amount\":999999,\"currency\":\"INR\"}"
```

Expected result:

```text
400 Bad Request
```

Account B balance should remain unchanged.

## 10. Optional Webhook Demo

Use a temporary webhook receiver such as `webhook.site`, then register the URL:

```powershell
curl.exe -X POST http://localhost:3000/api/webhooks `
  -H "Content-Type: application/json" `
  -H "Idempotency-Key: webhook-subscription-1" `
  -d "{\"targetUrl\":\"https://your-webhook-site-url\",\"eventType\":\"transaction.completed\",\"secret\":\"super-secret\"}"
```

Run another deposit or transfer.

Expected result:

- webhook receiver gets a `POST`
- request contains `x-webhook-event`
- request contains `x-webhook-signature`
- payload contains the transaction id, amount, currency, and account ids

## 11. Inspect Operational State

These read-only endpoints are for local debugging and demo visibility. They are internal/demo endpoints in V1 and should not be exposed publicly without auth.

Inspect outbox events:

```powershell
curl.exe "http://localhost:3000/api/ops/outbox/events?limit=20"
```

Expected result:

- rows include `eventType`
- rows include `status`
- rows include `retryCount`
- rows include `transactionId`

Inspect webhook deliveries:

```powershell
curl.exe "http://localhost:3000/api/ops/webhook-deliveries?limit=20"
```

Expected result after webhook delivery:

- rows include `status`
- rows include `attemptCount`
- rows include `responseStatus`
- rows include `outboxEventId`

Inspect reconciliation runs:

```powershell
curl.exe "http://localhost:3000/api/ops/reconciliation/runs?limit=20"
```

If a run exists, inspect its issues by replacing `<RUN_ID>`:

```powershell
curl.exe "http://localhost:3000/api/ops/reconciliation/runs/<RUN_ID>/issues?limit=20"
```

## 12. Verify Domain Error Codes

The insufficient funds request from step 9 should include a stable domain error code:

```text
INSUFFICIENT_FUNDS
```

The idempotency conflict request from step 8 should include:

```text
IDEMPOTENCY_PAYLOAD_MISMATCH
```

## Acceptance Criteria

- account balances match expected values after deposit and transfer
- each money movement has a transaction record
- each successful transaction has balanced ledger entries
- retrying with the same idempotency key does not duplicate the transaction
- retrying with the same idempotency key but different payload returns `409`
- insufficient funds do not create partial money movement
- webhook events are emitted asynchronously through the outbox path
- read-only ops endpoints expose outbox, webhook delivery, and reconciliation state
- domain errors include stable `code` values



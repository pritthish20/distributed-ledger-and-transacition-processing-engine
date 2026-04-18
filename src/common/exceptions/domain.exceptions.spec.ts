import { HttpException } from '@nestjs/common';
import {
  AccountInactiveException,
  AccountNotFoundException,
  CurrencyMismatchException,
  IdempotencyPayloadMismatchException,
  InsufficientFundsException,
  SameAccountTransferException,
  TransactionNotFoundException,
  UnbalancedLedgerEntriesException,
} from './domain.exceptions';

describe('domain exceptions', () => {
  it.each([
    [new AccountNotFoundException('account-1'), 404, 'ACCOUNT_NOT_FOUND'],
    [new TransactionNotFoundException('txn-1'), 404, 'TRANSACTION_NOT_FOUND'],
    [new AccountInactiveException('account-1'), 400, 'ACCOUNT_INACTIVE'],
    [new CurrencyMismatchException('INR', 'USD'), 400, 'CURRENCY_MISMATCH'],
    [new InsufficientFundsException(100, 500), 400, 'INSUFFICIENT_FUNDS'],
    [new SameAccountTransferException('account-1'), 400, 'SAME_ACCOUNT_TRANSFER'],
    [new IdempotencyPayloadMismatchException(), 409, 'IDEMPOTENCY_PAYLOAD_MISMATCH'],
    [new UnbalancedLedgerEntriesException(100, 50), 500, 'LEDGER_ENTRIES_UNBALANCED'],
  ])('returns a stable error code for %s', (error, statusCode, code) => {
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(statusCode);
    expect(error.getResponse()).toEqual(
      expect.objectContaining({
        code,
      }),
    );
  });
});

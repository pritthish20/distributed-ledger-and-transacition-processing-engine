import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

function response(message: string, code: string, details?: Record<string, unknown>) {
  return {
    message,
    code,
    ...(details ? { details } : {}),
  };
}

export class AccountNotFoundException extends NotFoundException {
  constructor(accountId: string) {
    super(response(`Account ${accountId} not found`, 'ACCOUNT_NOT_FOUND', { accountId }));
  }
}

export class AccountsNotFoundException extends NotFoundException {
  constructor(accountIds: string[]) {
    super(response('Both accounts must exist', 'ACCOUNTS_NOT_FOUND', { accountIds }));
  }
}

export class TransactionNotFoundException extends NotFoundException {
  constructor(transactionId: string) {
    super(
      response(`Transaction ${transactionId} not found`, 'TRANSACTION_NOT_FOUND', {
        transactionId,
      }),
    );
  }
}

export class AccountInactiveException extends BadRequestException {
  constructor(accountId: string) {
    super(response(`Account ${accountId} is not active`, 'ACCOUNT_INACTIVE', { accountId }));
  }
}

export class CurrencyMismatchException extends BadRequestException {
  constructor(expectedCurrency: string, actualCurrency: string) {
    super(
      response('Currency mismatch', 'CURRENCY_MISMATCH', {
        expectedCurrency,
        actualCurrency,
      }),
    );
  }
}

export class InsufficientFundsException extends BadRequestException {
  constructor(balance: number, amount: number) {
    super(response('Insufficient balance', 'INSUFFICIENT_FUNDS', { balance, amount }));
  }
}

export class SameAccountTransferException extends BadRequestException {
  constructor(accountId: string) {
    super(
      response('Source and destination accounts must be different', 'SAME_ACCOUNT_TRANSFER', {
        accountId,
      }),
    );
  }
}

export class IdempotencyKeyRequiredException extends ConflictException {
  constructor() {
    super(response('Idempotency-Key header is required', 'IDEMPOTENCY_KEY_REQUIRED'));
  }
}

export class IdempotencyKeyProcessingException extends ConflictException {
  constructor() {
    super(
      response(
        'A request with this idempotency key is already being processed',
        'IDEMPOTENCY_KEY_PROCESSING',
      ),
    );
  }
}

export class IdempotencyPayloadMismatchException extends ConflictException {
  constructor() {
    super(
      response(
        'Idempotency key has already been used with a different payload',
        'IDEMPOTENCY_PAYLOAD_MISMATCH',
      ),
    );
  }
}

export class UnbalancedLedgerEntriesException extends InternalServerErrorException {
  constructor(debits: number, credits: number) {
    super(response('Ledger entries are not balanced', 'LEDGER_ENTRIES_UNBALANCED', { debits, credits }));
  }
}

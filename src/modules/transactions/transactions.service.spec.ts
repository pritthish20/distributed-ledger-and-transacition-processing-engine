import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  InsufficientFundsException,
  SameAccountTransferException,
} from '../../common/exceptions/domain.exceptions';
import { AccountEntity } from '../accounts/entities/account.entity';
import { AccountStatus } from '../accounts/enums/account-status.enum';
import { LedgerEntryType } from '../ledger/enums/ledger-entry-type.enum';
import { LedgerService } from '../ledger/ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  const dataSource = {
    transaction: jest.fn(),
  };
  const ledgerService = {
    createEntries: jest.fn(),
  };
  const outboxService = {
    createTransactionCompletedEventInManager: jest.fn(),
  };
  const transactionsRepository = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: transactionsRepository,
        },
        {
          provide: LedgerService,
          useValue: ledgerService,
        },
        {
          provide: OutboxService,
          useValue: outboxService,
        },
      ],
    }).compile();

    service = module.get(TransactionsService);
  });

  it('rejects transfers to the same account before opening a transaction', async () => {
    await expect(
      service.transfer({
        fromAccountId: 'account-1',
        toAccountId: 'account-1',
        amount: 100,
        currency: 'INR',
      }),
    ).rejects.toBeInstanceOf(SameAccountTransferException);
  });

  it('deposits funds with a balanced ledger and outbox event', async () => {
    const account = createAccount({ id: 'account-1', balance: 1000 });
    const manager = createManager({
      findOne: jest.fn().mockResolvedValue(account),
      save: jest.fn(async (entity, value) => {
        if (entity === TransactionEntity && !Array.isArray(value)) {
          return {
            id: value.id ?? 'txn-deposit-1',
            ...value,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          };
        }

        return value;
      }),
      create: jest.fn((_entity, value) => value),
    });
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    const result = await service.deposit({
      accountId: 'account-1',
      amount: 500,
      currency: 'INR',
    });

    expect(account.balance).toBe(1500);
    expect(ledgerService.createEntries).toHaveBeenCalledWith(manager, [
      {
        transactionId: 'txn-deposit-1',
        accountId: 'account-1',
        entryType: LedgerEntryType.CREDIT,
        amount: 500,
        currency: 'INR',
      },
      {
        transactionId: 'txn-deposit-1',
        accountId: null,
        ledgerAccount: 'external_settlement',
        entryType: LedgerEntryType.DEBIT,
        amount: 500,
        currency: 'INR',
      },
    ]);
    expect(outboxService.createTransactionCompletedEventInManager).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'txn-deposit-1',
      type: TransactionType.DEPOSIT,
      status: TransactionStatus.COMPLETED,
      amount: 500,
      currency: 'INR',
      toAccountId: 'account-1',
    });
  });

  it('rejects withdrawals with insufficient funds before creating ledger entries', async () => {
    const account = createAccount({ id: 'account-1', balance: 100 });
    const manager = createManager({
      findOne: jest.fn().mockResolvedValue(account),
    });
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    await expect(
      service.withdraw({
        accountId: 'account-1',
        amount: 500,
        currency: 'INR',
      }),
    ).rejects.toBeInstanceOf(InsufficientFundsException);

    expect(account.balance).toBe(100);
    expect(ledgerService.createEntries).not.toHaveBeenCalled();
    expect(outboxService.createTransactionCompletedEventInManager).not.toHaveBeenCalled();
  });

  it('transfers funds between two accounts atomically in the transaction callback', async () => {
    const fromAccount = createAccount({ id: 'from-account', balance: 1000 });
    const toAccount = createAccount({ id: 'to-account', balance: 200 });
    const manager = createManager({
      find: jest.fn().mockResolvedValue([fromAccount, toAccount]),
      save: jest.fn(async (entity, value) => {
        if (entity === TransactionEntity && !Array.isArray(value)) {
          return {
            id: value.id ?? 'txn-transfer-1',
            ...value,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          };
        }

        return value;
      }),
      create: jest.fn((_entity, value) => value),
    });
    dataSource.transaction.mockImplementation((callback) => callback(manager));

    const result = await service.transfer({
      fromAccountId: 'from-account',
      toAccountId: 'to-account',
      amount: 400,
      currency: 'INR',
    });

    expect(fromAccount.balance).toBe(600);
    expect(toAccount.balance).toBe(600);
    expect(ledgerService.createEntries).toHaveBeenCalledWith(manager, [
      {
        transactionId: 'txn-transfer-1',
        accountId: 'from-account',
        entryType: LedgerEntryType.DEBIT,
        amount: 400,
        currency: 'INR',
      },
      {
        transactionId: 'txn-transfer-1',
        accountId: 'to-account',
        entryType: LedgerEntryType.CREDIT,
        amount: 400,
        currency: 'INR',
      },
    ]);
    expect(outboxService.createTransactionCompletedEventInManager).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      id: 'txn-transfer-1',
      type: TransactionType.TRANSFER,
      status: TransactionStatus.COMPLETED,
      amount: 400,
      fromAccountId: 'from-account',
      toAccountId: 'to-account',
    });
  });
});

function createAccount(overrides: Partial<AccountEntity>): AccountEntity {
  return {
    id: 'account-1',
    balance: 0,
    currency: 'INR',
    status: AccountStatus.ACTIVE,
    ledgerEntries: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createManager(overrides: Record<string, jest.Mock> = {}) {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn((_entity, value) => value),
    create: jest.fn((_entity, value) => value),
    ...overrides,
  };
}

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AccountNotFoundException } from '../../common/exceptions/domain.exceptions';
import { LedgerEntryType } from '../ledger/enums/ledger-entry-type.enum';
import { LedgerService } from '../ledger/ledger.service';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { AccountEntity } from './entities/account.entity';
import { AccountStatus } from './enums/account-status.enum';
import { AccountsService } from './accounts.service';

describe('AccountsService', () => {
  let service: AccountsService;
  const accountsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };
  const ledgerService = {
    getAccountStatement: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: accountsRepository,
        },
        {
          provide: LedgerService,
          useValue: ledgerService,
        },
      ],
    }).compile();

    service = module.get(AccountsService);
  });

  it('creates an active account with zero starting balance by default', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    accountsRepository.create.mockReturnValue({
      currency: 'INR',
      status: AccountStatus.ACTIVE,
      balance: 0,
    });
    accountsRepository.save.mockResolvedValue({
      id: 'account-1',
      currency: 'INR',
      status: AccountStatus.ACTIVE,
      balance: 0,
      createdAt,
    });

    const result = await service.createAccount({ currency: 'INR' });

    expect(accountsRepository.create).toHaveBeenCalledWith({
      currency: 'INR',
      status: AccountStatus.ACTIVE,
      balance: 0,
    });
    expect(result).toEqual({
      id: 'account-1',
      currency: 'INR',
      balance: 0,
      status: AccountStatus.ACTIVE,
      createdAt,
    });
  });

  it('returns balance for an existing account', async () => {
    const updatedAt = new Date('2026-01-01T00:00:00.000Z');
    accountsRepository.findOne.mockResolvedValue({
      id: 'account-1',
      currency: 'INR',
      balance: 500,
      status: AccountStatus.ACTIVE,
      updatedAt,
    });

    await expect(service.getBalance('account-1')).resolves.toEqual({
      accountId: 'account-1',
      currency: 'INR',
      balance: 500,
      status: AccountStatus.ACTIVE,
      updatedAt,
    });
  });

  it('throws when account balance is requested for a missing account', async () => {
    accountsRepository.findOne.mockResolvedValue(null);

    await expect(service.getBalance('missing-account')).rejects.toBeInstanceOf(AccountNotFoundException);
  });

  it('returns a ledger-backed account statement', async () => {
    accountsRepository.findOne.mockResolvedValue({
      id: 'account-1',
      currency: 'INR',
    });
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    ledgerService.getAccountStatement.mockResolvedValue([
      {
        id: 'entry-1',
        transactionId: 'txn-1',
        entryType: LedgerEntryType.CREDIT,
        amount: 1000,
        currency: 'INR',
        createdAt,
        transaction: {
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.COMPLETED,
          description: 'initial deposit',
        },
      },
    ]);

    await expect(service.getStatement('account-1', { limit: 10 })).resolves.toEqual({
      accountId: 'account-1',
      currency: 'INR',
      entries: [
        {
          id: 'entry-1',
          transactionId: 'txn-1',
          entryType: LedgerEntryType.CREDIT,
          amount: 1000,
          currency: 'INR',
          createdAt,
          transactionType: TransactionType.DEPOSIT,
          transactionStatus: TransactionStatus.COMPLETED,
          description: 'initial deposit',
        },
      ],
    });
    expect(ledgerService.getAccountStatement).toHaveBeenCalledWith('account-1', 10);
  });
});

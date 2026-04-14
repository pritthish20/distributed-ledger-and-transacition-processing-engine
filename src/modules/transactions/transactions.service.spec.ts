import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AccountEntity } from '../accounts/entities/account.entity';
import { LedgerService } from '../ledger/ledger.service';
import { OutboxService } from '../outbox/outbox.service';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionsService } from './transactions.service';

describe('TransactionsService', () => {
  let service: TransactionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AccountEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(TransactionEntity),
          useValue: {},
        },
        {
          provide: LedgerService,
          useValue: {},
        },
        {
          provide: OutboxService,
          useValue: {},
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
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

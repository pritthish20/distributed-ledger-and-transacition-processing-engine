import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnbalancedLedgerEntriesException } from '../../common/exceptions/domain.exceptions';
import { LedgerEntryEntity } from './entities/ledger-entry.entity';
import { LedgerService } from './ledger.service';
import { LedgerEntryType } from './enums/ledger-entry-type.enum';

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: getRepositoryToken(LedgerEntryEntity),
          useValue: {
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(LedgerService);
  });

  it('rejects unbalanced ledger entries', async () => {
    await expect(
      service.createEntries(
        {
          save: jest.fn(),
        } as never,
        [
          {
            transactionId: 'txn-1',
            accountId: 'acc-1',
            entryType: LedgerEntryType.DEBIT,
            amount: 100,
            currency: 'INR',
          },
        ],
      ),
    ).rejects.toBeInstanceOf(UnbalancedLedgerEntriesException);
  });

  it('persists balanced ledger entries', async () => {
    const save = jest.fn().mockResolvedValue([{ id: 'entry-1' }]);

    await service.createEntries(
      {
        save,
      } as never,
      [
        {
          transactionId: 'txn-1',
          accountId: 'acc-1',
          entryType: LedgerEntryType.DEBIT,
          amount: 100,
          currency: 'INR',
        },
        {
          transactionId: 'txn-1',
          accountId: 'acc-2',
          entryType: LedgerEntryType.CREDIT,
          amount: 100,
          currency: 'INR',
        },
      ],
    );

    expect(save).toHaveBeenCalledTimes(1);
  });
});

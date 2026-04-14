import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionStatus } from '../transactions/enums/transaction-status.enum';
import { TransactionType } from '../transactions/enums/transaction-type.enum';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { OutboxStatus } from './enums/outbox-status.enum';
import { OutboxService } from './outbox.service';

describe('OutboxService', () => {
  let service: OutboxService;
  const repository = {
    create: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        {
          provide: getRepositoryToken(OutboxEventEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(OutboxService);
  });

  it('creates a transaction.completed event using the provided transaction payload', async () => {
    const manager = {
      save: jest.fn().mockResolvedValue({ id: 'event-1' }),
    };
    repository.create.mockImplementation((value) => value);
    const completedAt = new Date('2026-01-01T00:00:00.000Z');

    await service.createTransactionCompletedEventInManager(
      manager as never,
      {
        id: 'txn-1',
        type: TransactionType.TRANSFER,
        status: TransactionStatus.COMPLETED,
        amount: 100,
        currency: 'INR',
        fromAccountId: 'from-account',
        toAccountId: 'to-account',
        description: null,
        errorCode: null,
        completedAt,
        createdAt: completedAt,
        updatedAt: completedAt,
        fromAccount: null,
        toAccount: null,
        ledgerEntries: [],
        outboxEvents: [],
        idempotencyRecord: null,
      },
    );

    expect(manager.save).toHaveBeenCalledWith(
      OutboxEventEntity,
      expect.objectContaining({
        aggregateType: 'transaction',
        aggregateId: 'txn-1',
        transactionId: 'txn-1',
        eventType: 'transaction.completed',
        status: OutboxStatus.PENDING,
        payload: expect.objectContaining({
          transactionId: 'txn-1',
          amount: 100,
          currency: 'INR',
        }),
      }),
    );
  });

  it('fetches pending events in creation order', async () => {
    repository.find.mockResolvedValue([{ id: 'event-1' }]);

    await expect(service.getPendingEvents(10)).resolves.toEqual([{ id: 'event-1' }]);

    expect(repository.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { createdAt: 'ASC' },
        take: 10,
      }),
    );
  });

  it('marks an event as processing', async () => {
    await service.markProcessing('event-1');

    expect(repository.update).toHaveBeenCalledWith('event-1', {
      status: OutboxStatus.PROCESSING,
    });
  });

  it('marks an event as published', async () => {
    await service.markPublished('event-1');

    expect(repository.update).toHaveBeenCalledWith('event-1', {
      status: OutboxStatus.PUBLISHED,
      publishedAt: expect.any(Date),
    });
  });

  it('marks an event as failed when there is no next retry', async () => {
    await service.markFailed('event-1', 5, null);

    expect(repository.update).toHaveBeenCalledWith('event-1', {
      status: OutboxStatus.FAILED,
      retryCount: 5,
      nextRetryAt: null,
    });
  });
});

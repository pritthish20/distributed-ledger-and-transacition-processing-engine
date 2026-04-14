import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createPayloadHash } from '../../common/utils/hash.util';
import { IdempotencyRecordEntity } from './entities/idempotency-record.entity';
import { IdempotencyStatus } from './enums/idempotency-status.enum';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  let service: IdempotencyService;
  const repository = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: getRepositoryToken(IdempotencyRecordEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get(IdempotencyService);
  });

  it('replays a completed response for the same key and payload', async () => {
    repository.findOne.mockResolvedValue({
      requestHash: createPayloadHash({ amount: 100 }),
      status: IdempotencyStatus.COMPLETED,
      responseBody: { ok: true },
    });

    const result = await service.execute(
      'POST:/transactions/deposit',
      'same-key',
      { amount: 100 },
      jest.fn(),
    );

    expect(result).toEqual({ ok: true });
  });

  it('rejects reusing a key with a different payload', async () => {
    repository.findOne.mockResolvedValue({
      requestHash: createPayloadHash({ amount: 100 }),
      status: IdempotencyStatus.COMPLETED,
      responseBody: { ok: true },
    });

    await expect(
      service.execute(
        'POST:/transactions/deposit',
        'same-key',
        { amount: 200 },
        jest.fn(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a processing record and stores the successful response for a new request', async () => {
    repository.findOne.mockResolvedValue(null);
    repository.findOneOrFail.mockResolvedValue({
      id: 'idem-1',
      requestHash: createPayloadHash({ amount: 100 }),
      status: IdempotencyStatus.PROCESSING,
    });
    repository.insert.mockResolvedValue(undefined);
    repository.save.mockResolvedValue(undefined);

    const operation = jest.fn().mockResolvedValue({
      statusCode: 201,
      body: { id: 'txn-1', status: 'completed' },
      transactionId: 'txn-1',
    });

    const result = await service.execute(
      'POST:/transactions/deposit',
      'new-key',
      { amount: 100 },
      operation,
    );

    expect(repository.insert).toHaveBeenCalledWith({
      endpoint: 'POST:/transactions/deposit',
      idempotencyKey: 'new-key',
      requestHash: createPayloadHash({ amount: 100 }),
      status: IdempotencyStatus.PROCESSING,
    });
    expect(repository.save).toHaveBeenCalledWith({
      id: 'idem-1',
      status: IdempotencyStatus.COMPLETED,
      responseCode: 201,
      responseBody: { id: 'txn-1', status: 'completed' },
      transactionId: 'txn-1',
    });
    expect(result).toEqual({ id: 'txn-1', status: 'completed' });
  });
});

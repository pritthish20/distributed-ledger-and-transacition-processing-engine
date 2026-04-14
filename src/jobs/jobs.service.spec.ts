import { JobsService } from './jobs.service';

describe('JobsService', () => {
  let service: JobsService;
  const outboxService = {
    getProcessableEvents: jest.fn(),
    markProcessing: jest.fn(),
    markFailed: jest.fn(),
  };
  const webhooksService = {
    dispatchOutboxEvent: jest.fn(),
  };
  const reconciliationService = {
    runReconciliation: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, number> = {
        'queue.outboxBatchSize': 20,
        'queue.outboxBackoffMs': 1000,
        'queue.outboxMaxAttempts': 3,
        'queue.outboxPollIntervalMs': 5000,
        'queue.outboxStaleAfterMs': 30000,
        'queue.reconciliationIntervalMs': 60000,
      };

      return values[key];
    });

    service = new JobsService(
      outboxService as never,
      webhooksService as never,
      reconciliationService as never,
      configService as never,
    );
  });

  it('does not overlap outbox batch processing', async () => {
    let releaseBatch!: () => void;
    outboxService.getProcessableEvents.mockReturnValueOnce(
      new Promise((resolve) => {
        releaseBatch = () => resolve([]);
      }),
    );

    const firstRun = service.processOutboxBatch();
    await Promise.resolve();
    await service.processOutboxBatch();
    releaseBatch();
    await firstRun;

    expect(outboxService.getProcessableEvents).toHaveBeenCalledTimes(1);
  });

  it('retries a failed outbox event and continues processing the batch', async () => {
    const loggerSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);
    outboxService.getProcessableEvents.mockResolvedValue([
      { id: 'event-1', retryCount: 0 },
      { id: 'event-2', retryCount: 0 },
    ]);
    webhooksService.dispatchOutboxEvent
      .mockRejectedValueOnce(new Error('dispatch failed'))
      .mockResolvedValueOnce(undefined);

    await service.processOutboxBatch();

    expect(outboxService.markProcessing).toHaveBeenCalledWith('event-1');
    expect(outboxService.markProcessing).toHaveBeenCalledWith('event-2');
    expect(outboxService.markFailed).toHaveBeenCalledWith(
      'event-1',
      1,
      expect.any(Date),
    );
    expect(webhooksService.dispatchOutboxEvent).toHaveBeenCalledWith('event-2');
    loggerSpy.mockRestore();
  });
});

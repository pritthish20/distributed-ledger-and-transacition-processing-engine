import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { OutboxStatus } from '../outbox/enums/outbox-status.enum';
import { ReconciliationIssueEntity } from '../reconciliation/entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from '../reconciliation/entities/reconciliation-run.entity';
import { ReconciliationIssueType } from '../reconciliation/enums/reconciliation-issue-type.enum';
import { ReconciliationRunStatus } from '../reconciliation/enums/reconciliation-run-status.enum';
import { WebhookDeliveryEntity } from '../webhooks/entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../webhooks/enums/webhook-delivery-status.enum';
import { OpsService } from './ops.service';

describe('OpsService', () => {
  let service: OpsService;
  const outboxEventsRepository = { find: jest.fn() };
  const webhookDeliveriesRepository = { find: jest.fn() };
  const reconciliationRunsRepository = { find: jest.fn() };
  const reconciliationIssuesRepository = { find: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpsService,
        {
          provide: getRepositoryToken(OutboxEventEntity),
          useValue: outboxEventsRepository,
        },
        {
          provide: getRepositoryToken(WebhookDeliveryEntity),
          useValue: webhookDeliveriesRepository,
        },
        {
          provide: getRepositoryToken(ReconciliationRunEntity),
          useValue: reconciliationRunsRepository,
        },
        {
          provide: getRepositoryToken(ReconciliationIssueEntity),
          useValue: reconciliationIssuesRepository,
        },
      ],
    }).compile();

    service = module.get(OpsService);
  });

  it('filters outbox events by status and event type with pagination', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    outboxEventsRepository.find.mockResolvedValue([
      {
        id: 'event-1',
        aggregateType: 'transaction',
        aggregateId: 'txn-1',
        eventType: 'transaction.completed',
        status: OutboxStatus.FAILED,
        retryCount: 3,
        nextRetryAt: null,
        publishedAt: null,
        transactionId: 'txn-1',
        createdAt,
        updatedAt: createdAt,
      },
    ]);

    const result = await service.listOutboxEvents({
      status: OutboxStatus.FAILED,
      eventType: 'transaction.completed',
      limit: 10,
      offset: 5,
    });

    expect(outboxEventsRepository.find).toHaveBeenCalledWith({
      where: {
        status: OutboxStatus.FAILED,
        eventType: 'transaction.completed',
      },
      order: { createdAt: 'DESC' },
      take: 10,
      skip: 5,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'event-1',
        status: OutboxStatus.FAILED,
      }),
    ]);
  });

  it('filters webhook deliveries by status and identifiers', async () => {
    webhookDeliveriesRepository.find.mockResolvedValue([
      {
        id: 'delivery-1',
        webhookSubscriptionId: 'subscription-1',
        outboxEventId: 'event-1',
        status: WebhookDeliveryStatus.SUCCESS,
        attemptCount: 1,
        lastAttemptAt: null,
        nextRetryAt: null,
        responseStatus: 200,
        responseBody: 'ok',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.listWebhookDeliveries({
      status: WebhookDeliveryStatus.SUCCESS,
      outboxEventId: 'event-1',
      webhookSubscriptionId: 'subscription-1',
    });

    expect(webhookDeliveriesRepository.find).toHaveBeenCalledWith({
      where: {
        status: WebhookDeliveryStatus.SUCCESS,
        outboxEventId: 'event-1',
        webhookSubscriptionId: 'subscription-1',
      },
      order: { createdAt: 'DESC' },
      take: 20,
      skip: 0,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'delivery-1',
        responseStatus: 200,
      }),
    ]);
  });

  it('lists reconciliation runs and issues', async () => {
    reconciliationRunsRepository.find.mockResolvedValue([
      {
        id: 'run-1',
        status: ReconciliationRunStatus.COMPLETED,
        totalIssues: 2,
        errorMessage: null,
        startedAt: new Date('2026-01-01T00:00:00.000Z'),
        completedAt: new Date('2026-01-01T00:00:01.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);
    reconciliationIssuesRepository.find.mockResolvedValue([
      {
        id: 'issue-1',
        runId: 'run-1',
        issueType: ReconciliationIssueType.ACCOUNT_BALANCE_MISMATCH,
        referenceId: 'account-1',
        details: { accountBalance: 100, ledgerBalance: 0 },
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    ]);

    await expect(
      service.listReconciliationRuns({ status: ReconciliationRunStatus.COMPLETED }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'run-1',
        totalIssues: 2,
      }),
    ]);
    await expect(
      service.listReconciliationIssues('run-1', {
        issueType: ReconciliationIssueType.ACCOUNT_BALANCE_MISMATCH,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'issue-1',
        referenceId: 'account-1',
      }),
    ]);

    expect(reconciliationRunsRepository.find).toHaveBeenCalledWith({
      where: { status: ReconciliationRunStatus.COMPLETED },
      order: { createdAt: 'DESC' },
      take: 20,
      skip: 0,
    });
    expect(reconciliationIssuesRepository.find).toHaveBeenCalledWith({
      where: {
        runId: 'run-1',
        issueType: ReconciliationIssueType.ACCOUNT_BALANCE_MISMATCH,
      },
      order: { createdAt: 'DESC' },
      take: 20,
      skip: 0,
    });
  });
});

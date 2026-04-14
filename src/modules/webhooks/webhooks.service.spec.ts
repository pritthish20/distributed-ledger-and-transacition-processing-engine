import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { WEBHOOK_DELIVERY_QUEUE } from '../../common/constants/queue.constants';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { OutboxService } from '../outbox/outbox.service';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { WebhookSubscriptionEntity } from './entities/webhook-subscription.entity';
import { WebhookDeliveryStatus } from './enums/webhook-delivery-status.enum';
import { WebhookSubscriptionStatus } from './enums/webhook-subscription-status.enum';
import { WebhooksService } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  const subscriptionsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };
  const deliveriesRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };
  const outboxRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const webhookQueue = {
    add: jest.fn(),
  };
  const outboxService = {
    markPublished: jest.fn(),
    markFailed: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    subscriptionsRepository.create.mockImplementation((value) => value);
    deliveriesRepository.create.mockImplementation((value) => value);
    configService.get.mockImplementation((key: string) => {
      if (key === 'queue.webhookMaxAttempts') return 3;
      if (key === 'queue.webhookBackoffMs') return 1000;
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        {
          provide: getRepositoryToken(WebhookSubscriptionEntity),
          useValue: subscriptionsRepository,
        },
        {
          provide: getRepositoryToken(WebhookDeliveryEntity),
          useValue: deliveriesRepository,
        },
        {
          provide: getRepositoryToken(OutboxEventEntity),
          useValue: outboxRepository,
        },
        {
          provide: getQueueToken(WEBHOOK_DELIVERY_QUEUE),
          useValue: webhookQueue,
        },
        {
          provide: OutboxService,
          useValue: outboxService,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get(WebhooksService);
  });

  it('registers a webhook subscription as active by default', async () => {
    subscriptionsRepository.save.mockResolvedValue({
      id: 'subscription-1',
      targetUrl: 'https://merchant.example/webhook',
      eventType: 'transaction.completed',
      status: WebhookSubscriptionStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });

    const result = await service.registerWebhook({
      targetUrl: 'https://merchant.example/webhook',
      eventType: 'transaction.completed',
      secret: 'super-secret',
    });

    expect(subscriptionsRepository.create).toHaveBeenCalledWith({
      targetUrl: 'https://merchant.example/webhook',
      eventType: 'transaction.completed',
      secret: 'super-secret',
      status: WebhookSubscriptionStatus.ACTIVE,
    });
    expect(result).toMatchObject({
      id: 'subscription-1',
      targetUrl: 'https://merchant.example/webhook',
      eventType: 'transaction.completed',
      status: WebhookSubscriptionStatus.ACTIVE,
    });
  });

  it('marks outbox event published when no subscriptions match', async () => {
    outboxRepository.findOne.mockResolvedValue({
      id: 'event-1',
      eventType: 'transaction.completed',
    });
    subscriptionsRepository.find.mockResolvedValue([]);

    await service.dispatchOutboxEvent('event-1');

    expect(outboxService.markPublished).toHaveBeenCalledWith('event-1');
    expect(deliveriesRepository.save).not.toHaveBeenCalled();
  });

  it('creates delivery rows and enqueues jobs for matching subscriptions', async () => {
    outboxRepository.findOne.mockResolvedValue({
      id: 'event-1',
      eventType: 'transaction.completed',
    });
    subscriptionsRepository.find.mockResolvedValue([
      {
        id: 'subscription-1',
        eventType: 'transaction.completed',
      },
    ]);
    deliveriesRepository.save.mockResolvedValue([
      {
        id: 'delivery-1',
      },
    ]);

    await service.dispatchOutboxEvent('event-1');

    expect(deliveriesRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        webhookSubscriptionId: 'subscription-1',
        outboxEventId: 'event-1',
        status: WebhookDeliveryStatus.PENDING,
      }),
    ]);
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'deliver-webhook',
      { deliveryId: 'delivery-1' },
      expect.objectContaining({
        jobId: 'delivery-1-attempt-1',
      }),
    );
  });

  it('marks successful webhook delivery and publishes completed outbox event', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: jest.fn().mockResolvedValue('ok'),
    }) as jest.Mock;
    deliveriesRepository.findOne.mockResolvedValue({
      id: 'delivery-1',
      outboxEventId: 'event-1',
      attemptCount: 0,
      subscription: {
        targetUrl: 'https://merchant.example/webhook',
        secret: 'super-secret',
      },
      outboxEvent: {
        eventType: 'transaction.completed',
        payload: { transactionId: 'txn-1' },
      },
    });
    deliveriesRepository.find.mockResolvedValue([
      {
        status: WebhookDeliveryStatus.SUCCESS,
        attemptCount: 1,
      },
    ]);

    await service.processDelivery('delivery-1');

    expect(deliveriesRepository.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.SUCCESS,
        attemptCount: 1,
        responseStatus: 200,
      }),
    );
    expect(outboxService.markPublished).toHaveBeenCalledWith('event-1');
  });

  it('retries failed webhook delivery before max attempts', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: jest.fn().mockResolvedValue('failed'),
    }) as jest.Mock;
    deliveriesRepository.findOne.mockResolvedValue({
      id: 'delivery-1',
      outboxEventId: 'event-1',
      attemptCount: 0,
      subscription: {
        targetUrl: 'https://merchant.example/webhook',
        secret: 'super-secret',
      },
      outboxEvent: {
        eventType: 'transaction.completed',
        payload: { transactionId: 'txn-1' },
      },
    });
    deliveriesRepository.find.mockResolvedValue([
      {
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 1,
      },
    ]);

    await service.processDelivery('delivery-1');

    expect(deliveriesRepository.update).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 1,
        nextRetryAt: expect.any(Date),
      }),
    );
    expect(webhookQueue.add).toHaveBeenCalledWith(
      'deliver-webhook',
      { deliveryId: 'delivery-1' },
      expect.objectContaining({
        jobId: 'delivery-1-attempt-2',
      }),
    );
  });
});

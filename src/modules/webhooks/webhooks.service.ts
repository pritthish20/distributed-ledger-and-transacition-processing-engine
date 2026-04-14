import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { WEBHOOK_DELIVERY_QUEUE } from '../../common/constants/queue.constants';
import { signWebhookPayload } from '../../common/utils/hash.util';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { OutboxStatus } from '../outbox/enums/outbox-status.enum';
import { OutboxService } from '../outbox/outbox.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { WebhookSubscriptionEntity } from './entities/webhook-subscription.entity';
import { WebhookDeliveryStatus } from './enums/webhook-delivery-status.enum';
import { WebhookSubscriptionStatus } from './enums/webhook-subscription-status.enum';

@Injectable()
export class WebhooksService {
  constructor(
    @InjectRepository(WebhookSubscriptionEntity)
    private readonly subscriptionsRepository: Repository<WebhookSubscriptionEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly deliveriesRepository: Repository<WebhookDeliveryEntity>,
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>,
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly webhookQueue: Queue,
    private readonly outboxService: OutboxService,
    private readonly configService: ConfigService,
  ) {}

  async registerWebhook(dto: RegisterWebhookDto) {
    const subscription = this.subscriptionsRepository.create({
      targetUrl: dto.targetUrl,
      eventType: dto.eventType,
      secret: dto.secret,
      status: dto.status ?? WebhookSubscriptionStatus.ACTIVE,
    });

    const savedSubscription = await this.subscriptionsRepository.save(subscription);

    return {
      id: savedSubscription.id,
      targetUrl: savedSubscription.targetUrl,
      eventType: savedSubscription.eventType,
      status: savedSubscription.status,
      createdAt: savedSubscription.createdAt,
    };
  }

  async dispatchOutboxEvent(eventId: string) {
    const event = await this.outboxRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      return;
    }

    const subscriptions = await this.subscriptionsRepository.find({
      where: {
        eventType: event.eventType,
        status: WebhookSubscriptionStatus.ACTIVE,
      },
    });

    if (subscriptions.length === 0) {
      await this.outboxService.markPublished(event.id);
      return;
    }

    const deliveries = await this.deliveriesRepository.save(
      subscriptions.map((subscription) =>
        this.deliveriesRepository.create({
          webhookSubscriptionId: subscription.id,
          outboxEventId: event.id,
          status: WebhookDeliveryStatus.PENDING,
          attemptCount: 0,
          nextRetryAt: new Date(),
        }),
      ),
    );

    await Promise.all(
      deliveries.map((delivery) => this.enqueueDelivery(delivery.id, 0)),
    );
  }

  async processDelivery(deliveryId: string) {
    const delivery = await this.deliveriesRepository.findOne({
      where: { id: deliveryId },
      relations: {
        subscription: true,
        outboxEvent: true,
      },
    });

    if (!delivery) {
      return;
    }

    const attempts = delivery.attemptCount + 1;

    try {
      const payload = delivery.outboxEvent.payload;
      const signature = signWebhookPayload(payload, delivery.subscription.secret);
      const response = await fetch(delivery.subscription.targetUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-event': delivery.outboxEvent.eventType,
        },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.text();

      if (!response.ok) {
        throw new Error(`Webhook delivery failed with status ${response.status}: ${responseBody}`);
      }

      await this.deliveriesRepository.update(delivery.id, {
        status: WebhookDeliveryStatus.SUCCESS,
        attemptCount: attempts,
        lastAttemptAt: new Date(),
        nextRetryAt: null,
        responseStatus: response.status,
        responseBody,
      });
    } catch (error) {
      const maxAttempts = this.configService.get<number>('queue.webhookMaxAttempts') ?? 5;
      const backoffMs = this.configService.get<number>('queue.webhookBackoffMs') ?? 5000;
      const shouldRetry = attempts < maxAttempts;
      const nextRetryAt = shouldRetry
        ? new Date(Date.now() + backoffMs * 2 ** Math.max(attempts - 1, 0))
        : null;

      await this.deliveriesRepository.update(delivery.id, {
        status: shouldRetry ? WebhookDeliveryStatus.PENDING : WebhookDeliveryStatus.FAILED,
        attemptCount: attempts,
        lastAttemptAt: new Date(),
        nextRetryAt,
        responseStatus: null,
        responseBody: error instanceof Error ? error.message : 'Webhook delivery failed',
      });

      if (shouldRetry && nextRetryAt) {
        await this.enqueueDelivery(delivery.id, nextRetryAt.getTime() - Date.now());
      }
    }

    await this.updateOutboxStatus(delivery.outboxEventId);
  }

  private async updateOutboxStatus(outboxEventId: string) {
    const deliveries = await this.deliveriesRepository.find({
      where: { outboxEventId },
    });

    if (deliveries.length === 0) {
      await this.outboxService.markPublished(outboxEventId);
      return;
    }

    const hasPending = deliveries.some((delivery) => delivery.status === WebhookDeliveryStatus.PENDING);
    const allSuccessful = deliveries.every((delivery) => delivery.status === WebhookDeliveryStatus.SUCCESS);

    if (allSuccessful) {
      await this.outboxService.markPublished(outboxEventId);
      return;
    }

    if (!hasPending) {
      const maxRetryCount = Math.max(...deliveries.map((delivery) => delivery.attemptCount));
      await this.outboxService.markFailed(outboxEventId, maxRetryCount, null);
      return;
    }

    await this.outboxRepository.update(outboxEventId, {
      status: OutboxStatus.PROCESSING,
    });
  }

  private async enqueueDelivery(deliveryId: string, delayMs: number) {
    await this.webhookQueue.add(
      'deliver-webhook',
      { deliveryId },
      {
        jobId: deliveryId,
        delay: Math.max(delayMs, 0),
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}

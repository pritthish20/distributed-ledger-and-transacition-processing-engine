import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WEBHOOK_DELIVERY_QUEUE } from '../../common/constants/queue.constants';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { OutboxModule } from '../outbox/outbox.module';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { WebhookDeliveryEntity } from './entities/webhook-delivery.entity';
import { WebhookSubscriptionEntity } from './entities/webhook-subscription.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookSubscriptionEntity, WebhookDeliveryEntity, OutboxEventEntity]),
    BullModule.registerQueue({
      name: WEBHOOK_DELIVERY_QUEUE,
    }),
    OutboxModule,
    IdempotencyModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

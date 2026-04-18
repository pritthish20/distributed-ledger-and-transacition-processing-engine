import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { ReconciliationIssueEntity } from '../reconciliation/entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from '../reconciliation/entities/reconciliation-run.entity';
import { WebhookDeliveryEntity } from '../webhooks/entities/webhook-delivery.entity';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OutboxEventEntity,
      WebhookDeliveryEntity,
      ReconciliationRunEntity,
      ReconciliationIssueEntity,
    ]),
  ],
  controllers: [OpsController],
  providers: [OpsService],
})
export class OpsModule {}

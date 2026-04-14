import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { JobsService } from './jobs.service';
import { ConfigService } from '@nestjs/config';
import { OutboxModule } from '../modules/outbox/outbox.module';
import { ReconciliationModule } from '../modules/reconciliation/reconciliation.module';
import { WebhooksModule } from '../modules/webhooks/webhooks.module';
import { WebhookDeliveryProcessor } from './processors/webhook-delivery.processor';

@Module({
  imports:[
    BullModule.forRootAsync({
      inject:[ConfigService],
      useFactory:(configService:ConfigService)=>({
        connection:{
          host:configService.get<string>('redis.host'),
          port: configService.get<number>('redis.port'),
          password: configService.get<string>('redis.password'),
        },
      }),
    }),
    OutboxModule,
    WebhooksModule,
    ReconciliationModule,
  ],
  providers: [JobsService, WebhookDeliveryProcessor],
})
export class JobsModule {}

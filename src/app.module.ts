import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { JobsModule } from './jobs/jobs.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { HealthModule } from './modules/health/health.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';

@Module({
  imports: [ConfigModule, DatabaseModule, JobsModule, AccountsModule, TransactionsModule, LedgerModule, IdempotencyModule, OutboxModule, WebhooksModule, HealthModule, ReconciliationModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

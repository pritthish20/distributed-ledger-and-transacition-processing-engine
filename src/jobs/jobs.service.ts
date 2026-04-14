import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OutboxService } from '../modules/outbox/outbox.service';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import { WebhooksService } from '../modules/webhooks/webhooks.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private outboxInterval?: NodeJS.Timeout;
  private reconciliationInterval?: NodeJS.Timeout;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly webhooksService: WebhooksService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  onModuleInit() {
    this.outboxInterval = setInterval(() => {
      void this.processOutboxBatch();
    }, 5000);

    this.reconciliationInterval = setInterval(() => {
      void this.reconciliationService.runReconciliation();
    }, 60000);
  }

  onModuleDestroy() {
    if (this.outboxInterval) {
      clearInterval(this.outboxInterval);
    }

    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
    }
  }

  private async processOutboxBatch() {
    try {
      const events = await this.outboxService.getPendingEvents(20);

      for (const event of events) {
        await this.outboxService.markProcessing(event.id);
        await this.webhooksService.dispatchOutboxEvent(event.id);
      }
    } catch (error) {
      this.logger.error(
        'Outbox processing failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}

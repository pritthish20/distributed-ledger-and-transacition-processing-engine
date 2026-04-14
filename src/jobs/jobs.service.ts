import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OutboxService } from '../modules/outbox/outbox.service';
import { ReconciliationService } from '../modules/reconciliation/reconciliation.service';
import { WebhooksService } from '../modules/webhooks/webhooks.service';

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);
  private outboxInterval?: NodeJS.Timeout;
  private reconciliationInterval?: NodeJS.Timeout;
  private outboxRunning = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly webhooksService: WebhooksService,
    private readonly reconciliationService: ReconciliationService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit() {
    this.outboxInterval = setInterval(() => {
      void this.processOutboxBatch();
    }, this.configService.get<number>('queue.outboxPollIntervalMs') ?? 5000);

    this.reconciliationInterval = setInterval(() => {
      void this.reconciliationService.runReconciliation();
    }, this.configService.get<number>('queue.reconciliationIntervalMs') ?? 60000);
  }

  onModuleDestroy() {
    if (this.outboxInterval) {
      clearInterval(this.outboxInterval);
    }

    if (this.reconciliationInterval) {
      clearInterval(this.reconciliationInterval);
    }
  }

  async processOutboxBatch() {
    if (this.outboxRunning) {
      return;
    }

    this.outboxRunning = true;

    try {
      const batchSize = this.configService.get<number>('queue.outboxBatchSize') ?? 20;
      const staleAfterMs = this.configService.get<number>('queue.outboxStaleAfterMs') ?? 30000;
      const events = await this.outboxService.getProcessableEvents(
        batchSize,
        new Date(Date.now() - staleAfterMs),
      );

      for (const event of events) {
        try {
          await this.outboxService.markProcessing(event.id);
          await this.webhooksService.dispatchOutboxEvent(event.id);
        } catch (error) {
          await this.markOutboxEventForRetry(event.id, event.retryCount, error);
        }
      }
    } catch (error) {
      this.logger.error(
        'Outbox processing failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.outboxRunning = false;
    }
  }

  private async markOutboxEventForRetry(eventId: string, retryCount: number, error: unknown) {
    const nextRetryCount = retryCount + 1;
    const maxAttempts = this.configService.get<number>('queue.outboxMaxAttempts') ?? 5;
    const backoffMs = this.configService.get<number>('queue.outboxBackoffMs') ?? 5000;
    const nextRetryAt =
      nextRetryCount < maxAttempts
        ? new Date(Date.now() + backoffMs * 2 ** Math.max(nextRetryCount - 1, 0))
        : null;

    await this.outboxService.markFailed(eventId, nextRetryCount, nextRetryAt);
    this.logger.error(
      `Outbox event ${eventId} dispatch failed`,
      error instanceof Error ? error.stack : undefined,
    );
  }
}

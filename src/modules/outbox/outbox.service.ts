import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, LessThanOrEqual, Repository } from 'typeorm';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { OutboxEventEntity } from './entities/outbox-event.entity';
import { OutboxStatus } from './enums/outbox-status.enum';

@Injectable()
export class OutboxService {
  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly outboxRepository: Repository<OutboxEventEntity>,
  ) {}

  async createTransactionCompletedEventInManager(
    manager: EntityManager,
    transaction: TransactionEntity,
    payload?: Record<string, unknown>,
  ) {
    return manager.save(
      OutboxEventEntity,
      this.outboxRepository.create({
        aggregateType: 'transaction',
        aggregateId: transaction.id,
        transactionId: transaction.id,
        eventType: 'transaction.completed',
        payload:
          payload ?? {
            transactionId: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            fromAccountId: transaction.fromAccountId,
            toAccountId: transaction.toAccountId,
            completedAt: transaction.completedAt?.toISOString() ?? null,
          },
        status: OutboxStatus.PENDING,
      }),
    );
  }

  async getPendingEvents(limit = 20) {
    const staleBefore = new Date(Date.now() - 30000);

    return this.getProcessableEvents(limit, staleBefore);
  }

  async getProcessableEvents(limit = 20, staleBefore = new Date(Date.now() - 30000)) {
    return this.outboxRepository.find({
      where: [
        {
          status: OutboxStatus.PENDING,
          nextRetryAt: IsNull(),
        },
        {
          status: OutboxStatus.PENDING,
          nextRetryAt: LessThanOrEqual(new Date()),
        },
        {
          status: OutboxStatus.PROCESSING,
          updatedAt: LessThanOrEqual(staleBefore),
        },
      ],
      order: {
        createdAt: 'ASC',
      },
      take: limit,
    });
  }

  async markProcessing(eventId: string) {
    await this.outboxRepository.update(eventId, {
      status: OutboxStatus.PROCESSING,
    });
  }

  async markPublished(eventId: string) {
    await this.outboxRepository.update(eventId, {
      status: OutboxStatus.PUBLISHED,
      publishedAt: new Date(),
    });
  }

  async markFailed(eventId: string, retryCount: number, nextRetryAt: Date | null) {
    await this.outboxRepository.update(eventId, {
      status: nextRetryAt ? OutboxStatus.PENDING : OutboxStatus.FAILED,
      retryCount,
      nextRetryAt,
    });
  }

  async getById(eventId: string) {
    return this.outboxRepository.findOne({
      where: { id: eventId },
    });
  }
}

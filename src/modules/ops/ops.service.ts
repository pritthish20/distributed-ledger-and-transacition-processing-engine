import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { OutboxEventEntity } from '../outbox/entities/outbox-event.entity';
import { ReconciliationIssueEntity } from '../reconciliation/entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from '../reconciliation/entities/reconciliation-run.entity';
import { WebhookDeliveryEntity } from '../webhooks/entities/webhook-delivery.entity';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListReconciliationIssuesDto } from './dto/list-reconciliation-issues.dto';
import { ListReconciliationRunsDto } from './dto/list-reconciliation-runs.dto';
import { ListWebhookDeliveriesDto } from './dto/list-webhook-deliveries.dto';

@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);

  constructor(
    @InjectRepository(OutboxEventEntity)
    private readonly outboxEventsRepository: Repository<OutboxEventEntity>,
    @InjectRepository(WebhookDeliveryEntity)
    private readonly webhookDeliveriesRepository: Repository<WebhookDeliveryEntity>,
    @InjectRepository(ReconciliationRunEntity)
    private readonly reconciliationRunsRepository: Repository<ReconciliationRunEntity>,
    @InjectRepository(ReconciliationIssueEntity)
    private readonly reconciliationIssuesRepository: Repository<ReconciliationIssueEntity>,
  ) {}

  async listOutboxEvents(query: ListOutboxEventsDto) {
    const where: FindOptionsWhere<OutboxEventEntity> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    const rows = await this.outboxEventsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
    this.logger.log({
      message: 'Ops outbox events queried',
      status: query.status ?? null,
      eventType: query.eventType ?? null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      rowCount: rows.length,
    });

    return rows.map((row) => ({
      id: row.id,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      eventType: row.eventType,
      status: row.status,
      retryCount: row.retryCount,
      nextRetryAt: row.nextRetryAt,
      publishedAt: row.publishedAt,
      transactionId: row.transactionId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listWebhookDeliveries(query: ListWebhookDeliveriesDto) {
    const where: FindOptionsWhere<WebhookDeliveryEntity> = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.outboxEventId) {
      where.outboxEventId = query.outboxEventId;
    }

    if (query.webhookSubscriptionId) {
      where.webhookSubscriptionId = query.webhookSubscriptionId;
    }

    const rows = await this.webhookDeliveriesRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
    this.logger.log({
      message: 'Ops webhook deliveries queried',
      status: query.status ?? null,
      outboxEventId: query.outboxEventId ?? null,
      webhookSubscriptionId: query.webhookSubscriptionId ?? null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      rowCount: rows.length,
    });

    return rows.map((row) => ({
      id: row.id,
      webhookSubscriptionId: row.webhookSubscriptionId,
      outboxEventId: row.outboxEventId,
      status: row.status,
      attemptCount: row.attemptCount,
      lastAttemptAt: row.lastAttemptAt,
      nextRetryAt: row.nextRetryAt,
      responseStatus: row.responseStatus,
      responseBody: row.responseBody,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  async listReconciliationRuns(query: ListReconciliationRunsDto) {
    const where: FindOptionsWhere<ReconciliationRunEntity> = {};

    if (query.status) {
      where.status = query.status;
    }

    const rows = await this.reconciliationRunsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
    this.logger.log({
      message: 'Ops reconciliation runs queried',
      status: query.status ?? null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      rowCount: rows.length,
    });

    return rows.map((row) => ({
      id: row.id,
      status: row.status,
      totalIssues: row.totalIssues,
      errorMessage: row.errorMessage,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
    }));
  }

  async listReconciliationIssues(runId: string, query: ListReconciliationIssuesDto) {
    const where: FindOptionsWhere<ReconciliationIssueEntity> = { runId };

    if (query.issueType) {
      where.issueType = query.issueType;
    }

    const rows = await this.reconciliationIssuesRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: query.limit ?? 20,
      skip: query.offset ?? 0,
    });
    this.logger.log({
      message: 'Ops reconciliation issues queried',
      runId,
      issueType: query.issueType ?? null,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
      rowCount: rows.length,
    });

    return rows.map((row) => ({
      id: row.id,
      runId: row.runId,
      issueType: row.issueType,
      referenceId: row.referenceId,
      details: row.details,
      createdAt: row.createdAt,
    }));
  }
}

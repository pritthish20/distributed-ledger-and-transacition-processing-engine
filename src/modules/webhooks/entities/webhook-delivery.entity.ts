import { OutboxEventEntity } from '../../outbox/entities/outbox-event.entity';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookSubscriptionEntity } from './webhook-subscription.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'webhook_deliveries' })
export class WebhookDeliveryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'webhook_subscription_id' })
  webhookSubscriptionId!: string;

  @Index()
  @Column({ name: 'outbox_event_id' })
  outboxEventId!: string;

  @Column({
    type: 'enum',
    enum: WebhookDeliveryStatus,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount!: number;

  @Column({ name: 'last_attempt_at', type: 'timestamptz', nullable: true })
  lastAttemptAt!: Date | null;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ name: 'response_status', nullable: true })
  responseStatus!: number | null;

  @Column({ name: 'response_body', type: 'text', nullable: true })
  responseBody!: string | null;

  @ManyToOne(() => WebhookSubscriptionEntity, (subscription) => subscription.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_subscription_id' })
  subscription!: WebhookSubscriptionEntity;

  @ManyToOne(() => OutboxEventEntity, (outboxEvent) => outboxEvent.deliveries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'outbox_event_id' })
  outboxEvent!: OutboxEventEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

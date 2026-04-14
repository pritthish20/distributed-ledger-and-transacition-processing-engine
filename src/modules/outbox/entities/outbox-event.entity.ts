import { TransactionEntity } from '../../transactions/entities/transaction.entity';
import { WebhookDeliveryEntity } from '../../webhooks/entities/webhook-delivery.entity';
import { OutboxStatus } from '../enums/outbox-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'outbox_events' })
export class OutboxEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'aggregate_type' })
  aggregateType!: string;

  @Column({ name: 'aggregate_id' })
  aggregateId!: string;

  @Index()
  @Column({ name: 'event_type' })
  eventType!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: OutboxStatus,
    default: OutboxStatus.PENDING,
  })
  status!: OutboxStatus;

  @Column({ name: 'retry_count', default: 0 })
  retryCount!: number;

  @Column({ name: 'next_retry_at', type: 'timestamptz', nullable: true })
  nextRetryAt!: Date | null;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Index()
  @Column({ name: 'transaction_id' })
  transactionId!: string;

  @ManyToOne(() => TransactionEntity, (transaction) => transaction.outboxEvents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TransactionEntity;

  @OneToMany(() => WebhookDeliveryEntity, (delivery) => delivery.outboxEvent)
  deliveries!: WebhookDeliveryEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

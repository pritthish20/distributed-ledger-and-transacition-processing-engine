import { WebhookDeliveryEntity } from './webhook-delivery.entity';
import { WebhookSubscriptionStatus } from '../enums/webhook-subscription-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'webhook_subscriptions' })
export class WebhookSubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'target_url' })
  targetUrl!: string;

  @Column()
  secret!: string;

  @Index()
  @Column({ name: 'event_type' })
  eventType!: string;

  @Column({
    type: 'enum',
    enum: WebhookSubscriptionStatus,
    default: WebhookSubscriptionStatus.ACTIVE,
  })
  status!: WebhookSubscriptionStatus;

  @OneToMany(() => WebhookDeliveryEntity, (delivery) => delivery.subscription)
  deliveries!: WebhookDeliveryEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

import { TransactionEntity } from '../../transactions/entities/transaction.entity';
import { IdempotencyStatus } from '../enums/idempotency-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'idempotency_records' })
@Index(['endpoint', 'idempotencyKey'], { unique: true })
export class IdempotencyRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  endpoint!: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey!: string;

  @Column({ name: 'request_hash' })
  requestHash!: string;

  @Column({
    type: 'enum',
    enum: IdempotencyStatus,
  })
  status!: IdempotencyStatus;

  @Column({ name: 'transaction_id', type: 'uuid', nullable: true })
  transactionId!: string | null;

  @Column({ name: 'response_code', type: 'int', nullable: true })
  responseCode!: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody!: Record<string, unknown> | null;

  @OneToOne(() => TransactionEntity, (transaction) => transaction.idempotencyRecord, { nullable: true })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TransactionEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

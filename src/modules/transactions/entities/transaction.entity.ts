import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { AccountEntity } from '../../accounts/entities/account.entity';
import { IdempotencyRecordEntity } from '../../idempotency/entities/idempotency-record.entity';
import { LedgerEntryEntity } from '../../ledger/entities/ledger-entry.entity';
import { OutboxEventEntity } from '../../outbox/entities/outbox-event.entity';
import { TransactionStatus } from '../enums/transaction-status.enum';
import { TransactionType } from '../enums/transaction-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'transactions' })
export class TransactionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type!: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status!: TransactionStatus;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  @Index()
  @Column({ name: 'from_account_id', type: 'uuid', nullable: true })
  fromAccountId!: string | null;

  @Index()
  @Column({ name: 'to_account_id', type: 'uuid', nullable: true })
  toAccountId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ name: 'error_code', type: 'varchar', nullable: true })
  errorCode!: string | null;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @ManyToOne(() => AccountEntity, { nullable: true })
  @JoinColumn({ name: 'from_account_id' })
  fromAccount!: AccountEntity | null;

  @ManyToOne(() => AccountEntity, { nullable: true })
  @JoinColumn({ name: 'to_account_id' })
  toAccount!: AccountEntity | null;

  @OneToMany(() => LedgerEntryEntity, (ledgerEntry) => ledgerEntry.transaction)
  ledgerEntries!: LedgerEntryEntity[];

  @OneToMany(() => OutboxEventEntity, (outboxEvent) => outboxEvent.transaction)
  outboxEvents!: OutboxEventEntity[];

  @OneToOne(() => IdempotencyRecordEntity, (record) => record.transaction)
  idempotencyRecord!: IdempotencyRecordEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

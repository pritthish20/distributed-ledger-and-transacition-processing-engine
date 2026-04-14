import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { AccountEntity } from '../../accounts/entities/account.entity';
import { TransactionEntity } from '../../transactions/entities/transaction.entity';
import { LedgerEntryType } from '../enums/ledger-entry-type.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'ledger_entries' })
export class LedgerEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ name: 'transaction_id', type: 'uuid' })
  transactionId!: string;

  @Index()
  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId!: string | null;

  @Column({ name: 'ledger_account', type: 'varchar', nullable: true })
  ledgerAccount!: string | null;

  @Column({
    name: 'entry_type',
    type: 'enum',
    enum: LedgerEntryType,
  })
  entryType!: LedgerEntryType;

  @Column({
    type: 'bigint',
    transformer: bigintTransformer,
  })
  amount!: number;

  @Column({ length: 3 })
  currency!: string;

  @ManyToOne(() => TransactionEntity, (transaction) => transaction.ledgerEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transaction_id' })
  transaction!: TransactionEntity;

  @ManyToOne(() => AccountEntity, (account) => account.ledgerEntries, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'account_id' })
  account!: AccountEntity | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import { bigintTransformer } from '../../../common/transformers/bigint.transformer';
import { LedgerEntryEntity } from '../../ledger/entities/ledger-entry.entity';
import { AccountStatus } from '../enums/account-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'accounts' })
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index()
  @Column({ length: 3 })
  currency!: string;

  @Column({
    type: 'bigint',
    default: 0,
    transformer: bigintTransformer,
  })
  balance!: number;

  @Column({
    type: 'enum',
    enum: AccountStatus,
    default: AccountStatus.ACTIVE,
  })
  status!: AccountStatus;

  @OneToMany(() => LedgerEntryEntity, (ledgerEntry) => ledgerEntry.account)
  ledgerEntries!: LedgerEntryEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

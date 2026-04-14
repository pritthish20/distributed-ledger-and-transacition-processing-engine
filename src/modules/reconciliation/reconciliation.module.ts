import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../accounts/entities/account.entity';
import { LedgerEntryEntity } from '../ledger/entities/ledger-entry.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { ReconciliationIssueEntity } from './entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { ReconciliationService } from './reconciliation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      LedgerEntryEntity,
      TransactionEntity,
      ReconciliationRunEntity,
      ReconciliationIssueEntity,
    ]),
  ],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}

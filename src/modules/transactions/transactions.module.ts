import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from '../accounts/entities/account.entity';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { OutboxModule } from '../outbox/outbox.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TransactionEntity } from './entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TransactionEntity]),
    LedgerModule,
    OutboxModule,
    IdempotencyModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}

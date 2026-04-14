import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AccountEntity } from '../accounts/entities/account.entity';
import { AccountStatus } from '../accounts/enums/account-status.enum';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerEntryType } from '../ledger/enums/ledger-entry-type.enum';
import { OutboxService } from '../outbox/outbox.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionEntity } from './entities/transaction.entity';
import { TransactionStatus } from './enums/transaction-status.enum';
import { TransactionType } from './enums/transaction-type.enum';

@Injectable()
export class TransactionsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    @InjectRepository(TransactionEntity)
    private readonly transactionsRepository: Repository<TransactionEntity>,
    private readonly ledgerService: LedgerService,
    private readonly outboxService: OutboxService,
  ) {}

  async deposit(dto: DepositDto) {
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(AccountEntity, {
        where: { id: dto.accountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new NotFoundException(`Account ${dto.accountId} not found`);
      }

      this.assertActiveAccount(account);
      this.assertCurrency(account.currency, dto.currency);

      const transaction = await manager.save(
        TransactionEntity,
        manager.create(TransactionEntity, {
          type: TransactionType.DEPOSIT,
          status: TransactionStatus.PENDING,
          amount: dto.amount,
          currency: dto.currency,
          fromAccountId: null,
          toAccountId: account.id,
          description: dto.description ?? null,
        }),
      );

      account.balance += dto.amount;
      await manager.save(AccountEntity, account);

      await this.ledgerService.createEntries(manager, [
        {
          transactionId: transaction.id,
          accountId: account.id,
          entryType: LedgerEntryType.CREDIT,
          amount: dto.amount,
          currency: dto.currency,
        },
        {
          transactionId: transaction.id,
          accountId: null,
          ledgerAccount: 'external_settlement',
          entryType: LedgerEntryType.DEBIT,
          amount: dto.amount,
          currency: dto.currency,
        },
      ]);

      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = new Date();
      const savedTransaction = await manager.save(TransactionEntity, transaction);

      await this.outboxService.createTransactionCompletedEventInManager(manager, savedTransaction);

      return this.toTransactionResponse(savedTransaction);
    });
  }

  async withdraw(dto: WithdrawDto) {
    return this.dataSource.transaction(async (manager) => {
      const account = await manager.findOne(AccountEntity, {
        where: { id: dto.accountId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!account) {
        throw new NotFoundException(`Account ${dto.accountId} not found`);
      }

      this.assertActiveAccount(account);
      this.assertCurrency(account.currency, dto.currency);
      this.assertSufficientFunds(account.balance, dto.amount);

      const transaction = await manager.save(
        TransactionEntity,
        manager.create(TransactionEntity, {
          type: TransactionType.WITHDRAWAL,
          status: TransactionStatus.PENDING,
          amount: dto.amount,
          currency: dto.currency,
          fromAccountId: account.id,
          toAccountId: null,
          description: dto.description ?? null,
        }),
      );

      account.balance -= dto.amount;
      await manager.save(AccountEntity, account);

      await this.ledgerService.createEntries(manager, [
        {
          transactionId: transaction.id,
          accountId: account.id,
          entryType: LedgerEntryType.DEBIT,
          amount: dto.amount,
          currency: dto.currency,
        },
        {
          transactionId: transaction.id,
          accountId: null,
          ledgerAccount: 'external_settlement',
          entryType: LedgerEntryType.CREDIT,
          amount: dto.amount,
          currency: dto.currency,
        },
      ]);

      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = new Date();
      const savedTransaction = await manager.save(TransactionEntity, transaction);

      await this.outboxService.createTransactionCompletedEventInManager(manager, savedTransaction);

      return this.toTransactionResponse(savedTransaction);
    });
  }

  async transfer(dto: TransferDto) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Source and destination accounts must be different');
    }

    return this.dataSource.transaction(async (manager) => {
      const orderedIds = [dto.fromAccountId, dto.toAccountId].sort();
      const accounts = await manager.find(AccountEntity, {
        where: {
          id: In(orderedIds),
        },
        order: {
          id: 'ASC',
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (accounts.length !== 2) {
        throw new NotFoundException('Both accounts must exist');
      }

      const fromAccount = accounts.find((account) => account.id === dto.fromAccountId);
      const toAccount = accounts.find((account) => account.id === dto.toAccountId);

      if (!fromAccount || !toAccount) {
        throw new NotFoundException('Both accounts must exist');
      }

      this.assertActiveAccount(fromAccount);
      this.assertActiveAccount(toAccount);
      this.assertCurrency(fromAccount.currency, dto.currency);
      this.assertCurrency(toAccount.currency, dto.currency);
      this.assertSufficientFunds(fromAccount.balance, dto.amount);

      const transaction = await manager.save(
        TransactionEntity,
        manager.create(TransactionEntity, {
          type: TransactionType.TRANSFER,
          status: TransactionStatus.PENDING,
          amount: dto.amount,
          currency: dto.currency,
          fromAccountId: fromAccount.id,
          toAccountId: toAccount.id,
          description: dto.description ?? null,
        }),
      );

      fromAccount.balance -= dto.amount;
      toAccount.balance += dto.amount;
      await manager.save(AccountEntity, [fromAccount, toAccount]);

      await this.ledgerService.createEntries(manager, [
        {
          transactionId: transaction.id,
          accountId: fromAccount.id,
          entryType: LedgerEntryType.DEBIT,
          amount: dto.amount,
          currency: dto.currency,
        },
        {
          transactionId: transaction.id,
          accountId: toAccount.id,
          entryType: LedgerEntryType.CREDIT,
          amount: dto.amount,
          currency: dto.currency,
        },
      ]);

      transaction.status = TransactionStatus.COMPLETED;
      transaction.completedAt = new Date();
      const savedTransaction = await manager.save(TransactionEntity, transaction);

      await this.outboxService.createTransactionCompletedEventInManager(manager, savedTransaction);

      return this.toTransactionResponse(savedTransaction);
    });
  }

  async getTransaction(transactionId: string) {
    const transaction = await this.transactionsRepository.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    return this.toTransactionResponse(transaction);
  }

  private assertActiveAccount(account: AccountEntity) {
    if (account.status !== AccountStatus.ACTIVE) {
      throw new BadRequestException(`Account ${account.id} is not active`);
    }
  }

  private assertCurrency(accountCurrency: string, requestCurrency: string) {
    if (accountCurrency !== requestCurrency) {
      throw new BadRequestException('Currency mismatch');
    }
  }

  private assertSufficientFunds(balance: number, amount: number) {
    if (balance < amount) {
      throw new BadRequestException('Insufficient balance');
    }
  }

  private toTransactionResponse(transaction: TransactionEntity) {
    return {
      id: transaction.id,
      type: transaction.type,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      fromAccountId: transaction.fromAccountId,
      toAccountId: transaction.toAccountId,
      description: transaction.description,
      completedAt: transaction.completedAt,
      createdAt: transaction.createdAt,
    };
  }
}

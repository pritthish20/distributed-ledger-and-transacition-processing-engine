import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AccountNotFoundException } from '../../common/exceptions/domain.exceptions';
import { LedgerService } from '../ledger/ledger.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { GetStatementDto } from './dto/get-statement.dto';
import { AccountEntity } from './entities/account.entity';
import { AccountStatus } from './enums/account-status.enum';

@Injectable()
export class AccountsService {
  private readonly logger = new Logger(AccountsService.name);

  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountsRepository: Repository<AccountEntity>,
    private readonly ledgerService: LedgerService,
  ) {}

  async createAccount(dto: CreateAccountDto) {
    const account = this.accountsRepository.create({
      currency: dto.currency,
      status: dto.status ?? AccountStatus.ACTIVE,
      balance: 0,
    });

    const savedAccount = await this.accountsRepository.save(account);
    this.logger.log({
      message: 'Account created',
      accountId: savedAccount.id,
      currency: savedAccount.currency,
      status: savedAccount.status,
    });

    return {
      id: savedAccount.id,
      currency: savedAccount.currency,
      balance: savedAccount.balance,
      status: savedAccount.status,
      createdAt: savedAccount.createdAt,
    };
  }

  async getBalance(accountId: string) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new AccountNotFoundException(accountId);
    }

    this.logger.log({
      message: 'Account balance fetched',
      accountId: account.id,
      currency: account.currency,
      status: account.status,
    });

    return {
      accountId: account.id,
      currency: account.currency,
      balance: account.balance,
      status: account.status,
      updatedAt: account.updatedAt,
    };
  }

  async getStatement(accountId: string, query: GetStatementDto) {
    const account = await this.accountsRepository.findOne({
      where: { id: accountId },
    });

    if (!account) {
      throw new AccountNotFoundException(accountId);
    }

    const entries = await this.ledgerService.getAccountStatement(accountId, query.limit ?? 20);
    this.logger.log({
      message: 'Account statement fetched',
      accountId: account.id,
      currency: account.currency,
      entryCount: entries.length,
      limit: query.limit ?? 20,
    });

    return {
      accountId: account.id,
      currency: account.currency,
      entries: entries.map((entry) => ({
        id: entry.id,
        transactionId: entry.transactionId,
        entryType: entry.entryType,
        amount: entry.amount,
        currency: entry.currency,
        createdAt: entry.createdAt,
        transactionType: entry.transaction.type,
        transactionStatus: entry.transaction.status,
        description: entry.transaction.description,
      })),
    };
  }
}

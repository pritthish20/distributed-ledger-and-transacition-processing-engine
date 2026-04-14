import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LedgerService } from '../ledger/ledger.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { GetStatementDto } from './dto/get-statement.dto';
import { AccountEntity } from './entities/account.entity';
import { AccountStatus } from './enums/account-status.enum';

@Injectable()
export class AccountsService {
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
      throw new NotFoundException(`Account ${accountId} not found`);
    }

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
      throw new NotFoundException(`Account ${accountId} not found`);
    }

    const entries = await this.ledgerService.getAccountStatement(accountId, query.limit ?? 20);

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

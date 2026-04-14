import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { LedgerEntryEntity } from './entities/ledger-entry.entity';
import { LedgerEntryType } from './enums/ledger-entry-type.enum';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(LedgerEntryEntity)
    private readonly ledgerRepository: Repository<LedgerEntryEntity>,
  ) {}

  async createEntries(
    manager: EntityManager,
    entries: Array<{
      transactionId: string;
      accountId: string | null;
      ledgerAccount?: string | null;
      entryType: LedgerEntryType;
      amount: number;
      currency: string;
    }>,
  ): Promise<LedgerEntryEntity[]> {
    const debits = entries
      .filter((entry) => entry.entryType === LedgerEntryType.DEBIT)
      .reduce((sum, entry) => sum + entry.amount, 0);
    const credits = entries
      .filter((entry) => entry.entryType === LedgerEntryType.CREDIT)
      .reduce((sum, entry) => sum + entry.amount, 0);

    if (debits !== credits) {
      throw new Error('Ledger entries are not balanced');
    }

    return manager.save(
      LedgerEntryEntity,
      entries.map((entry) => ({
        ...entry,
        ledgerAccount: entry.ledgerAccount ?? null,
      })),
    );
  }

  async getAccountStatement(accountId: string, limit = 20): Promise<LedgerEntryEntity[]> {
    return this.ledgerRepository.find({
      where: { accountId },
      relations: {
        transaction: true,
      },
      order: {
        createdAt: 'DESC',
      },
      take: limit,
    });
  }
}

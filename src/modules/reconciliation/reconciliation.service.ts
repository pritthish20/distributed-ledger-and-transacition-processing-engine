import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AccountEntity } from '../accounts/entities/account.entity';
import { LedgerEntryEntity } from '../ledger/entities/ledger-entry.entity';
import { TransactionEntity } from '../transactions/entities/transaction.entity';
import { ReconciliationIssueEntity } from './entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { ReconciliationIssueType } from './enums/reconciliation-issue-type.enum';
import { ReconciliationRunStatus } from './enums/reconciliation-run-status.enum';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);
  private running = false;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ReconciliationRunEntity)
    private readonly runsRepository: Repository<ReconciliationRunEntity>,
    @InjectRepository(ReconciliationIssueEntity)
    private readonly issuesRepository: Repository<ReconciliationIssueEntity>,
  ) {}

  async runReconciliation() {
    if (this.running) {
      return {
        skipped: true,
        reason: 'already_running',
      };
    }

    this.running = true;
    const run = await this.runsRepository.save(
      this.runsRepository.create({
        status: ReconciliationRunStatus.COMPLETED,
        totalIssues: 0,
        errorMessage: null,
        startedAt: new Date(),
      }),
    );

    try {
      const [accountMismatches, unbalancedTransactions] = await Promise.all([
        this.findAccountBalanceMismatches(),
        this.findUnbalancedTransactions(),
      ]);

      const issues = [
        ...accountMismatches.map((mismatch) =>
          this.issuesRepository.create({
            runId: run.id,
            issueType: ReconciliationIssueType.ACCOUNT_BALANCE_MISMATCH,
            referenceId: mismatch.accountId,
            details: mismatch,
          }),
        ),
        ...unbalancedTransactions.map((transaction) =>
          this.issuesRepository.create({
            runId: run.id,
            issueType: ReconciliationIssueType.UNBALANCED_TRANSACTION,
            referenceId: transaction.transactionId,
            details: transaction,
          }),
        ),
      ];

      if (issues.length > 0) {
        await this.issuesRepository.save(issues);
      }

      await this.runsRepository.update(run.id, {
        status: ReconciliationRunStatus.COMPLETED,
        totalIssues: issues.length,
        completedAt: new Date(),
      });

      return {
        skipped: false,
        runId: run.id,
        status: ReconciliationRunStatus.COMPLETED,
        totalIssues: issues.length,
      };
    } catch (error) {
      this.logger.error('Reconciliation run failed', error instanceof Error ? error.stack : undefined);
      await this.runsRepository.update(run.id, {
        status: ReconciliationRunStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Reconciliation failed',
        completedAt: new Date(),
      });

      return {
        skipped: false,
        runId: run.id,
        status: ReconciliationRunStatus.FAILED,
        totalIssues: 0,
      };
    } finally {
      this.running = false;
    }
  }

  private async findAccountBalanceMismatches() {
    const rows = await this.dataSource.query(
      `
        SELECT
          a.id AS "accountId",
          a.balance AS "accountBalance",
          COALESCE(
            SUM(
              CASE
                WHEN le.entry_type = 'credit' THEN le.amount
                WHEN le.entry_type = 'debit' THEN -le.amount
                ELSE 0
              END
            ),
            0
          ) AS "ledgerBalance"
        FROM accounts a
        LEFT JOIN ledger_entries le ON le.account_id = a.id
        GROUP BY a.id, a.balance
        HAVING COALESCE(
          SUM(
            CASE
              WHEN le.entry_type = 'credit' THEN le.amount
              WHEN le.entry_type = 'debit' THEN -le.amount
              ELSE 0
            END
          ),
          0
        ) <> a.balance
      `,
    );

    return rows.map((row: Record<string, string>) => ({
      accountId: row.accountId,
      accountBalance: Number(row.accountBalance),
      ledgerBalance: Number(row.ledgerBalance),
    }));
  }

  private async findUnbalancedTransactions() {
    const rows = await this.dataSource.query(
      `
        SELECT
          le.transaction_id AS "transactionId",
          COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0) AS "debits",
          COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0) AS "credits"
        FROM ledger_entries le
        GROUP BY le.transaction_id
        HAVING COALESCE(SUM(CASE WHEN le.entry_type = 'debit' THEN le.amount ELSE 0 END), 0)
          <> COALESCE(SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount ELSE 0 END), 0)
      `,
    );

    return rows.map((row: Record<string, string>) => ({
      transactionId: row.transactionId,
      debits: Number(row.debits),
      credits: Number(row.credits),
    }));
  }
}

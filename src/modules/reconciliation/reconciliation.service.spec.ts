import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReconciliationIssueEntity } from './entities/reconciliation-issue.entity';
import { ReconciliationRunEntity } from './entities/reconciliation-run.entity';
import { ReconciliationIssueType } from './enums/reconciliation-issue-type.enum';
import { ReconciliationRunStatus } from './enums/reconciliation-run-status.enum';
import { ReconciliationService } from './reconciliation.service';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  const dataSource = {
    query: jest.fn(),
  };
  const runsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const issuesRepository = {
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    runsRepository.create.mockImplementation((value) => value);
    runsRepository.save.mockResolvedValue({ id: 'run-1' });
    issuesRepository.create.mockImplementation((value) => value);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: DataSource,
          useValue: dataSource,
        },
        {
          provide: getRepositoryToken(ReconciliationRunEntity),
          useValue: runsRepository,
        },
        {
          provide: getRepositoryToken(ReconciliationIssueEntity),
          useValue: issuesRepository,
        },
      ],
    }).compile();

    service = module.get(ReconciliationService);
  });

  it('records account balance mismatch and unbalanced transaction issues', async () => {
    dataSource.query
      .mockResolvedValueOnce([
        {
          accountId: 'account-1',
          accountBalance: '1000',
          ledgerBalance: '900',
        },
      ])
      .mockResolvedValueOnce([
        {
          transactionId: 'txn-1',
          debits: '100',
          credits: '50',
        },
      ]);

    const result = await service.runReconciliation();

    expect(result).toMatchObject({
      skipped: false,
      runId: 'run-1',
      status: ReconciliationRunStatus.COMPLETED,
      totalIssues: 2,
    });

    expect(issuesRepository.save).toHaveBeenCalledWith([
      expect.objectContaining({
        runId: 'run-1',
        issueType: ReconciliationIssueType.ACCOUNT_BALANCE_MISMATCH,
        referenceId: 'account-1',
      }),
      expect.objectContaining({
        runId: 'run-1',
        issueType: ReconciliationIssueType.UNBALANCED_TRANSACTION,
        referenceId: 'txn-1',
      }),
    ]);
    expect(runsRepository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: ReconciliationRunStatus.COMPLETED,
        totalIssues: 2,
        completedAt: expect.any(Date),
      }),
    );
  });

  it('marks run as failed when reconciliation query throws', async () => {
    const loggerSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);
    dataSource.query.mockRejectedValueOnce(new Error('database failed'));

    const result = await service.runReconciliation();

    expect(result).toMatchObject({
      skipped: false,
      runId: 'run-1',
      status: ReconciliationRunStatus.FAILED,
      totalIssues: 0,
    });

    expect(runsRepository.update).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({
        status: ReconciliationRunStatus.FAILED,
        errorMessage: 'database failed',
        completedAt: expect.any(Date),
      }),
    );
    loggerSpy.mockRestore();
  });

  it('skips overlapping reconciliation runs', async () => {
    service['running'] = true;

    await expect(service.runReconciliation()).resolves.toEqual({
      skipped: true,
      reason: 'already_running',
    });
    expect(runsRepository.save).not.toHaveBeenCalled();
  });
});

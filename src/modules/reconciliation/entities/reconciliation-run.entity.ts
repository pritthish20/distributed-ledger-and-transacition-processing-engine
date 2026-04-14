import { ReconciliationIssueEntity } from './reconciliation-issue.entity';
import { ReconciliationRunStatus } from '../enums/reconciliation-run-status.enum';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'reconciliation_runs' })
export class ReconciliationRunEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({
    type: 'enum',
    enum: ReconciliationRunStatus,
  })
  status!: ReconciliationRunStatus;

  @Column({ name: 'total_issues', default: 0 })
  totalIssues!: number;

  @Column({ name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt!: Date | null;

  @OneToMany(() => ReconciliationIssueEntity, (issue) => issue.run)
  issues!: ReconciliationIssueEntity[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

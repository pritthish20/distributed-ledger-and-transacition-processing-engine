import { ReconciliationIssueType } from '../enums/reconciliation-issue-type.enum';
import { ReconciliationRunEntity } from './reconciliation-run.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'reconciliation_issues' })
export class ReconciliationIssueEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'run_id' })
  runId!: string;

  @Column({
    name: 'issue_type',
    type: 'enum',
    enum: ReconciliationIssueType,
  })
  issueType!: ReconciliationIssueType;

  @Column({ name: 'reference_id', nullable: true })
  referenceId!: string | null;

  @Column({ type: 'jsonb' })
  details!: Record<string, unknown>;

  @ManyToOne(() => ReconciliationRunEntity, (run) => run.issues, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run!: ReconciliationRunEntity;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReconciliationIssueType } from '../../reconciliation/enums/reconciliation-issue-type.enum';
import { OpsPaginationDto } from './ops-pagination.dto';

export class ListReconciliationIssuesDto extends OpsPaginationDto {
  @ApiPropertyOptional({ enum: ReconciliationIssueType })
  @IsOptional()
  @IsEnum(ReconciliationIssueType)
  issueType?: ReconciliationIssueType;
}

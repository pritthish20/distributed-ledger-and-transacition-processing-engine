import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { ReconciliationRunStatus } from '../../reconciliation/enums/reconciliation-run-status.enum';
import { OpsPaginationDto } from './ops-pagination.dto';

export class ListReconciliationRunsDto extends OpsPaginationDto {
  @ApiPropertyOptional({ enum: ReconciliationRunStatus })
  @IsOptional()
  @IsEnum(ReconciliationRunStatus)
  status?: ReconciliationRunStatus;
}

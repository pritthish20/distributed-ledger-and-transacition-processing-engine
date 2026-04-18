import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { OutboxStatus } from '../../outbox/enums/outbox-status.enum';
import { OpsPaginationDto } from './ops-pagination.dto';

export class ListOutboxEventsDto extends OpsPaginationDto {
  @ApiPropertyOptional({ enum: OutboxStatus })
  @IsOptional()
  @IsEnum(OutboxStatus)
  status?: OutboxStatus;

  @ApiPropertyOptional({ example: 'transaction.completed' })
  @IsOptional()
  @IsString()
  eventType?: string;
}

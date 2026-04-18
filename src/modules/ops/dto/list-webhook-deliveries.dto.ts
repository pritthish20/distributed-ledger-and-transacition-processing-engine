import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { WebhookDeliveryStatus } from '../../webhooks/enums/webhook-delivery-status.enum';
import { OpsPaginationDto } from './ops-pagination.dto';

export class ListWebhookDeliveriesDto extends OpsPaginationDto {
  @ApiPropertyOptional({ enum: WebhookDeliveryStatus })
  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  outboxEventId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  webhookSubscriptionId?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';
import { WebhookSubscriptionStatus } from '../enums/webhook-subscription-status.enum';

export class RegisterWebhookDto {
  @ApiProperty()
  @IsUrl({
    require_tld: true,
    require_protocol: true,
  })
  targetUrl!: string;

  @ApiProperty({ example: 'transaction.completed' })
  @IsString()
  eventType!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  secret!: string;

  @ApiPropertyOptional({ enum: WebhookSubscriptionStatus, default: WebhookSubscriptionStatus.ACTIVE })
  @IsOptional()
  @IsEnum(WebhookSubscriptionStatus)
  status?: WebhookSubscriptionStatus;
}

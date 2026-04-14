import { Body, Controller, Headers, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { RegisterWebhookDto } from './dto/register-webhook.dto';
import { WebhooksService } from './webhooks.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  registerWebhook(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: RegisterWebhookDto,
  ) {
    return this.idempotencyService.execute(
      'POST:/webhooks',
      idempotencyKey,
      dto,
      async () => ({
        statusCode: 201,
        body: await this.webhooksService.registerWebhook(dto),
      }),
    );
  }
}

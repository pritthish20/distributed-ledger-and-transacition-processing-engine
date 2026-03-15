import { Module } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';

@Module({
  providers: [IdempotencyService]
})
export class IdempotencyModule {}

import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { DepositDto } from './dto/deposit.dto';
import { TransferDto } from './dto/transfer.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@Controller('transactions')
export class TransactionsController {
  constructor(
    private readonly transactionsService: TransactionsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post('deposit')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  deposit(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: DepositDto,
  ) {
    return this.idempotencyService.execute(
      'POST:/transactions/deposit',
      idempotencyKey,
      dto,
      async () => {
        const transaction = await this.transactionsService.deposit(dto);
        return {
          statusCode: 201,
          body: transaction,
          transactionId: transaction.id,
        };
      },
    );
  }

  @Post('withdraw')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  withdraw(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: WithdrawDto,
  ) {
    return this.idempotencyService.execute(
      'POST:/transactions/withdraw',
      idempotencyKey,
      dto,
      async () => {
        const transaction = await this.transactionsService.withdraw(dto);
        return {
          statusCode: 201,
          body: transaction,
          transactionId: transaction.id,
        };
      },
    );
  }

  @Post('transfer')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  transfer(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: TransferDto,
  ) {
    return this.idempotencyService.execute(
      'POST:/transactions/transfer',
      idempotencyKey,
      dto,
      async () => {
        const transaction = await this.transactionsService.transfer(dto);
        return {
          statusCode: 201,
          body: transaction,
          transactionId: transaction.id,
        };
      },
    );
  }

  @Get(':transactionId')
  getTransaction(@Param('transactionId') transactionId: string) {
    return this.transactionsService.getTransaction(transactionId);
  }
}

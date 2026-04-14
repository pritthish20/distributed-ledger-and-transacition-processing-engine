import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { GetStatementDto } from './dto/get-statement.dto';
import { AccountsService } from './accounts.service';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accountsService: AccountsService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  @Post()
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
  })
  createAccount(
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() dto: CreateAccountDto,
  ) {
    return this.idempotencyService.execute(
      'POST:/accounts',
      idempotencyKey,
      dto,
      async () => ({
        statusCode: 201,
        body: await this.accountsService.createAccount(dto),
      }),
    );
  }

  @Get(':accountId/balance')
  getBalance(@Param('accountId') accountId: string) {
    return this.accountsService.getBalance(accountId);
  }

  @Get(':accountId/statement')
  getStatement(
    @Param('accountId') accountId: string,
    @Query() query: GetStatementDto,
  ) {
    return this.accountsService.getStatement(accountId, query);
  }
}

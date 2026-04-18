import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListOutboxEventsDto } from './dto/list-outbox-events.dto';
import { ListReconciliationIssuesDto } from './dto/list-reconciliation-issues.dto';
import { ListReconciliationRunsDto } from './dto/list-reconciliation-runs.dto';
import { ListWebhookDeliveriesDto } from './dto/list-webhook-deliveries.dto';
import { OpsService } from './ops.service';

@ApiTags('ops')
@Controller('ops')
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('outbox/events')
  listOutboxEvents(@Query() query: ListOutboxEventsDto) {
    return this.opsService.listOutboxEvents(query);
  }

  @Get('webhook-deliveries')
  listWebhookDeliveries(@Query() query: ListWebhookDeliveriesDto) {
    return this.opsService.listWebhookDeliveries(query);
  }

  @Get('reconciliation/runs')
  listReconciliationRuns(@Query() query: ListReconciliationRunsDto) {
    return this.opsService.listReconciliationRuns(query);
  }

  @Get('reconciliation/runs/:runId/issues')
  listReconciliationIssues(
    @Param('runId') runId: string,
    @Query() query: ListReconciliationIssuesDto,
  ) {
    return this.opsService.listReconciliationIssues(runId, query);
  }
}

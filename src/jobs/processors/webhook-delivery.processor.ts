import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WEBHOOK_DELIVERY_QUEUE } from '../../common/constants/queue.constants';
import { WebhooksService } from '../../modules/webhooks/webhooks.service';

@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>) {
    await this.webhooksService.processDelivery(job.data.deliveryId);
  }
}

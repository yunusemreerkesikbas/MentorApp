import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CronSecretGuard } from "../../../common/auth/cron-secret.guard";
import { Public } from "../../../common/auth/public.decorator";
import { SubscriptionMaintenanceService } from "../application/subscription-maintenance.service";

/**
 * Payments' only scheduled surface. The module is webhook-driven by design; this is the documented
 * exception, because nothing else ever moves a lapsed subscription to EXPIRED.
 */
@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class PaymentsInternalController {
  constructor(private readonly maintenance: SubscriptionMaintenanceService) {}

  @Post("expire-subscriptions")
  expireSubscriptions() {
    return this.maintenance.expireNow();
  }
}

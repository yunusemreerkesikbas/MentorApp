import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CronSecretGuard } from "../../../common/auth/cron-secret.guard";
import { Public } from "../../../common/auth/public.decorator";
import { AdsMaintenanceService } from "../application/ads-maintenance.service";

@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class AdsInternalController {
  constructor(private readonly maintenance: AdsMaintenanceService) {}

  @Post("expire-ad-reward-sessions")
  expireRewardSessions() {
    return this.maintenance.expireNow();
  }
}

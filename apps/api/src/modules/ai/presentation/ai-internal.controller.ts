import { Controller, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { CronSecretGuard } from "../../../common/auth/cron-secret.guard";
import { Public } from "../../../common/auth/public.decorator";
import { CoachProfileService } from "../application/coach-profile.service";

/** Render Cron entry points for idempotent AI-owned maintenance. */
@ApiTags("internal")
@Public()
@Controller("internal/cron")
@UseGuards(CronSecretGuard)
export class AiInternalController {
  constructor(private readonly profiles: CoachProfileService) {}

  @Post("cleanup-coach-memory")
  async cleanupCoachMemory(): Promise<{ deleted: number }> {
    return { deleted: await this.profiles.cleanupExpired() };
  }
}

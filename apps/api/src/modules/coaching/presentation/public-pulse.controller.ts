import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Public } from "../../../common/auth/public.decorator";
import { PublicPulseService } from "../application/public-pulse.service";
import { PublicPulseViewDto } from "./coaching.dto";

/**
 * The landing's live line. Public (the landing has no account) and anonymous: one count, no ids. The
 * web server caches it for 5 minutes, so the throttle only matters to direct callers. A separate
 * controller keeps `@Public()` off the self-scoped coaching controllers.
 */
@ApiTags("coaching")
@Public()
@Controller("coaching/public")
export class PublicPulseController {
  constructor(private readonly pulse: PublicPulseService) {}

  @Get("pulse")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOkResponse({ type: PublicPulseViewDto })
  get(): Promise<PublicPulseViewDto> {
    return this.pulse.get();
  }
}

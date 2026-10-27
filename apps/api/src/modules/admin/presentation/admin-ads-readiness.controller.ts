import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { UserRole } from "@mentor/types";
import { Roles } from "../../../common/auth/roles.decorator";
import { AdsReadinessService } from "../../ads/application/ads-readiness.service";

@ApiTags("admin")
@ApiBearerAuth()
@Roles(UserRole.SUPER_ADMIN)
@Controller("admin/ads")
export class AdminAdsReadinessController {
  constructor(private readonly readiness: AdsReadinessService) {}
  @Get("readiness")
  getReadiness() { return this.readiness.getReport(); }
}

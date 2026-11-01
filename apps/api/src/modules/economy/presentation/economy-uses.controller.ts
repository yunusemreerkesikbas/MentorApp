import { Controller, Get } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from "@nestjs/swagger";
import type { EconomyUseView, EconomyUsesView } from "@mentor/types";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { EconomyUsesService } from "../application/economy-uses.service";

class EconomyUseDto implements EconomyUseView {
  @ApiProperty({ enum: ["NOTEBOOK_SLOT", "COACH_CHAT", "DEEP_ANALYSIS", "PLAN_PREVIEW"] })
  id!: EconomyUseView["id"];
  @ApiProperty({
    enum: [
      "AVAILABLE",
      "INSUFFICIENT_COIN",
      "PREMIUM_INCLUDED",
      "INCLUDED",
      "ALREADY_UNLOCKED",
      "LIMIT_REACHED",
      "DAILY_LIMIT_REACHED",
      "UNAVAILABLE",
      "NEEDS_EXAM",
      "REVIEW_NOT_READY",
    ],
  })
  status!: EconomyUseView["status"];
  @ApiProperty({ type: Number, nullable: true }) cost!: number | null;
  @ApiProperty() premiumIncluded!: boolean;
  @ApiProperty() canOpen!: boolean;
  @ApiPropertyOptional() dailyRemaining?: number;
  @ApiPropertyOptional() slotsOwned?: number;
  @ApiPropertyOptional() slotLimit?: number;
}
class EconomyUsesDto implements EconomyUsesView {
  @ApiProperty() coinConfirmed!: number;
  @ApiProperty({ type: [EconomyUseDto] }) items!: EconomyUseDto[];
}

@ApiTags("economy")
@ApiBearerAuth()
@Controller("economy/uses")
export class EconomyUsesController {
  constructor(private readonly uses: EconomyUsesService) {}
  @Get()
  @ApiOkResponse({ type: EconomyUsesDto })
  get(@CurrentUser() user: RequestUser): Promise<EconomyUsesView> {
    return this.uses.getView(user.id, user.roles);
  }
}

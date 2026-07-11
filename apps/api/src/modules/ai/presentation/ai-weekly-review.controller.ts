import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { WeeklyReviewNarrationDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { WeeklyReviewNarrationService } from "../application/weekly-review-narration.service";
import { WeeklyReviewNarrationBodyDto } from "./ai.dto";

@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach")
export class AiWeeklyReviewController {
  constructor(private readonly weeklyReview: WeeklyReviewNarrationService) {}

  @Post("weekly-review")
  @HttpCode(200)
  narrate(
    @CurrentUser() user: RequestUser,
    @Body() dto: WeeklyReviewNarrationBodyDto,
  ): Promise<WeeklyReviewNarrationDto> {
    return this.weeklyReview.narrate(user, dto.examId);
  }
}


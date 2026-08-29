import { Body, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { ExamType } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Public } from "../../../common/auth/public.decorator";
import { AdsService } from "../application/ads.service";
import { AdPlacementParamsDto, AdPlacementQueryDto, CreateAdRewardSessionDto } from "./ads.dto";

@ApiTags("ads")
@Controller("ads")
export class AdsController {
  constructor(private readonly ads: AdsService) {}

  @Public()
  @Get("public/placements/:placementId")
  publicPlacement(
    @Param() params: AdPlacementParamsDto,
    @Query() query: AdPlacementQueryDto,
    @Headers("cf-ipcountry") countryCode?: string,
  ) {
    return this.ads.getPublicPlacement(
      params.placementId,
      (query.examType as ExamType | undefined) ?? null,
      countryCode ?? null,
    );
  }

  @ApiBearerAuth()
  @Get("placements/:placementId")
  placement(
    @Param() params: AdPlacementParamsDto,
    @CurrentUser() user: RequestUser,
    @Headers("cf-ipcountry") countryCode?: string,
  ) {
    return this.ads.getPlacement(params.placementId, user.id, user.roles, countryCode ?? null);
  }

  @ApiBearerAuth()
  @Get("reward-offers/:placementId")
  rewardOffer(
    @Param() params: AdPlacementParamsDto,
    @CurrentUser() user: RequestUser,
    @Headers("cf-ipcountry") countryCode?: string,
  ) {
    return this.ads.getRewardOffer(params.placementId, user.id, user.roles, countryCode ?? null);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post("reward-sessions")
  createRewardSession(
    @Body() dto: CreateAdRewardSessionDto,
    @CurrentUser() user: RequestUser,
    @Headers("cf-ipcountry") countryCode?: string,
  ) {
    return this.ads.createRewardSession(dto.placementId, user, countryCode ?? null);
  }

  @ApiBearerAuth()
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post("reward-sessions/:id/complete")
  complete(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.ads.completeRewardSession(id, user.id);
  }

  @ApiBearerAuth()
  @Post("reward-sessions/:id/close")
  close(@Param("id") id: string, @CurrentUser() user: RequestUser) {
    return this.ads.closeRewardSession(id, user.id);
  }
}

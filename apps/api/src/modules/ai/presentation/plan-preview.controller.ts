import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiHeader,
  ApiOkResponse,
  ApiTags,
} from "@nestjs/swagger";
import type {
  CoachPlanAdaptationBriefDto,
  PlanPreviewAccessDto,
  SavedPlanPreviewDto,
} from "@mentor/types";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { CoinPlanPreviewService } from "../application/coin-plan-preview.service";
import { PlanPreviewAccessService } from "../application/plan-preview-access.service";
import { PlanAdaptationService } from "../application/plan-adaptation.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  CoinPlanPreviewBodyDto,
  ConfirmPlanPreviewBodyDto,
  PlanPreviewAccessResponseDto,
  SavedPlanPreviewResponseDto,
} from "./plan-preview.dto";

@ApiTags("ai")
@ApiBearerAuth()
@Controller("coach/plan-previews")
export class PlanPreviewController {
  constructor(
    private readonly previews: CoinPlanPreviewService,
    private readonly access: PlanPreviewAccessService,
    private readonly adaptation: PlanAdaptationService,
  ) {}
  @Get("access")
  @ApiOkResponse({ type: PlanPreviewAccessResponseDto })
  offer(@CurrentUser() user: RequestUser): Promise<PlanPreviewAccessDto> {
    return this.access.get(user);
  }

  @Get("brief")
  async brief(
    @CurrentUser() user: RequestUser,
  ): Promise<CoachPlanAdaptationBriefDto> {
    await this.previews.assertCoinEnabled();
    return this.adaptation.brief(user, true);
  }

  @Post()
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Must match clientRequestId",
  })
  @ApiCreatedResponse({ type: SavedPlanPreviewResponseDto })
  create(
    @CurrentUser() user: RequestUser,
    @Body() body: CoinPlanPreviewBodyDto,
    @Headers("idempotency-key") key?: string,
  ): Promise<SavedPlanPreviewDto> {
    if (key !== body.clientRequestId)
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    return this.previews.generate(user, body);
  }

  @Get(":id")
  @ApiOkResponse({ type: SavedPlanPreviewResponseDto })
  read(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<SavedPlanPreviewDto> {
    return this.previews.read(user.id, id);
  }

  @Post(":id/confirm")
  @ApiHeader({
    name: "Idempotency-Key",
    required: true,
    schema: { type: "string", format: "uuid" },
    description: "Must match the saved request id",
  })
  @ApiCreatedResponse({ type: SavedPlanPreviewResponseDto })
  confirm(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() body: ConfirmPlanPreviewBodyDto,
    @Headers("idempotency-key") key?: string,
  ): Promise<SavedPlanPreviewDto> {
    if (key !== id)
      throw new DomainError(ErrorCode.BAD_REQUEST, HttpStatus.BAD_REQUEST);
    return this.previews.confirm(user, id, body.expectedCost);
  }
}

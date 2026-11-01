import { ApiProperty, ApiPropertyOptional, OmitType } from "@nestjs/swagger";
import {
  coinPlanPreviewSchema,
  confirmPlanPreviewSchema,
} from "@mentor/validation";
import type { CoinPlanPreviewInput } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";
import { PlanAdaptationBodyDto } from "./ai.dto";

class CoinPlanInputDto extends OmitType(PlanAdaptationBodyDto, [
  "source",
  "sessionId",
] as const) {
  @ApiProperty({ enum: ["PLAN"] }) source!: "PLAN";
}
export class CoinPlanPreviewBodyDto extends createZodDto(
  coinPlanPreviewSchema,
) {
  @ApiProperty({ type: CoinPlanInputDto })
  override input!: CoinPlanPreviewInput["input"];
  @ApiProperty({ minimum: 1 }) override expectedCost!: number;
  @ApiProperty({ format: "uuid" }) override clientRequestId!: string;
}
export class ConfirmPlanPreviewBodyDto extends createZodDto(
  confirmPlanPreviewSchema,
) {
  @ApiProperty({ minimum: 1 }) override expectedCost!: number;
}
export class PlanPreviewAccessResponseDto {
  @ApiProperty({ enum: ["INCLUDED", "COIN", "NONE"] }) mode!: string;
  @ApiProperty() canGenerate!: boolean;
  @ApiProperty({ type: Number, nullable: true }) cost!: number | null;
  @ApiProperty() dailyLimit!: number;
  @ApiProperty() dailyRemaining!: number;
  @ApiProperty() coinConfirmed!: number;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() message?: string;
  @ApiProperty({ type: String, nullable: true }) latestRequestId!:
    | string
    | null;
}
export class SavedPlanPreviewResponseDto {
  @ApiProperty({ format: "uuid" }) requestId!: string;
  @ApiProperty({ enum: ["RUNNING", "GENERATED", "READY", "FAILED"] })
  state!: string;
  @ApiProperty({ type: Object, nullable: true }) preview!: object | null;
  @ApiProperty() cost!: number;
  @ApiProperty() coinSpent!: number;
}

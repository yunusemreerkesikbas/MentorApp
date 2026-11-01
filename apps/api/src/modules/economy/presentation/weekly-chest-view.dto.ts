import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type { WeeklyChestState, WeeklyChestSummary, WeeklyChestView } from "@mentor/types";
import { weeklyChestOpenSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class WeeklyChestOpenDto extends createZodDto(weeklyChestOpenSchema) {}

export class WeeklyChestDayDto {
  @ApiProperty({ description: "yyyy-mm-dd (UTC day)" }) date!: string;
  @ApiProperty() active!: boolean;
}

export class WeeklyChestRewardDto {
  @ApiProperty({ enum: ["COIN"] }) unit!: "COIN";
  @ApiProperty({ type: "integer" }) amount!: number;
}

export class WeeklyChestSummaryDto implements WeeklyChestSummary {
  @ApiProperty({ type: "integer" }) activeDays!: number;
  @ApiProperty({ type: "integer" }) focusSessions!: number;
  @ApiProperty({ type: "integer" }) planTasks!: number;
  @ApiProperty({ type: "integer" }) focusMinutes!: number;
}

/** GET /v1/economy/weekly-chest · POST /v1/economy/weekly-chest/open */
export class WeeklyChestViewDto implements WeeklyChestView {
  @ApiProperty({ enum: ["PROGRESS", "READY", "OPENED"] }) state!: WeeklyChestState;
  @ApiProperty({ description: "ISO week key, e.g. 2026-W45; send it to open." }) periodKey!: string;
  @ApiProperty({ description: "Last week's completed chest, not opened yet." }) carriedOver!: boolean;
  @ApiProperty({ type: "integer" }) current!: number;
  @ApiProperty({ type: "integer" }) target!: number;
  @ApiProperty({ type: [WeeklyChestDayDto], description: "Monday to Sunday of periodKey's week." })
  days!: WeeklyChestDayDto[];
  @ApiProperty({ description: "The server's UTC day (yyyy-mm-dd)." }) today!: string;
  @ApiProperty({ type: WeeklyChestRewardDto, nullable: true, description: "null while the economy is off or the grant waits." })
  reward!: WeeklyChestRewardDto | null;
  @ApiPropertyOptional() rewardPendingMessage?: string;
  @ApiPropertyOptional({ type: WeeklyChestSummaryDto, description: "Only when READY or OPENED." })
  summary?: WeeklyChestSummaryDto;
}

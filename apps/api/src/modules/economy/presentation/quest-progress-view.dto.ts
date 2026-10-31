import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  QuestAction,
  QuestCategory,
  QuestPeriod,
  QuestProgressView,
  QuestRewardUnit,
} from "@mentor/types";

export class QuestProgressViewDto implements QuestProgressView {
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: ["daily_ritual", "weekly_ritual", "milestone", "onboarding"],
  })
  category!: QuestCategory;
  @ApiProperty({ enum: ["daily", "weekly", "once"] }) period!: QuestPeriod;
  @ApiProperty() periodKey!: string;
  @ApiProperty() type!: string;
  @ApiProperty() title!: string;
  @ApiProperty() badgeLabel!: string;
  @ApiProperty({
    enum: [
      "plan",
      "study-session",
      "mood-checkin",
      "panel",
      "subscription",
      "invite",
      "verify-email",
    ],
    nullable: true,
  })
  action!: QuestAction;
  @ApiProperty({ enum: ["XP", "COIN", "NONE"] }) rewardUnit!: QuestRewardUnit;
  @ApiProperty() rewardAmount!: number;
  @ApiProperty() rewardCoin!: number;
  @ApiPropertyOptional() progressCurrent?: number;
  @ApiPropertyOptional() progressTarget?: number;
  @ApiProperty() completed!: boolean;
  @ApiProperty({ type: String, nullable: true }) completedAt!: string | null;
  @ApiPropertyOptional() rewardPendingMessage?: string;
}

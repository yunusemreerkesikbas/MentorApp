import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { openWeeklyRecapSchema, weeklyRecapOfferQuerySchema, paginationQuerySchema, createWeeklyReportTaskSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreateWeeklyReportTaskBodyDto extends createZodDto(createWeeklyReportTaskSchema) {
  @ApiProperty() override title!: string;
  @ApiPropertyOptional({ format: "date" }) override taskDate?: string;
  @ApiPropertyOptional({ type: String, nullable: true }) override startTime?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true }) override endTime?: string | null;
  @ApiPropertyOptional({ type: Number, nullable: true }) override durationMinutes?: number | null;
  @ApiPropertyOptional({ type: String, nullable: true }) override description?: string | null;
  @ApiPropertyOptional({ type: Number }) override sortOrder?: number;
}
export class WeeklyReportFollowUpResponseDto {
  @ApiProperty({ type: Object, nullable: true }) task!: object | null;
  @ApiProperty({ type: Object, nullable: true }) previous!: object | null;
}

export class WeeklyRecapOfferQueryDto extends createZodDto(weeklyRecapOfferQuerySchema) {
  @ApiProperty({ format: "uuid" }) override examId!: string;
  @ApiPropertyOptional({ format: "date" }) override weekStart?: string;
}
export class WeeklyRecapArchiveQueryDto extends createZodDto(paginationQuerySchema) {
  @ApiPropertyOptional({ default: 1 }) override page!: number;
  @ApiPropertyOptional({ default: 20, maximum: 100 }) override pageSize!: number;
}
export class OpenWeeklyRecapBodyDto extends createZodDto(openWeeklyRecapSchema) {
  @ApiProperty({ format: "uuid" }) override examId!: string;
  @ApiProperty({ format: "date" }) override weekStart!: string;
  @ApiProperty({ enum: ["PREMIUM", "EARNED", "COIN", "OWNED"] }) override source!: "PREMIUM" | "EARNED" | "COIN" | "OWNED";
  @ApiProperty({ minimum: 0 }) override expectedCost!: number;
  @ApiProperty({ format: "uuid" }) override clientRequestId!: string;
}
export class WeeklyRecapTeaserResponseDto {
  @ApiProperty() activeDays!: number;
  @ApiProperty() focusMinutes!: number;
  @ApiProperty({ type: String, nullable: true }) topSubject!: string | null;
}
export class WeeklyRecapOfferResponseDto {
  @ApiProperty() enabled!: boolean;
  @ApiProperty() examId!: string;
  @ApiProperty() weekStart!: string;
  @ApiProperty() endDate!: string;
  @ApiProperty() ready!: boolean;
  @ApiProperty() premium!: boolean;
  @ApiProperty({ enum: ["PREMIUM", "EARNED", "COIN", "OWNED", "NONE"] }) mode!: string;
  @ApiProperty() canOpen!: boolean;
  @ApiProperty() premiumAvailable!: boolean;
  @ApiProperty({ type: String, nullable: true }) reportId!: string | null;
  @ApiProperty() cost!: number;
  @ApiProperty() coinConfirmed!: number;
  @ApiProperty() coinLimit!: number;
  @ApiProperty() coinRemaining!: number;
  @ApiProperty() windowDays!: number;
  @ApiProperty({ type: String, nullable: true }) nextAvailableAt!: string | null;
  @ApiProperty({ type: WeeklyRecapTeaserResponseDto }) teaser!: WeeklyRecapTeaserResponseDto;
  @ApiPropertyOptional() reason?: string;
  @ApiPropertyOptional() message?: string;
}
export class WeeklyRecapArchiveItemResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() examId!: string;
  @ApiProperty() weekStart!: string;
  @ApiProperty() endDate!: string;
  @ApiProperty() locale!: string;
  @ApiProperty({ enum: ["PREMIUM", "EARNED", "COIN"] }) source!: string;
  @ApiProperty() openedAt!: string;
  @ApiPropertyOptional() requiresOpening?: boolean;
}
export class WeeklyRecapReportResponseDto extends WeeklyRecapArchiveItemResponseDto {
  @ApiProperty({ type: Object, description: "Frozen weekly review. New snapshots include optional deepAnalysis: localized study comparisons, subject net averages/sample counts and evidence qualification. Both report views share this acquisition; older snapshots omit deepAnalysis." }) review!: object;
  @ApiProperty({ type: Object }) narration!: object;
}
export class WeeklyRecapArchiveResponseDto {
  @ApiProperty({ type: [WeeklyRecapArchiveItemResponseDto] }) items!: WeeklyRecapArchiveItemResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { listMentorshipPlanningTasksSchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class ListMentorshipPlanningTasksDto extends createZodDto(
  listMentorshipPlanningTasksSchema,
) {
  @ApiProperty({ format: "date" }) declare from: string;
  @ApiProperty({ format: "date" }) declare to: string;
  @ApiPropertyOptional({ default: 1, minimum: 1 }) declare page: number;
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  declare pageSize: number;
}
export class MentorshipPlanningTaskResponseDto {
  @ApiProperty({ format: "uuid" }) id!: string;
  @ApiProperty({ format: "date" }) taskDate!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ type: String, nullable: true }) subject!: string | null;
  @ApiProperty({ type: String, nullable: true }) topic!: string | null;
  @ApiProperty() status!: string;
  @ApiProperty() assignedByCoach!: boolean;
  @ApiProperty({ type: String, nullable: true }) coachNote!: string | null;
}
export class MentorshipPlanningPageResponseDto {
  @ApiProperty({ type: [MentorshipPlanningTaskResponseDto] })
  items!: MentorshipPlanningTaskResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

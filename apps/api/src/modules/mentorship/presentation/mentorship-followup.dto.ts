import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "../../../common/validation/zod-dto";
import { createMentorshipFollowupSchema, updateMentorshipFollowupSchema, respondMentorshipFollowupSchema, listMentorshipFollowupsQuerySchema, mentorshipFollowupParamSchema, mentorshipStudentFollowupParamSchema, paginationQuerySchema, mentorshipStudentParamSchema } from "@mentor/validation";
import type { MentorshipFollowupResponse, MentorshipFollowupStatus } from "@mentor/types";

export class CreateMentorshipFollowupDto extends createZodDto(createMentorshipFollowupSchema) {
  @ApiProperty({ type: String, format: "uuid" }) declare operationId: string;
  @ApiProperty({ type: String, minLength: 1, maxLength: 120 }) declare title: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 }) declare privateNote: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 2000 }) declare sharedDecision: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: "date" }) declare followUpDate: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: "uuid" }) declare replacesId: string | null;
}
export class UpdateMentorshipFollowupDto extends createZodDto(updateMentorshipFollowupSchema) {
  @ApiProperty({ type: Number, minimum: 1 }) declare version: number;
  @ApiPropertyOptional({ type: String, nullable: true, format: "date" }) declare followUpDate?: string | null;
  @ApiPropertyOptional({ enum: ["COMPLETED", "CANCELLED"] }) declare status?: "COMPLETED" | "CANCELLED";
}
export class RespondMentorshipFollowupDto extends createZodDto(respondMentorshipFollowupSchema) {
  @ApiProperty({ type: Number, minimum: 1 }) declare version: number;
  @ApiProperty({ enum: ["ACCEPTED", "CHANGE_REQUESTED"] }) declare response: "ACCEPTED" | "CHANGE_REQUESTED";
}
export class ListMentorshipFollowupsQueryDto extends createZodDto(listMentorshipFollowupsQuerySchema) {
  @ApiPropertyOptional({ type: String, format: "uuid" }) declare studentId?: string;
  @ApiPropertyOptional({ enum: ["ALL", "ACTIONABLE"], default: "ALL" }) declare view: "ALL" | "ACTIONABLE";
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 }) declare page: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 }) declare pageSize: number;
}
export class FollowupPaginationQueryDto extends createZodDto(paginationQuerySchema) {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 }) declare page: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 }) declare pageSize: number;
}
export class FollowupParamDto extends createZodDto(mentorshipFollowupParamSchema) {
  @ApiProperty({ type: String, format: "uuid" }) declare followupId: string;
}
export class StudentFollowupParamDto extends createZodDto(mentorshipStudentFollowupParamSchema) {
  @ApiProperty({ type: String, format: "uuid" }) declare followupId: string;
  @ApiProperty({ type: String, format: "uuid" }) declare studentId: string;
}
export class FollowupStudentParamDto extends createZodDto(mentorshipStudentParamSchema) {
  @ApiProperty({ type: String, format: "uuid" }) declare studentId: string;
}

export class FollowupAvailabilityResponseDto {
  @ApiProperty({ type: Boolean }) enabled!: boolean;
}

export class SharedFollowupResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String }) sharedDecision!: string;
  @ApiProperty({ enum: ["PENDING", "ACCEPTED", "CHANGE_REQUESTED"] }) response!: MentorshipFollowupResponse;
  @ApiProperty({ type: String, nullable: true, format: "date" }) followUpDate!: string | null;
  @ApiProperty({ enum: ["OPEN", "COMPLETED", "CANCELLED"] }) status!: MentorshipFollowupStatus;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) respondedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) closedAt!: string | null;
}

export class CoachFollowupResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ type: String, format: "uuid" }) studentId!: string;
  @ApiProperty({ type: String }) studentDisplayName!: string;
  @ApiProperty({ type: String }) title!: string;
  @ApiProperty({ type: String, nullable: true }) privateNote!: string | null;
  @ApiProperty({ type: String, nullable: true }) sharedDecision!: string | null;
  @ApiProperty({ enum: ["PENDING", "ACCEPTED", "CHANGE_REQUESTED"] }) response!: MentorshipFollowupResponse;
  @ApiProperty({ type: String, nullable: true, format: "date" }) followUpDate!: string | null;
  @ApiProperty({ enum: ["OPEN", "COMPLETED", "CANCELLED"] }) status!: MentorshipFollowupStatus;
  @ApiProperty({ type: Number }) version!: number;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) replacesId!: string | null;
  @ApiProperty({ type: String, format: "date-time" }) createdAt!: string;
  @ApiProperty({ type: String, format: "date-time" }) updatedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) respondedAt!: string | null;
  @ApiProperty({ type: String, nullable: true, format: "date-time" }) closedAt!: string | null;
}

export class CoachFollowupPageDto {
  @ApiProperty({ type: [CoachFollowupResponseDto] }) items!: CoachFollowupResponseDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}
export class SharedFollowupPageDto {
  @ApiProperty({ type: [SharedFollowupResponseDto] }) items!: SharedFollowupResponseDto[];
  @ApiProperty({ type: Number }) total!: number;
  @ApiProperty({ type: Number }) page!: number;
  @ApiProperty({ type: Number }) pageSize!: number;
}


import { MentorshipMeetingPreparationResponseDto } from "./mentorship-preparation.dto";
import {
  finalizeMentorshipWeeklyReportSchema,
  listMentorshipWeeklyReportsSchema,
  mentorshipWeeklyBriefSchema,
  mentorshipWeeklyPreviewQuerySchema,
  mentorshipWeeklyReportParamSchema,
} from "@mentor/validation";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { createZodDto } from "../../../common/validation/zod-dto";

export class MentorshipWeeklyPreviewQueryDto extends createZodDto(
  mentorshipWeeklyPreviewQuerySchema,
) {
  @ApiPropertyOptional({ type: String, format: "date" })
  declare weekStart?: string;
}
export class MentorshipWeeklyBriefDto extends createZodDto(
  mentorshipWeeklyBriefSchema,
) {
  @ApiPropertyOptional({ type: String, maxLength: 500 })
  declare coachContext?: string;
  @ApiProperty({ type: String, format: "date" }) declare weekStart: string;
  @ApiProperty({ type: String, minLength: 64, maxLength: 64 })
  declare sourceFingerprint: string;
}
export class FinalizeMentorshipWeeklyReportDto extends createZodDto(
  finalizeMentorshipWeeklyReportSchema,
) {
  @ApiProperty({ type: String, format: "date" }) declare weekStart: string;
  @ApiProperty({ type: String, minLength: 64, maxLength: 64 })
  declare sourceFingerprint: string;
  @ApiProperty({ type: String, format: "uuid" }) declare operationId: string;
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 1200 })
  declare coachEvaluation?: string | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: "uuid" })
  declare replacesId?: string | null;
}
export class ListMentorshipWeeklyReportsDto extends createZodDto(
  listMentorshipWeeklyReportsSchema,
) {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  declare page: number;
  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  declare pageSize: number;
}
export class MentorshipWeeklyReportParamDto extends createZodDto(
  mentorshipWeeklyReportParamSchema,
) {
  @ApiProperty({ type: String, format: "uuid" }) declare studentId: string;
  @ApiProperty({ type: String, format: "uuid" }) declare reportId: string;
}

export class MentorshipWeeklyPeriodResponseDto {
  @ApiProperty({ type: String, format: "date" }) startDate!: string;
  @ApiProperty({ type: String, format: "date" }) endDate!: string;
  @ApiProperty({ type: String, format: "date" }) previousStartDate!: string;
  @ApiProperty({ type: String, format: "date" }) previousEndDate!: string;
  @ApiProperty({ enum: ["Europe/Istanbul"] }) timeZone!: "Europe/Istanbul";
}

export class MentorshipWeeklyMetricsResponseDto {
  @ApiProperty() focusMinutes!: number;
  @ApiProperty() sessions!: number;
  @ApiProperty() activeDays!: number;
  @ApiProperty() plannedTasks!: number;
  @ApiProperty() completedTasks!: number;
  @ApiProperty({ type: Number, nullable: true }) completionRate!: number | null;
  @ApiProperty() hasRecordedActivity!: boolean;
}

export class MentorshipWeeklyDeltasResponseDto {
  @ApiProperty() focusMinutes!: number;
  @ApiProperty() sessions!: number;
  @ApiProperty() activeDays!: number;
  @ApiProperty() plannedTasks!: number;
  @ApiProperty() completedTasks!: number;
  @ApiProperty({ type: Number, nullable: true }) completionRate!: number | null;
}

export class MentorshipWeeklySubjectResponseDto {
  @ApiProperty({ type: String, nullable: true }) subjectRef!: string | null;
  @ApiProperty() currentFocusMinutes!: number;
  @ApiProperty() currentSessions!: number;
  @ApiProperty() previousFocusMinutes!: number;
  @ApiProperty() previousSessions!: number;
}

export class MentorshipWeeklyMockSubjectResponseDto {
  @ApiProperty() subjectRef!: string;
  @ApiProperty({ type: Number, nullable: true }) currentAverageNet!:
    | number
    | null;
  @ApiProperty({ type: Number, nullable: true }) previousAverageNet!:
    | number
    | null;
  @ApiProperty() currentAttemptCount!: number;
  @ApiProperty() previousAttemptCount!: number;
}

export class MentorshipWeeklyMockResponseDto {
  @ApiProperty({ type: String, nullable: true }) examScopeName!: string | null;
  @ApiProperty() currentAttemptCount!: number;
  @ApiProperty() previousAttemptCount!: number;
  @ApiProperty({ type: Number, nullable: true }) currentAverageNet!:
    | number
    | null;
  @ApiProperty({ type: Number, nullable: true }) previousAverageNet!:
    | number
    | null;
  @ApiProperty({ type: [String] }) currentPublishers!: string[];
  @ApiProperty({ type: [String] }) previousPublishers!: string[];
  @ApiProperty({ type: [MentorshipWeeklyMockSubjectResponseDto] })
  subjects!: MentorshipWeeklyMockSubjectResponseDto[];
}

export class MentorshipWeeklyEvidenceResponseDto {
  @ApiPropertyOptional() subjectRef?: string;
  @ApiPropertyOptional() currentAttemptCount?: number;
  @ApiPropertyOptional() previousAttemptCount?: number;
  @ApiProperty() id!: string;
  @ApiProperty({
    enum: [
      "FOCUS_MINUTES",
      "SESSIONS",
      "ACTIVE_DAYS",
      "PLANNED_TASKS",
      "COMPLETED_TASKS",
      "COMPLETION_RATE",
      "MOCK_AVERAGE",
    ],
  })
  kind!: string;
  @ApiProperty({ type: Number, nullable: true }) current!: number | null;
  @ApiProperty({ type: Number, nullable: true }) previous!: number | null;
  @ApiProperty({ type: Number, nullable: true }) delta!: number | null;
}

export class MentorshipWeeklyBriefFindingResponseDto {
  @ApiProperty() observation!: string;
  @ApiProperty({ type: [String] }) evidenceIds!: string[];
  @ApiProperty() uncertainty!: string;
  @ApiProperty() conversationQuestion!: string;
}

export class MentorshipWeeklyBriefResponseDto {
  @ApiPropertyOptional({ type: MentorshipMeetingPreparationResponseDto })
  preparation?: MentorshipMeetingPreparationResponseDto;
  @ApiPropertyOptional({ type: String, nullable: true }) coachContext?:
    | string
    | null;
  @ApiProperty({ type: [MentorshipWeeklyBriefFindingResponseDto] })
  findings!: MentorshipWeeklyBriefFindingResponseDto[];
  @ApiProperty() model!: string;
  @ApiProperty({ type: String, format: "date-time" }) generatedAt!: string;
  @ApiProperty({ enum: ["tr", "en"] }) locale!: "tr" | "en";
  @ApiProperty() promptVersion!: string;
}

export class MentorshipWeeklySnapshotResponseDto {
  @ApiProperty({ type: MentorshipWeeklyPeriodResponseDto })
  period!: MentorshipWeeklyPeriodResponseDto;
  @ApiProperty({ type: MentorshipWeeklyMetricsResponseDto })
  current!: MentorshipWeeklyMetricsResponseDto;
  @ApiProperty({ type: MentorshipWeeklyMetricsResponseDto })
  previous!: MentorshipWeeklyMetricsResponseDto;
  @ApiProperty({ type: MentorshipWeeklyDeltasResponseDto })
  deltas!: MentorshipWeeklyDeltasResponseDto;
  @ApiProperty({ type: [MentorshipWeeklySubjectResponseDto] })
  subjects!: MentorshipWeeklySubjectResponseDto[];
  @ApiProperty({ type: MentorshipWeeklyMockResponseDto })
  mocks!: MentorshipWeeklyMockResponseDto;
  @ApiProperty({ type: [MentorshipWeeklyEvidenceResponseDto] })
  evidence!: MentorshipWeeklyEvidenceResponseDto[];
  @ApiProperty({
    type: [String],
    enum: [
      "NO_CURRENT_ACTIVITY",
      "NO_PREVIOUS_ACTIVITY",
      "NO_CURRENT_MOCK",
      "NO_PREVIOUS_MOCK",
      "MIXED_MOCK_SCOPE",
      "MOCK_PUBLISHERS_DIFFER",
      "LIMITED_MOCK_ATTEMPTS",
      "UNCLASSIFIED_SESSIONS",
    ],
  })
  limitations!: string[];
}

export class MentorshipWeeklyShareSnapshotResponseDto {
  @ApiProperty({ type: MentorshipWeeklyPeriodResponseDto })
  period!: MentorshipWeeklyPeriodResponseDto;
  @ApiProperty({ type: MentorshipWeeklyMetricsResponseDto })
  current!: MentorshipWeeklyMetricsResponseDto;
  @ApiProperty({ type: MentorshipWeeklyMetricsResponseDto })
  previous!: MentorshipWeeklyMetricsResponseDto;
  @ApiProperty({ type: MentorshipWeeklyDeltasResponseDto })
  deltas!: MentorshipWeeklyDeltasResponseDto;
  @ApiProperty({ type: [MentorshipWeeklySubjectResponseDto] })
  subjects!: MentorshipWeeklySubjectResponseDto[];
  @ApiProperty({ type: MentorshipWeeklyMockResponseDto })
  mocks!: MentorshipWeeklyMockResponseDto;
  @ApiProperty({
    type: [String],
    enum: [
      "NO_CURRENT_ACTIVITY",
      "NO_PREVIOUS_ACTIVITY",
      "NO_CURRENT_MOCK",
      "NO_PREVIOUS_MOCK",
      "MIXED_MOCK_SCOPE",
      "MOCK_PUBLISHERS_DIFFER",
      "LIMITED_MOCK_ATTEMPTS",
      "UNCLASSIFIED_SESSIONS",
    ],
  })
  limitations!: string[];
}

export class MentorshipWeeklyPreviewResponseDto {
  @ApiPropertyOptional({ type: String, nullable: true }) coachContext?:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true }) briefFingerprint?:
    | string
    | null;
  @ApiPropertyOptional({ type: String, nullable: true, format: "uuid" })
  briefGenerationId?: string | null;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) draftId!:
    | string
    | null;
  @ApiProperty({ type: String, format: "uuid" }) studentId!: string;
  @ApiProperty() studentDisplayName!: string;
  @ApiProperty({ minLength: 64, maxLength: 64 }) sourceFingerprint!: string;
  @ApiProperty({
    enum: [
      "DRAFT",
      "BRIEF_PENDING",
      "BRIEF_READY",
      "BRIEF_FAILED",
      "FINALIZED",
    ],
  })
  status!: string;
  @ApiProperty({ type: MentorshipWeeklySnapshotResponseDto })
  snapshot!: MentorshipWeeklySnapshotResponseDto;
  @ApiProperty({ type: MentorshipWeeklyBriefResponseDto, nullable: true })
  brief!: MentorshipWeeklyBriefResponseDto | null;
}

export class MentorshipWeeklyReportListItemResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["tr", "en"] }) locale!: "tr" | "en";
  @ApiProperty({ type: MentorshipWeeklyPeriodResponseDto })
  period!: MentorshipWeeklyPeriodResponseDto;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: "date-time" }) finalizedAt!: string;
  @ApiProperty({ type: String, nullable: true, format: "uuid" }) replacesId!:
    | string
    | null;
}

export class MentorshipWeeklyReportResponseDto extends MentorshipWeeklyReportListItemResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) studentId!: string;
  @ApiProperty() studentDisplayName!: string;
  @ApiProperty({ minLength: 64, maxLength: 64 }) sourceFingerprint!: string;
  @ApiProperty({ type: MentorshipWeeklySnapshotResponseDto })
  snapshot!: MentorshipWeeklySnapshotResponseDto;
  @ApiProperty({ type: String, nullable: true }) coachEvaluation!:
    | string
    | null;
  @ApiProperty({ type: MentorshipWeeklyBriefResponseDto, nullable: true })
  brief!: MentorshipWeeklyBriefResponseDto | null;
}

export class MentorshipWeeklyReportPageResponseDto {
  @ApiProperty({ type: [MentorshipWeeklyReportListItemResponseDto] })
  items!: MentorshipWeeklyReportListItemResponseDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
}

export class MentorshipWeeklyReportShareResponseDto {
  @ApiProperty({ type: String, format: "uuid" }) id!: string;
  @ApiProperty({ enum: ["tr", "en"] }) locale!: "tr" | "en";
  @ApiProperty() studentDisplayName!: string;
  @ApiProperty() coachDisplayName!: string;
  @ApiProperty({ type: MentorshipWeeklyPeriodResponseDto })
  period!: MentorshipWeeklyPeriodResponseDto;
  @ApiProperty() version!: number;
  @ApiProperty({ type: String, format: "date-time" }) finalizedAt!: string;
  @ApiProperty({ type: MentorshipWeeklyShareSnapshotResponseDto })
  snapshot!: MentorshipWeeklyShareSnapshotResponseDto;
  @ApiProperty({ type: String, nullable: true }) coachEvaluation!:
    | string
    | null;
}

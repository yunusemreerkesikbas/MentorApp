import {
  cancelMentorshipEventSchema,
  createMentorshipBatchAssignmentSchema,
  createMentorshipEventSchema,
  createMentorshipAssignmentsSchema,
  listMentorshipPlanQuerySchema,
  mentorshipAssignmentGroupParamSchema,
  mentorshipAssignmentParamSchema,
  mentorshipEventParamSchema,
  removeMentorshipAssignmentGroupSchema,
  listMentorshipStudentsQuerySchema,
  mentorshipAttentionSchema,
  mentorshipCoachNoteSchema,
  mentorshipInviteCodeParamSchema,
  mentorshipStudentParamSchema,
  mentorshipTemplateParamSchema,
  saveMentorshipTemplateSchema,
  updateMentorshipAssignmentGroupSchema,
  updateMentorshipAssignmentSchema,
  updateMentorshipEventSchema,
  registerCoachSchema,
  updateCoachProfileSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class MentorshipInviteCodeParamDto extends createZodDto(mentorshipInviteCodeParamSchema) {}
export class ListMentorshipStudentsQueryDto extends createZodDto(
  listMentorshipStudentsQuerySchema,
) {}
export class MentorshipStudentParamDto extends createZodDto(mentorshipStudentParamSchema) {}
export class CreateMentorshipAssignmentsDto extends createZodDto(
  createMentorshipAssignmentsSchema,
) {}
export class CreateMentorshipBatchAssignmentDto extends createZodDto(
  createMentorshipBatchAssignmentSchema,
) {}
export class UpdateMentorshipAssignmentDto extends createZodDto(
  updateMentorshipAssignmentSchema,
) {}
export class UpdateMentorshipAssignmentGroupDto extends createZodDto(
  updateMentorshipAssignmentGroupSchema,
) {}
export class RemoveMentorshipAssignmentGroupDto extends createZodDto(
  removeMentorshipAssignmentGroupSchema,
) {}
export class MentorshipAssignmentParamDto extends createZodDto(
  mentorshipAssignmentParamSchema,
) {}
export class MentorshipAssignmentGroupParamDto extends createZodDto(
  mentorshipAssignmentGroupParamSchema,
) {}
export class ListMentorshipPlanQueryDto extends createZodDto(
  listMentorshipPlanQuerySchema,
) {}
export class CreateMentorshipEventDto extends createZodDto(
  createMentorshipEventSchema,
) {}
export class UpdateMentorshipEventDto extends createZodDto(
  updateMentorshipEventSchema,
) {}
export class CancelMentorshipEventDto extends createZodDto(
  cancelMentorshipEventSchema,
) {}
export class MentorshipEventParamDto extends createZodDto(
  mentorshipEventParamSchema,
) {}
export class MentorshipCoachNoteDto extends createZodDto(mentorshipCoachNoteSchema) {}
export class MentorshipAttentionDto extends createZodDto(mentorshipAttentionSchema) {}
export class SaveMentorshipTemplateDto extends createZodDto(saveMentorshipTemplateSchema) {}
export class MentorshipTemplateParamDto extends createZodDto(mentorshipTemplateParamSchema) {}
export class RegisterCoachDto extends createZodDto(registerCoachSchema) {}
export class UpdateCoachProfileDto extends createZodDto(updateCoachProfileSchema) {}

import {
  createMentorshipAssignmentsSchema,
  listMentorshipStudentsQuerySchema,
  mentorshipAttentionSchema,
  mentorshipCoachNoteSchema,
  mentorshipInviteCodeParamSchema,
  mentorshipStudentParamSchema,
  mentorshipTemplateParamSchema,
  saveMentorshipTemplateSchema,
  submitCoachApplicationSchema,
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
export class MentorshipCoachNoteDto extends createZodDto(mentorshipCoachNoteSchema) {}
export class MentorshipAttentionDto extends createZodDto(mentorshipAttentionSchema) {}
export class SaveMentorshipTemplateDto extends createZodDto(saveMentorshipTemplateSchema) {}
export class MentorshipTemplateParamDto extends createZodDto(mentorshipTemplateParamSchema) {}
export class SubmitCoachApplicationDto extends createZodDto(submitCoachApplicationSchema) {}
export class UpdateCoachProfileDto extends createZodDto(updateCoachProfileSchema) {}

import {
  listMentorshipStudentsQuerySchema,
  mentorshipInviteCodeParamSchema,
  mentorshipStudentParamSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class MentorshipInviteCodeParamDto extends createZodDto(mentorshipInviteCodeParamSchema) {}
export class ListMentorshipStudentsQueryDto extends createZodDto(
  listMentorshipStudentsQuerySchema,
) {}
export class MentorshipStudentParamDto extends createZodDto(mentorshipStudentParamSchema) {}

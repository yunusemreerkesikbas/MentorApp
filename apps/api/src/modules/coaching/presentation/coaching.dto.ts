import {
  createMoodCheckinSchema,
  createMockExamSchema,
  createPlanTaskSchema,
  listMockExamsQuerySchema,
  listMoodCheckinsQuerySchema,
  listPlanTasksQuerySchema,
  startStudySessionSchema,
  updatePlanTaskSchema,
  updateStudySessionSchema,
  upsertVisionSchema,
} from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";

export class CreatePlanTaskDto extends createZodDto(createPlanTaskSchema) {}
export class UpdatePlanTaskDto extends createZodDto(updatePlanTaskSchema) {}
export class ListPlanTasksQueryDto extends createZodDto(listPlanTasksQuerySchema) {}
export class StartStudySessionDto extends createZodDto(startStudySessionSchema) {}
export class UpdateStudySessionDto extends createZodDto(updateStudySessionSchema) {}
export class CreateMoodCheckinDto extends createZodDto(createMoodCheckinSchema) {}
export class ListMoodCheckinsQueryDto extends createZodDto(listMoodCheckinsQuerySchema) {}
export class CreateMockExamDto extends createZodDto(createMockExamSchema) {}
export class ListMockExamsQueryDto extends createZodDto(listMockExamsQuerySchema) {}
export class UpsertVisionDto extends createZodDto(upsertVisionSchema) {}

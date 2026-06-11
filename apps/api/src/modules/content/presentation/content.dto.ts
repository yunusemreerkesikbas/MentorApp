import { createZodDto } from "../../../common/validation/zod-dto";
import {
  examFamilyParamSchema,
  examSlugParamSchema,
  infoArticleSlugParamSchema,
  listInfoArticlesQuerySchema,
  paginationQuerySchema,
} from "@mentor/validation";

export class ListExamsQueryDto extends createZodDto(paginationQuerySchema) {}

export class ExamFamilyParamDto extends createZodDto(examFamilyParamSchema) {}

export class ExamSlugParamDto extends createZodDto(examSlugParamSchema) {}

export class ListInfoArticlesQueryDto extends createZodDto(listInfoArticlesQuerySchema) {}

export class InfoArticleSlugParamDto extends createZodDto(infoArticleSlugParamSchema) {}

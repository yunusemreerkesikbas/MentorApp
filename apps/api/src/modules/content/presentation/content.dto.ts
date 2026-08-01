import { createZodDto } from "../../../common/validation/zod-dto";
import {
  examFamilyParamSchema,
  examSlugParamSchema,
  geoSearchQuerySchema,
  infoArticleSlugParamSchema,
  listInfoArticlesQuerySchema,
  listPublicHolidaysQuerySchema,
  paginationQuerySchema,
} from "@mentor/validation";

export class ListExamsQueryDto extends createZodDto(paginationQuerySchema) {}

export class ExamFamilyParamDto extends createZodDto(examFamilyParamSchema) {}

export class ExamSlugParamDto extends createZodDto(examSlugParamSchema) {}

export class ListInfoArticlesQueryDto extends createZodDto(listInfoArticlesQuerySchema) {}

export class InfoArticleSlugParamDto extends createZodDto(infoArticleSlugParamSchema) {}

export class ListPublicHolidaysQueryDto extends createZodDto(
  listPublicHolidaysQuerySchema,
) {}

export class GeoSearchQueryDto extends createZodDto(geoSearchQuerySchema) {}

import { createZodDto } from "../../../common/validation/zod-dto";
import {
  examFamilyCurrentQuerySchema,
  examFamilyParamSchema,
  examSlugParamSchema,
  geoSearchQuerySchema,
  featuredArticleQuerySchema,
  infoArticleSlugParamSchema,
  listInfoArticlesQuerySchema,
  listPublicHolidaysQuerySchema,
  paginationQuerySchema,
  programCatalogSearchQuerySchema,
} from "@mentor/validation";

export class ListExamsQueryDto extends createZodDto(paginationQuerySchema) {}

export class ExamFamilyParamDto extends createZodDto(examFamilyParamSchema) {}

export class ExamFamilyCurrentQueryDto extends createZodDto(
  examFamilyCurrentQuerySchema,
) {}

export class ExamSlugParamDto extends createZodDto(examSlugParamSchema) {}

export class ListInfoArticlesQueryDto extends createZodDto(listInfoArticlesQuerySchema) {}

export class FeaturedArticleQueryDto extends createZodDto(featuredArticleQuerySchema) {}

export class InfoArticleSlugParamDto extends createZodDto(infoArticleSlugParamSchema) {}

export class ListPublicHolidaysQueryDto extends createZodDto(
  listPublicHolidaysQuerySchema,
) {}

export class GeoSearchQueryDto extends createZodDto(geoSearchQuerySchema) {}
export class ProgramCatalogSearchQueryDto extends createZodDto(
  programCatalogSearchQuerySchema,
) {}

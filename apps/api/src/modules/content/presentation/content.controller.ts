import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { ExamCalendarDto, Paginated, ExamSummaryDto } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { ContentService } from "../application/content.service";
import { ListExamsQueryDto } from "./content.dto";

/** Public editorial exam calendar — reference data (guardrail §4 #1 data cards). */
@ApiTags("content")
@Public()
@Controller("content/exams")
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  listExams(@Query() query: ListExamsQueryDto): Promise<Paginated<ExamSummaryDto>> {
    return this.content.listExams(query);
  }

  @Get("by-type/:type/calendar")
  calendarByFamily(@Param("type") type: string): Promise<ExamCalendarDto | null> {
    return this.content.getExamCalendarByFamily(type);
  }

  @Get(":slug/calendar")
  calendarBySlug(@Param("slug") slug: string): Promise<ExamCalendarDto> {
    return this.content.getCalendarBySlug(slug);
  }
}

import { Controller, Get, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { PublicHolidayDto } from "@mentor/types";
import { Public } from "../../../common/auth/public.decorator";
import { ContentService } from "../application/content.service";
import { ListPublicHolidaysQueryDto } from "./content.dto";

/** Public editorial holiday calendar — reference data (guardrail §4 #1 data cards). */
@ApiTags("content")
@Public()
@Controller("content/holidays")
export class PublicHolidayController {
  constructor(private readonly content: ContentService) {}

  @Get()
  list(@Query() query: ListPublicHolidaysQueryDto): Promise<PublicHolidayDto[]> {
    return this.content.listPublicHolidays(query);
  }
}

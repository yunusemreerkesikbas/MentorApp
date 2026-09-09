import type {
  NotebookReviewSummary,
  NotebookReviewHistoryItem,
  Paginated,
} from "@mentor/types";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiQuery, ApiOkResponse } from "@nestjs/swagger";
import { notebookReviewQuerySchema } from "@mentor/validation";
import { createZodDto } from "../../../common/validation/zod-dto";
import {
  CurrentUser,
  type RequestUser,
} from "../../../common/auth/current-user";
import { NotebookReviewService } from "../application/notebook-review.service";
export class NotebookReviewQueryDto extends createZodDto(
  notebookReviewQuerySchema,
) {}
const focusProperties = {
  examId: { type: "string" as const, format: "uuid" },
  subjectRef: { type: "string" as const, nullable: true },
  topicRef: { type: "string" as const, nullable: true },
  subjectName: { type: "string" as const, nullable: true },
  topicName: { type: "string" as const, nullable: true },
};
const summarySchema = {
  type: "object" as const,
  required: ["workedCount", "revisitCount", "completedCount", "dueCount", "since", "days", "focuses"],
  properties: {
    workedCount: { type: "integer" as const }, revisitCount: { type: "integer" as const },
    completedCount: { type: "integer" as const }, dueCount: { type: "integer" as const },
    since: { type: "string" as const, format: "date-time" }, days: { type: "integer" as const, enum: [7, 30] },
    focuses: { type: "array" as const, items: { type: "object" as const, required: Object.keys(focusProperties), properties: focusProperties } },
  },
};
const historySchema = {
  type: "object" as const, required: ["items", "total", "page", "pageSize"],
  properties: {
    total: { type: "integer" as const }, page: { type: "integer" as const }, pageSize: { type: "integer" as const },
    items: { type: "array" as const, items: { type: "object" as const,
      required: [...Object.keys(focusProperties), "id", "entryId", "solved", "early", "reviewedAt", "nextReviewAt"],
      properties: { ...focusProperties, id: { type: "string" as const, format: "uuid" },
        entryId: { type: "string" as const, format: "uuid" }, solved: { type: "boolean" as const }, early: { type: "boolean" as const },
        reviewedAt: { type: "string" as const, format: "date-time" }, nextReviewAt: { type: "string" as const, format: "date-time", nullable: true } },
    } },
  },
};
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching/notebook")
export class NotebookReviewController {
  constructor(
    @Inject(NotebookReviewService)
    private readonly service: NotebookReviewService,
  ) {}
  @Get("review-summary")
  @ApiOkResponse({ schema: summarySchema })
  @ApiQuery({ name: "examId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "subjectRef", required: false, type: String })
  @ApiQuery({ name: "topicRef", required: false, type: String })
  @ApiQuery({ name: "errorType", required: false, type: String })
  @ApiQuery({ name: "days", required: false, enum: [7, 30] })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  summary(
    @CurrentUser() user: RequestUser,
    @Query() query: NotebookReviewQueryDto,
  ): Promise<NotebookReviewSummary> {
    return this.service.summary(user.id, query);
  }
  @Get("review-history")
  @ApiOkResponse({ schema: historySchema })
  @ApiQuery({ name: "examId", required: false, type: String, format: "uuid" })
  @ApiQuery({ name: "subjectRef", required: false, type: String })
  @ApiQuery({ name: "topicRef", required: false, type: String })
  @ApiQuery({ name: "errorType", required: false, type: String })
  @ApiQuery({ name: "days", required: false, enum: [7, 30] })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  history(
    @CurrentUser() user: RequestUser,
    @Query() query: NotebookReviewQueryDto,
  ): Promise<Paginated<NotebookReviewHistoryItem>> {
    return this.service.history(user.id, query);
  }
}

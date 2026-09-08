import type {
  NotebookReviewSummary,
  NotebookReviewHistoryItem,
  Paginated,
} from "@mentor/types";
import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags, ApiQuery } from "@nestjs/swagger";
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
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("coaching/notebook")
export class NotebookReviewController {
  constructor(
    @Inject(NotebookReviewService)
    private readonly service: NotebookReviewService,
  ) {}
  @Get("review-summary")
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

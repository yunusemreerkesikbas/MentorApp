import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated, PlanEventDto, PlanItemDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PlanEventService } from "../application/plan-event.service";
import { PlanItemService } from "../application/plan-item.service";
import {
  CancelPlanEventDto,
  CreatePlanEventDto,
  ListPlanTasksQueryDto,
  UpdatePlanEventDto,
} from "./coaching.dto";

@ApiTags("coaching")
@ApiBearerAuth()
@Controller()
export class PlanEventController {
  constructor(
    private readonly events: PlanEventService,
    private readonly items: PlanItemService,
  ) {}

  @Get("plan-events")
  listEvents(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPlanTasksQueryDto,
  ): Promise<Paginated<PlanEventDto>> {
    return this.events.list(user.id, query);
  }

  @Post("plan-events")
  createEvent(
    @CurrentUser() user: RequestUser,
    @Body() input: CreatePlanEventDto,
  ): Promise<PlanEventDto> {
    return this.events.create(user.id, input);
  }

  @Patch("plan-events/:id")
  updateEvent(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: UpdatePlanEventDto,
  ): Promise<PlanEventDto> {
    return this.events.update(user.id, id, input);
  }

  @Post("plan-events/:id/cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelEvent(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() input: CancelPlanEventDto,
  ): Promise<void> {
    return this.events.cancel(user.id, id, input);
  }

  /** Backward-compatible aggregate; existing /plan-tasks remains unchanged. */
  @Get("plan-items")
  listItems(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPlanTasksQueryDto,
  ): Promise<Paginated<PlanItemDto>> {
    return this.items.list(user.id, query);
  }
}

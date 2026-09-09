import {
  Controller,
  Get,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated, PlanEventDto, PlanItemDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PlanEventService } from "../application/plan-event.service";
import { PlanItemService } from "../application/plan-item.service";
import {
  ListPlanTasksQueryDto,
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

  /** Backward-compatible aggregate; existing /plan-tasks remains unchanged. */
  @Get("plan-items")
  listItems(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPlanTasksQueryDto,
  ): Promise<Paginated<PlanItemDto>> {
    return this.items.list(user.id, query);
  }
}

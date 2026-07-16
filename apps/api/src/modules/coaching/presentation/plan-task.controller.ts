import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Paginated, PlanTaskCalendarDto, PlanTaskDto } from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { PlanService } from "../application/plan.service";
import {
  BulkCreatePlanTasksDto,
  CreatePlanTaskDto,
  ListPlanTasksQueryDto,
  PlanTaskCalendarQueryDto,
  UpdatePlanTaskDto,
} from "./coaching.dto";

/** Plan tasks (today's plan) — authenticated self resource (global JwtAuthGuard applies). */
@ApiTags("coaching")
@ApiBearerAuth()
@Controller("plan-tasks")
export class PlanTaskController {
  constructor(private readonly plan: PlanService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query() query: ListPlanTasksQueryDto,
  ): Promise<Paginated<PlanTaskDto>> {
    return this.plan.list(user.id, query);
  }

  @Get("calendar")
  listCalendar(
    @CurrentUser() user: RequestUser,
    @Query() query: PlanTaskCalendarQueryDto,
  ): Promise<PlanTaskCalendarDto> {
    return this.plan.listCalendarDates(user.id, query);
  }

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreatePlanTaskDto,
  ): Promise<PlanTaskDto> {
    return this.plan.create(user.id, dto);
  }

  /** User-confirmed batch add (e.g. accepted coach draft). All-or-nothing on invalid dates. */
  @Post("bulk")
  createMany(
    @CurrentUser() user: RequestUser,
    @Body() dto: BulkCreatePlanTasksDto,
  ): Promise<PlanTaskDto[]> {
    return this.plan.createMany(user.id, dto.tasks);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlanTaskDto,
  ): Promise<PlanTaskDto> {
    return this.plan.update(user.id, id, dto);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(
    @CurrentUser() user: RequestUser,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.plan.remove(user.id, id);
  }
}

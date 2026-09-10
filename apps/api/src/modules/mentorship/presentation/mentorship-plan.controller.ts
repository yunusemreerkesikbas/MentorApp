import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import {
  UserRole,
  type CoachPlanEventDto,
  type CoachPlanItemDto,
  type Paginated,
  type PlanTaskDto,
} from "@mentor/types";
import { CurrentUser, type RequestUser } from "../../../common/auth/current-user";
import { Roles } from "../../../common/auth/roles.decorator";
import { MentorshipAssignmentService } from "../application/mentorship-assignment.service";
import { MentorshipEventService } from "../application/mentorship-event.service";
import { MentorshipPlanOrchestrationService } from "../application/mentorship-plan-orchestration.service";
import {
  CancelMentorshipEventDto,
  CreateMentorshipBatchAssignmentDto,
  CreateMentorshipEventDto,
  ListMentorshipPlanQueryDto,
  MentorshipAssignmentGroupParamDto,
  MentorshipAssignmentParamDto,
  MentorshipEventParamDto,
  RemoveMentorshipAssignmentGroupDto,
  UpdateMentorshipAssignmentDto,
  UpdateMentorshipAssignmentGroupDto,
  UpdateMentorshipEventDto,
} from "./mentorship.dto";

@ApiTags("mentorship")
@ApiBearerAuth()
@Roles(UserRole.COACH)
@Controller("mentorship")
export class MentorshipPlanController {
  constructor(
    private readonly plan: MentorshipPlanOrchestrationService,
    private readonly assignments: MentorshipAssignmentService,
    private readonly events: MentorshipEventService,
  ) {}

  @Get("plan")
  listPlan(
    @CurrentUser() user: RequestUser,
    @Query() query: ListMentorshipPlanQueryDto,
  ): Promise<Paginated<CoachPlanItemDto>> {
    return this.plan.list(user.id, query);
  }

  @Post("assignments")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  assignBatch(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateMentorshipBatchAssignmentDto,
  ): Promise<PlanTaskDto[]> {
    return this.assignments.assignBatch(user.id, input);
  }

  @Patch("students/:studentId/assignments/:assignmentId")
  updateAssignment(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipAssignmentParamDto,
    @Body() input: UpdateMentorshipAssignmentDto,
  ): Promise<PlanTaskDto> {
    return this.assignments.updateOne(
      user.id,
      params.studentId,
      params.assignmentId,
      input,
    );
  }

  @Delete("students/:studentId/assignments/:assignmentId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAssignment(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipAssignmentParamDto,
  ): Promise<void> {
    return this.assignments.removeOne(
      user.id,
      params.studentId,
      params.assignmentId,
    );
  }

  @Patch("assignment-groups/:assignmentGroupId")
  updateAssignmentGroup(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipAssignmentGroupParamDto,
    @Body() input: UpdateMentorshipAssignmentGroupDto,
  ): Promise<PlanTaskDto[]> {
    return this.assignments.updateGroup(
      user.id,
      params.assignmentGroupId,
      input,
    );
  }

  @Delete("assignment-groups/:assignmentGroupId")
  @HttpCode(HttpStatus.NO_CONTENT)
  removeAssignmentGroup(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipAssignmentGroupParamDto,
    @Body() input: RemoveMentorshipAssignmentGroupDto,
  ): Promise<void> {
    return this.assignments.removeGroup(
      user.id,
      params.assignmentGroupId,
      input,
    );
  }

  @Post("events")
  createPlanEvent(
    @CurrentUser() user: RequestUser,
    @Body() input: CreateMentorshipEventDto,
  ): Promise<CoachPlanEventDto> {
    return this.events.create(user.id, input);
  }

  @Patch("events/:eventId")
  updatePlanEvent(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipEventParamDto,
    @Body() input: UpdateMentorshipEventDto,
  ): Promise<CoachPlanEventDto> {
    return this.events.update(user.id, params.eventId, input);
  }

  @Post("events/:eventId/cancel")
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelPlanEvent(
    @CurrentUser() user: RequestUser,
    @Param() params: MentorshipEventParamDto,
    @Body() input: CancelMentorshipEventDto,
  ): Promise<void> {
    return this.events.cancel(user.id, params.eventId, input);
  }
}

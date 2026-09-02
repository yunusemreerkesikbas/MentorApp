import { HttpStatus, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { PlanTaskDto } from "@mentor/types";
import type { CreateMentorshipAssignmentsInput } from "@mentor/validation";
import { PlanService } from "../../coaching/application/plan.service";
import { UsersService } from "../../identity/application/users.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { addDays, todayIso } from "../../coaching/domain/date.util";
import {
  MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD,
  MentorshipAssignmentsCreated,
  MentorshipEventTopic,
} from "../domain/mentorship.constants";
import { MentorshipLinkService } from "./mentorship-link.service";

/**
 * Coach-assigned homework (W8 slice 3).
 *
 * There is no assignments table. An assignment IS a plan task with `origin_type = 'MENTORSHIP'`,
 * so it lands in the screen the student already opens every morning and counts toward
 * `daily_activity`, the streak and the panel with no extra wiring. A parallel to-do list would
 * have split the daily loop in two and made "did you do it" a question with two answers.
 *
 * W2 alone writes `plan_tasks` (workstreams §2) — this service calls coaching's public
 * `PlanService.createFromMentorship` seam and never touches the table.
 */
@Injectable()
export class MentorshipAssignmentService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly plan: PlanService,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  async assign(
    coachId: string,
    studentId: string,
    input: CreateMentorshipAssignmentsInput,
  ): Promise<PlanTaskDto[]> {
    await this.links.assertEnabled();
    // The gate first, always: a coach may only write into a student who accepted them.
    const link = await this.links.requireActiveLink(coachId, studentId);
    this.assertWithinHorizon(input);

    const tasks = await this.plan.createFromMentorship(studentId, input.tasks, link.id);

    const coach = (await this.users.listDisplayIdentities([coachId])).get(coachId);
    this.events.emit(
      MentorshipEventTopic.ASSIGNMENTS_CREATED,
      new MentorshipAssignmentsCreated(
        link.id,
        coachId,
        studentId,
        coach?.displayName ?? "",
        tasks.length,
        // Earliest date, so the notification can deep-link to the day the work starts.
        tasks.reduce(
          (earliest, task) => (task.taskDate < earliest ? task.taskDate : earliest),
          tasks[0]!.taskDate,
        ),
      ),
    );
    return tasks;
  }

  /** The past is refused by coaching's own `assertTaskDateMutable`; this bounds the other end. */
  private assertWithinHorizon(input: CreateMentorshipAssignmentsInput): void {
    const limit = addDays(todayIso(), MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD);
    if (input.tasks.some((task) => task.taskDate !== undefined && task.taskDate > limit)) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_ASSIGNMENT_TOO_FAR,
        HttpStatus.BAD_REQUEST,
        { maxDaysAhead: MENTORSHIP_ASSIGNMENT_MAX_DAYS_AHEAD },
      );
    }
  }
}

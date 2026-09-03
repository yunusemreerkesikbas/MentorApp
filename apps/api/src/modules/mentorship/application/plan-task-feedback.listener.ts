import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OnEvent } from "@nestjs/event-emitter";
import {
  CoachingEventTopic,
  PlanTaskCompleted,
  PlanTaskDeleted,
} from "../../coaching/domain/coaching.events";
import { UsersService } from "../../identity/application/users.service";
import {
  MentorshipAssignmentDropped,
  MentorshipAssignmentProgressed,
  MentorshipEventTopic,
} from "../domain/mentorship.constants";
import { MentorshipDroppedAssignmentRepository } from "../infrastructure/mentorship-dropped-assignment.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";

/**
 * Closes the assignment loop: coaching says what happened to a plan task, this translates it into
 * something a COACH would want to hear.
 *
 * The translation has to live here. Coaching emits about `plan_tasks` and knows nothing about
 * links; notifications knows how to send but cannot turn an `origin_ref_id` into a coach, because
 * that means reading `coach_students` — W8's table. So W8 sits in the middle and does the one
 * lookup it owns, exactly like coaching's own `NotebookForumListener` bridges forum → notebook.
 */
@Injectable()
export class PlanTaskFeedbackListener {
  private readonly logger = new Logger(PlanTaskFeedbackListener.name);

  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly dropped: MentorshipDroppedAssignmentRepository,
    private readonly users: UsersService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * The student removed a task their coach assigned. Worth telling: the report shows the living
   * plan, not its history, so an assignment that disappears would otherwise just never be
   * mentioned again — and the coach would read its absence as "never assigned".
   */
  @OnEvent(CoachingEventTopic.PLAN_TASK_DELETED)
  async onPlanTaskDeleted(event: PlanTaskDeleted): Promise<void> {
    await this.forward(event, async (link, displayName) => {
      this.events.emit(
        MentorshipEventTopic.ASSIGNMENT_DROPPED,
        new MentorshipAssignmentDropped(
          link.id,
          link.coachId,
          event.userId,
          displayName,
          event.title,
        ),
      );
      // Notify first, log second. Both can fail, and the timely signal is the half worth
      // protecting: a coach who hears nothing cannot intervene, while a missing history row only
      // costs them the retrospective. The log is what makes the report stop lying by omission.
      await this.dropped.record(link.id, event.title, event.taskDate);
    });
  }

  /** The student did the work — including via a session seated at the task, which is still doing it. */
  @OnEvent(CoachingEventTopic.PLAN_TASK_COMPLETED)
  async onPlanTaskCompleted(event: PlanTaskCompleted): Promise<void> {
    await this.forward(event, (link, displayName) => {
      this.events.emit(
        MentorshipEventTopic.ASSIGNMENT_PROGRESSED,
        // No date travels: the notification is deduped on the day the coach is told, not on the
        // day the task was scheduled for (see MentorshipEventsListener.onAssignmentProgressed).
        new MentorshipAssignmentProgressed(link.id, link.coachId, event.userId, displayName),
      );
    });
  }

  /**
   * Shared guard for both directions. Three ways to be uninteresting, all of them normal:
   * the task was never a coach's, the link is gone (erasure), or the link has ended — and a coach
   * who no longer follows this student must hear nothing about them, exactly as the roster's
   * `metrics: null` rule says.
   */
  private async forward(
    event: { userId: string; originType: string | null; originRefId: string | null },
    emit: (
      link: { id: string; coachId: string },
      studentDisplayName: string,
    ) => void | Promise<void>,
  ): Promise<void> {
    if (event.originType !== "MENTORSHIP" || !event.originRefId) return;
    try {
      // Both lookups are needed whenever the link is live, which is the overwhelmingly common
      // case, so they go in parallel rather than paying two serial round trips per completion.
      const [link, people] = await Promise.all([
        this.links.findById(event.originRefId),
        this.users.listDisplayIdentities([event.userId]),
      ]);
      if (!link || link.status !== "ACTIVE") return;
      await emit(link, people.get(event.userId)?.displayName ?? "");
    } catch (err) {
      // Logged, not swallowed silently: the plan change already committed, so throwing here would
      // fail an action that succeeded — but a listener that vanishes without trace is undebuggable.
      this.logger.error(
        `Mentorship: could not forward plan-task feedback for link ${event.originRefId}`,
        err as Error,
      );
    }
  }
}

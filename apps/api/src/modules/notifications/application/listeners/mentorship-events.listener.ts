import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import {
  MentorshipAssignmentDropped,
  MentorshipAssignmentProgressed,
  MentorshipAssignmentsCreated,
  MentorshipEventTopic,
  MentorshipNoteUpdated,
  MentorshipLinkAccepted,
  MentorshipLinkEnded,
} from "../../../mentorship/domain/mentorship.constants";
import { todayIso } from "../../../coaching/domain/date.util";
import { NotificationCopyKey } from "../../domain/notification-copy";
import { NotificationsService } from "../notifications.service";

/**
 * Mentorship domain events → in-app notifications (W8).
 *
 * All five are transactional, not campaign: something happened to a relationship the person is
 * in, so they land in the inbox regardless of campaign preferences (email/push still honour the
 * per-user channel switches inside NotificationsService).
 *
 * Every send is best-effort. The link and the assignment are already committed when we get here;
 * a notification failure must not surface as an error to the coach who assigned the work.
 */
@Injectable()
export class MentorshipEventsListener {
  constructor(private readonly notifications: NotificationsService) {}

  /** The coach hears that their invite was accepted; the student already saw the confirmation. */
  @OnEvent(MentorshipEventTopic.LINK_ACCEPTED)
  async onLinkAccepted(event: MentorshipLinkAccepted): Promise<void> {
    await this.notifications
      .createFromTemplate(
        event.coachId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_STUDENT_JOINED,
        "/students",
        { args: { name: event.studentDisplayName } },
      )
      .catch(() => {});
  }

  @OnEvent(MentorshipEventTopic.ASSIGNMENTS_CREATED)
  async onAssignmentsCreated(event: MentorshipAssignmentsCreated): Promise<void> {
    await this.notifications
      .createFromTemplate(
        event.studentId,
        "MENTORSHIP",
        event.taskCount === 1
          ? NotificationCopyKey.MENTORSHIP_ASSIGNED_SINGULAR
          : NotificationCopyKey.MENTORSHIP_ASSIGNED_PLURAL,
        `/plan?date=${event.firstTaskDate}`,
        { args: { name: event.coachDisplayName, count: event.taskCount } },
      )
      .catch(() => {});
  }

  /**
   * One per assignment, undeduped: removals are rare, and each one is a separate fact the report
   * will never mention again. A per-day dedupe would report three removals as "a task", which is
   * the same quiet untruth the notification exists to prevent. The title travels because the coach
   * wrote it — reading back their own words crosses no trust line.
   */
  @OnEvent(MentorshipEventTopic.ASSIGNMENT_DROPPED)
  async onAssignmentDropped(event: MentorshipAssignmentDropped): Promise<void> {
    await this.notifications
      .createFromTemplate(
        event.coachId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_ASSIGNMENT_DROPPED,
        `/students/${event.studentId}`,
        { args: { name: event.studentDisplayName, title: event.taskTitle } },
      )
      .catch(() => {});
  }

  /**
   * At most one per student per day, and deliberately vague about how many: a coach with twenty
   * students would otherwise get a completion storm every evening. "A task" is true on the first
   * completion and still true after the dedupe drops the rest.
   *
   * The key is TODAY — the day the coach is being told — not the task's own `taskDate`. Keying on
   * the scheduled date meant a student clearing a week the coach had composed (7 different dates)
   * got 7 distinct keys and sent 7 notifications in one evening: precisely the storm this prevents.
   */
  @OnEvent(MentorshipEventTopic.ASSIGNMENT_PROGRESSED)
  async onAssignmentProgressed(event: MentorshipAssignmentProgressed): Promise<void> {
    await this.notifications
      .createFromTemplate(
        event.coachId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_ASSIGNMENT_PROGRESSED,
        `/students/${event.studentId}`,
        {
          args: { name: event.studentDisplayName },
          dedupeKey: `mentorship-progress:${event.studentId}:${todayIso()}`,
        },
      )
      .catch(() => {});
  }

  /**
   * The coach left a standing note. Deduped to one a day, like progress: a coach rewording a
   * sentence five times is still one piece of news. Clearing a note emits nothing at all, so
   * nothing reaches here for it.
   */
  @OnEvent(MentorshipEventTopic.NOTE_UPDATED)
  async onNoteUpdated(event: MentorshipNoteUpdated): Promise<void> {
    await this.notifications
      .createFromTemplate(
        event.studentId,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_COACH_NOTE,
        "/my-coach",
        {
          args: { name: event.coachDisplayName },
          dedupeKey: `mentorship-note:${event.studentId}:${todayIso()}`,
        },
      )
      .catch(() => {});
  }

  /** Only the other party is told: whoever ended it does not need to be informed they did. */
  @OnEvent(MentorshipEventTopic.LINK_ENDED)
  async onLinkEnded(event: MentorshipLinkEnded): Promise<void> {
    const recipient =
      event.endedBy === event.coachId ? event.studentId : event.coachId;
    const linkUrl = recipient === event.coachId ? "/students" : "/my-coach";
    await this.notifications
      .createFromTemplate(
        recipient,
        "MENTORSHIP",
        NotificationCopyKey.MENTORSHIP_LINK_ENDED,
        linkUrl,
        { args: { name: event.actorDisplayName } },
      )
      .catch(() => {});
  }
}

import { Injectable } from "@nestjs/common";
import type { MentorshipSharedDataDto } from "@mentor/types";
import {
  CohortEvidenceService,
  REPORT_MOOD_WINDOW_DAYS,
  REPORT_PLAN_WINDOW_DAYS,
  ROSTER_WINDOW_DAYS,
} from "../../coaching/application/cohort-evidence.service";
import { UsersService } from "../../identity/application/users.service";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

/**
 * What is being handed to my coach, right now, with the actual numbers in it (W8).
 *
 * APP-073 gave the COACH a mirror of the scope contract, because "the one asymmetry the trust line
 * cannot carry is the side GIVING the data knowing less about the limits than the side RECEIVING
 * it". On the student's side that list was still a promise: `/kocum` says "your study time, session
 * count, active days and streak" without ever saying how many. This turns the promise into a report.
 *
 * **Deliberately not on `MentorshipRosterService`.** Every method there is gated by
 * `requireActiveLink(coachId, studentId)` — "may this coach read this student". This one is gated
 * by "am I this student". Two authorization models in one file is the shortest path to the next
 * person calling the wrong one, so the gate gets its own door.
 *
 * The snapshot is fetched WITHOUT a mentorship link id, which is the whole reason no coach-authored
 * field can leak here: `coachNote` and `assignedByCoach` are absent because the parameter that
 * produces them was never passed, not because something filtered them out afterwards.
 */
@Injectable()
export class MentorshipSelfViewService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly linkRepo: MentorshipLinkRepository,
    private readonly evidence: CohortEvidenceService,
    private readonly users: UsersService,
  ) {}

  /**
   * Null when nothing is being shared — no active coach means no data leaving, so there is nothing
   * to mirror and the screen keeps its existing "you have no coach" state.
   */
  async getSharedData(
    studentId: string,
    now = new Date(),
  ): Promise<MentorshipSharedDataDto | null> {
    await this.links.assertEnabled();
    const link = await this.linkRepo.findActiveByStudent(studentId);
    if (!link) return null;

    const [report, profile] = await Promise.all([
      // No link id on purpose — see the class header.
      this.evidence.getStudentReport(studentId, now),
      this.users.getDiscoveryProfile(studentId),
    ]);

    const { activity } = report;
    // "Has this student ever done anything" — asked of the numbers rather than of a flag, so a
    // student who has genuinely never studied gets an honest empty line instead of a row of zeroes
    // presented as a report.
    const hasActivity =
      activity.lastActiveDate !== null ||
      activity.sessions28d > 0 ||
      activity.longestStreak > 0;

    const moodCount = report.moodTrend.length;

    return {
      activity: hasActivity
        ? {
            windowDays: ROSTER_WINDOW_DAYS,
            sessions7d: activity.sessions7d,
            focusMinutes7d: activity.focusMinutes7d,
            activeDays7d: activity.activeDays7d,
            currentStreak: activity.currentStreak,
            longestStreak: activity.longestStreak,
            lastActiveDate: activity.lastActiveDate,
          }
        : null,
      planTasks:
        report.planTasks.length > 0 || report.planCompletionRate7d !== null
          ? {
              titleWindowDays: REPORT_PLAN_WINDOW_DAYS,
              titleCount: report.planTasks.length,
              planCompletionRate7d: report.planCompletionRate7d,
            }
          : null,
      mood:
        moodCount > 0
          ? {
              windowDays: REPORT_MOOD_WINDOW_DAYS,
              count: moodCount,
              // One decimal, computed here rather than on the client: the FE never recomputes a
              // number (standards/frontend.md), and an average rendered two different ways on two
              // screens is the kind of drift this whole feature exists to prevent.
              average:
                Math.round(
                  (report.moodTrend.reduce((sum, day) => sum + day.level, 0) / moodCount) * 10,
                ) / 10,
            }
          : null,
      // A pointer, not a restatement: the nets and the per-subject breakdown are already on the
      // student's own analysis screen, in more detail than the coach ever receives.
      mockExams:
        report.mockTrend.length > 0
          ? { count: report.mockTrend.length, latestAt: report.mockTrend[0]!.takenAt }
          : null,
      examType: profile.examType,
    };
  }
}

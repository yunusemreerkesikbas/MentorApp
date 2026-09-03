import { Injectable } from "@nestjs/common";
import type {
  MentorshipLinkStatus,
  MentorshipRosterRowDto,
  MentorshipStudentReportDto,
  Paginated,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { CohortEvidenceService } from "../../coaching/application/cohort-evidence.service";
import { todayIso } from "../../coaching/domain/date.util";
import { UsersService } from "../../identity/application/users.service";
import {
  compareByRisk,
  evaluateRiskFlags,
  type RiskThresholds,
} from "../domain/risk-flags";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

/**
 * The coach's read surface: roster with triage, and the single-student report.
 *
 * Every student-scoped read here goes through {@link MentorshipLinkService.requireActiveLink} or is
 * derived from links this coach owns. The numbers come from coaching's exported
 * {@link CohortEvidenceService}; this module never queries a coaching table.
 */
@Injectable()
export class MentorshipRosterService {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly linkService: MentorshipLinkService,
    private readonly evidence: CohortEvidenceService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
  ) {}

  /**
   * The roster. Ordered by risk, not alphabetically: the point of the screen is "who needs me
   * today", and a coach with twenty students should not have to read twenty rows to find out.
   *
   * Ordering happens on the page, not across the whole cohort — the DB page comes back
   * chronologically and is then risk-sorted. With a 500-student ceiling and a page size of 100,
   * a page is a meaningful slice; whole-cohort ranking would mean scoring every student on
   * every request.
   */
  async listRoster(
    coachId: string,
    status: MentorshipLinkStatus,
    page: number,
    pageSize: number,
    now = new Date(),
  ): Promise<Paginated<MentorshipRosterRowDto>> {
    await this.linkService.assertEnabled();
    const { rows, total } = await this.links.listByCoach(coachId, status, page, pageSize);
    if (rows.length === 0) return { items: [], total, page, pageSize };

    // Only ACTIVE links get metrics. Ending a link revokes consent, so the history tab shows that
    // the relationship existed and nothing about how the student is doing now.
    const activeStudentIds = rows
      .filter((row) => row.status === "ACTIVE")
      .map((row) => row.studentId);
    const [people, snapshots, thresholds] = await Promise.all([
      this.users.listDisplayIdentities(rows.map((row) => row.studentId)),
      this.evidence.listCohortSnapshots(activeStudentIds, now),
      this.thresholds(),
    ]);
    const today = todayIso(now);

    const items = rows.map((link): MentorshipRosterRowDto => {
      const person = people.get(link.studentId);
      const snapshot = snapshots.get(link.studentId);
      return {
        linkId: link.id,
        studentId: link.studentId,
        studentDisplayName: person?.displayName ?? "",
        studentUsername: person?.username ?? null,
        status: link.status as MentorshipLinkStatus,
        acceptedAt: link.acceptedAt?.toISOString() ?? null,
        endedAt: link.endedAt?.toISOString() ?? null,
        metrics: snapshot
          ? {
              lastActiveDate: snapshot.lastActiveDate,
              currentStreak: snapshot.currentStreak,
              focusMinutes7d: snapshot.focusMinutes7d,
              sessions7d: snapshot.sessions7d,
              activeDays7d: snapshot.activeDays7d,
              planCompletionRate7d: snapshot.planCompletionRate7d,
              latestMockNet: snapshot.latestMockNet,
              latestMockAt: snapshot.latestMockAt,
              moodLevel7dAvg: snapshot.moodLevel7dAvg,
            }
          : null,
        riskFlags: snapshot ? evaluateRiskFlags(snapshot, thresholds, today) : [],
      };
    });
    items.sort(compareByRisk);
    return { items, total, page, pageSize };
  }

  /** One student's report. 404s unless this coach holds an ACTIVE link to them. */
  async getStudentReport(
    coachId: string,
    studentId: string,
    now = new Date(),
  ): Promise<MentorshipStudentReportDto> {
    await this.linkService.assertEnabled();
    const link = await this.linkService.requireActiveLink(coachId, studentId);

    // `link.id` scopes the coach-authored fields on the plan rows to THIS coach: a note left by a
    // previous coach on a task that outlived their link must not be readable by the current one.
    const [person, profile, report, snapshots, thresholds] = await Promise.all([
      this.users.listDisplayIdentities([studentId]),
      this.users.getDiscoveryProfile(studentId),
      this.evidence.getStudentReport(studentId, now, link.id),
      this.evidence.listCohortSnapshots([studentId], now),
      this.thresholds(),
    ]);
    const snapshot = snapshots.get(studentId)!;

    return {
      studentId,
      studentDisplayName: person.get(studentId)?.displayName ?? "",
      studentUsername: person.get(studentId)?.username ?? null,
      acceptedAt: link.acceptedAt?.toISOString() ?? null,
      // Scope key EXAM_TRACK: the coach needs it to offer topics from the right taxonomy.
      studentExamType: profile.examType,
      riskFlags: evaluateRiskFlags(snapshot, thresholds, todayIso(now)),
      ...report,
    };
  }

  private async thresholds(): Promise<RiskThresholds> {
    const [inactiveDays, planCompletionFloor, lowMoodCeiling] = await Promise.all([
      this.config.get("mentorship.risk.inactive_days"),
      this.config.get("mentorship.risk.plan_completion_floor"),
      this.config.get("mentorship.risk.low_mood_ceiling"),
    ]);
    return { inactiveDays, planCompletionFloor, lowMoodCeiling };
  }
}

import { Injectable } from "@nestjs/common";
import type {
  MentorshipLinkStatus,
  MentorshipRiskFlagId,
  MentorshipRosterRowDto,
  MentorshipStudentReportDto,
  Paginated,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { CohortEvidenceService } from "../../coaching/application/cohort-evidence.service";
import { addDays, todayIso } from "../../coaching/domain/date.util";
import { UsersService } from "../../identity/application/users.service";
import {
  MENTORSHIP_DROPPED_LIMIT,
  MENTORSHIP_DROPPED_WINDOW_DAYS,
} from "../domain/mentorship.constants";
import { needsAttention } from "../domain/attention";
import {
  compareByRisk,
  evaluateRiskFlags,
  type RiskThresholds,
} from "../domain/risk-flags";
import { toCoachNoteDto } from "../domain/coach-note";
import { MentorshipDroppedAssignmentRepository } from "../infrastructure/mentorship-dropped-assignment.repository";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

/**
 * The coach's triage surface: the roster, the single-student report, and the coach's own mark on
 * both. The mark is a write, but it belongs here rather than on the link service because it is a
 * fact ABOUT the triage — recording it means evaluating the same flags this file already computes.
 *
 * Every student-scoped read here goes through {@link MentorshipLinkService.requireActiveLink} or is
 * derived from links this coach owns. The numbers come from coaching's exported
 * {@link CohortEvidenceService}; this module never queries a coaching table.
 */
@Injectable()
export class MentorshipRosterService {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly dropped: MentorshipDroppedAssignmentRepository,
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
    const [people, snapshots, thresholds, attentionTtlDays] = await Promise.all([
      this.users.listDisplayIdentities(rows.map((row) => row.studentId)),
      this.evidence.listCohortSnapshots(activeStudentIds, now),
      this.thresholds(),
      this.config.get("mentorship.attention.ttl_days"),
    ]);
    const today = todayIso(now);

    const items = rows.map((link): MentorshipRosterRowDto => {
      const person = people.get(link.studentId);
      const snapshot = snapshots.get(link.studentId);
      const flags = snapshot ? evaluateRiskFlags(snapshot, thresholds, today) : [];
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
        riskFlags: flags,
        // An ENDED link carries no mark for the same reason it carries no metrics: the coach's
        // window is closed, and "you handled this" is a statement about data they can no longer see.
        attendedAt: snapshot ? (link.attendedAt?.toISOString() ?? null) : null,
        needsAttention: snapshot
          ? needsAttention(
              flags,
              link.attendedAt,
              (link.attendedFlags ?? []) as MentorshipRiskFlagId[],
              attentionTtlDays,
              now,
            )
          : false,
      };
    });
    items.sort(compareByRisk);
    return { items, total, page, pageSize };
  }

  /**
   * The coach marks a student handled, or takes the mark back.
   *
   * The flags are evaluated HERE, not taken from the request. A client-supplied set could silence a
   * flag that landed after the page rendered, and the coach would be told they had dealt with
   * something they never saw. It costs one snapshot call — the same one the report already makes.
   *
   * Marking is not "resolved": recovery is still decided by the rules. This only records that the
   * coach looked, so the roster and the morning digest stop repeating themselves.
   */
  async setAttention(
    coachId: string,
    studentId: string,
    attended: boolean,
    now = new Date(),
  ): Promise<void> {
    await this.linkService.assertEnabled();
    const link = await this.linkService.requireActiveLink(coachId, studentId);
    if (!attended) {
      await this.links.setAttention(link.id, null);
      return;
    }
    const [snapshots, thresholds] = await Promise.all([
      this.evidence.listCohortSnapshots([studentId], now),
      this.thresholds(),
    ]);
    const snapshot = snapshots.get(studentId);
    // No snapshot means no evidence to triage. An empty mark is still worth writing: it records
    // that the coach looked, and `needsAttention` reads it as covering nothing if flags appear.
    const flags = snapshot ? evaluateRiskFlags(snapshot, thresholds, todayIso(now)) : [];
    await this.links.setAttention(link.id, flags);
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
    const droppedSince = addDays(todayIso(now), -(MENTORSHIP_DROPPED_WINDOW_DAYS - 1));
    const [person, profile, report, snapshots, thresholds, attentionTtlDays, dropped] =
      await Promise.all([
        this.users.listDisplayIdentities([studentId]),
        this.users.getDiscoveryProfile(studentId),
        this.evidence.getStudentReport(studentId, now, link.id),
        this.evidence.listCohortSnapshots([studentId], now),
        this.thresholds(),
        this.config.get("mentorship.attention.ttl_days"),
        this.dropped.listByLink(link.id, droppedSince, MENTORSHIP_DROPPED_LIMIT),
      ]);
    const snapshot = snapshots.get(studentId)!;
    const flags = evaluateRiskFlags(snapshot, thresholds, todayIso(now));

    return {
      studentId,
      studentDisplayName: person.get(studentId)?.displayName ?? "",
      studentUsername: person.get(studentId)?.username ?? null,
      acceptedAt: link.acceptedAt?.toISOString() ?? null,
      // Scope key EXAM_TRACK: the coach needs it to offer topics from the right taxonomy.
      studentExamType: profile.examType,
      // Read back to the coach who wrote it. Scoped to the live link, so a successor coach starts
      // on a blank page rather than inheriting somebody else's words.
      coachNote: toCoachNoteDto(link),
      riskFlags: flags,
      attendedAt: link.attendedAt?.toISOString() ?? null,
      needsAttention: needsAttention(
        flags,
        link.attendedAt,
        (link.attendedFlags ?? []) as MentorshipRiskFlagId[],
        attentionTtlDays,
        now,
      ),
      ...report,
      // What the living plan cannot say: these were assigned and then removed. Same `link.id`
      // scope as the plan rows, so a previous coach's assignments stay invisible.
      droppedAssignments: dropped.map((row) => ({
        taskDate: row.taskDate,
        title: row.taskTitle,
        droppedAt: row.droppedAt.toISOString(),
      })),
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

import { Injectable } from "@nestjs/common";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { CohortEvidenceService } from "../../coaching/application/cohort-evidence.service";
import { todayIso } from "../../coaching/domain/date.util";
import { UsersService } from "../../identity/application/users.service";
import { evaluateRiskFlags, type RiskThresholds } from "../domain/risk-flags";
import type {
  CoachRiskDigestCandidate,
  CoachRiskDigestStudent,
  MentorshipQueryPort,
} from "../domain/mentorship-query.port";
import { MentorshipLinkRepository } from "./mentorship-link.repository";

/**
 * The mentorship side of the daily risk digest: who has news, and what the news is.
 *
 * The same rules and the same thresholds as the roster (`domain/risk-flags.ts`) — the digest is a
 * delivery channel for the triage, not a second opinion about it. A student the panel calls calm
 * must never be the one the morning email calls at risk.
 *
 * Cost is bounded by the cohort, not by the number of coaches: every linked student is snapshotted
 * in ONE `listCohortSnapshots` call regardless of how many coaches they are spread across.
 */
@Injectable()
export class MentorshipQueryAdapter implements MentorshipQueryPort {
  constructor(
    private readonly links: MentorshipLinkRepository,
    private readonly evidence: CohortEvidenceService,
    private readonly users: UsersService,
    private readonly config: ConfigRegistryService,
  ) {}

  async listRiskDigestCandidates(now: Date): Promise<CoachRiskDigestCandidate[]> {
    const pairs = await this.links.listAllActiveLinks();
    if (pairs.length === 0) return [];

    const studentIds = [...new Set(pairs.map((pair) => pair.studentId))];
    const [snapshots, thresholds, people] = await Promise.all([
      this.evidence.listCohortSnapshots(studentIds, now),
      this.thresholds(),
      this.users.listDisplayIdentities(studentIds),
    ]);
    const today = todayIso(now);

    // Evaluate each student once, not once per coach: two coaches cannot hold the same student
    // today, but the flags are a property of the student either way.
    const flagsByStudent = new Map<string, CoachRiskDigestStudent>();
    for (const studentId of studentIds) {
      const snapshot = snapshots.get(studentId);
      if (!snapshot) continue;
      const flags = evaluateRiskFlags(snapshot, thresholds, today);
      if (flags.length === 0) continue;
      flagsByStudent.set(studentId, {
        studentId,
        displayName: people.get(studentId)?.displayName ?? "",
        flags,
      });
    }
    if (flagsByStudent.size === 0) return [];

    const byCoach = new Map<string, CoachRiskDigestStudent[]>();
    for (const pair of pairs) {
      const student = flagsByStudent.get(pair.studentId);
      if (!student) continue;
      const list = byCoach.get(pair.coachId);
      if (list) list.push(student);
      else byCoach.set(pair.coachId, [student]);
    }

    // Resolved in parallel, not one await per iteration: everything above this line is batched,
    // and a sequential lookup here would put the coach count back into the round-trip budget.
    const withContacts = await Promise.all(
      [...byCoach].map(async ([coachId, students]) => ({
        coachId,
        students,
        contact: await this.users.getNotificationContact(coachId),
      })),
    );

    const candidates: CoachRiskDigestCandidate[] = [];
    for (const { coachId, students, contact } of withContacts) {
      // A coach with no contact row is an erased or broken account; skip rather than half-send.
      if (!contact) continue;
      candidates.push({
        coachId,
        email: contact.email,
        displayName: contact.displayName,
        students,
      });
    }
    return candidates;
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

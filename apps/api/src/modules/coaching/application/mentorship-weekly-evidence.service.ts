import { Inject, Injectable } from "@nestjs/common";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { CONTENT_PORT, type ContentPort } from "../domain/content.port";
import { completedMentorshipWeek } from "../domain/mentorship-weekly-report";
import { buildMentorshipWeeklySnapshot } from "../domain/mentorship-weekly-snapshot";
import { MentorshipWeeklyEvidenceRepository } from "../infrastructure/mentorship-weekly-evidence.repository";

@Injectable()
export class MentorshipWeeklyEvidenceService {
  constructor(
    private readonly repository: MentorshipWeeklyEvidenceRepository,
    private readonly config: ConfigRegistryService,
    @Inject(CONTENT_PORT) private readonly content: ContentPort,
  ) {}

  async getSnapshot(
    studentId: string,
    examType: string | null,
    weekStart?: string,
    now = new Date(),
  ): Promise<MentorshipWeeklySnapshotDto> {
    const period = completedMentorshipWeek(now, weekStart);
    const [evidence, minFocusSeconds] = await Promise.all([
      this.repository.getEvidence(studentId, examType, period),
      this.config.get("coaching.session.min_focus_seconds"),
    ]);
    return buildMentorshipWeeklySnapshot(period, {
      ...evidence,
      // Recap and coach reports count the same qualifying focus sessions.
      sessions: evidence.sessions.filter(
        (session) => session.focusSeconds >= minFocusSeconds,
      ),
    });
  }

  /**
   * Display names for the subject slugs a weekly snapshot carries, from the taxonomy the coach's
   * planner offers for the student's exam. No exam date is needed: YKS/LGS rows carry none, and a
   * passed KPSS date must not turn every name back into a slug. Read at request time and kept OUT
   * of the snapshot: the report's fingerprint is a hash of the snapshot, and a renamed subject must
   * not turn every stored week into a new one. A slug the taxonomy does not know stays unnamed; the
   * client shows the slug.
   */
  async subjectNames(
    examType: string | null,
    snapshot: MentorshipWeeklySnapshotDto,
  ): Promise<Record<string, string>> {
    const refs = new Set<string>([
      ...snapshot.subjects.flatMap((row) => (row.subjectRef ? [row.subjectRef] : [])),
      ...snapshot.mocks.subjects.map((row) => row.subjectRef),
    ]);
    if (refs.size === 0) return {};
    const examId = await this.content.getTaxonomyExamId(examType);
    if (!examId) return {};
    const taxonomy = await this.content.listExamSubjects(examId);
    return Object.fromEntries(
      taxonomy
        .filter((subject) => refs.has(subject.slug))
        .map((subject) => [subject.slug, subject.name]),
    );
  }
}

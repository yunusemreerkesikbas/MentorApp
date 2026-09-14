import { Injectable } from "@nestjs/common";
import type { MentorshipWeeklySnapshotDto } from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { completedMentorshipWeek } from "../domain/mentorship-weekly-report";
import { buildMentorshipWeeklySnapshot } from "../domain/mentorship-weekly-snapshot";
import { MentorshipWeeklyEvidenceRepository } from "../infrastructure/mentorship-weekly-evidence.repository";

@Injectable()
export class MentorshipWeeklyEvidenceService {
  constructor(
    private readonly repository: MentorshipWeeklyEvidenceRepository,
    private readonly config: ConfigRegistryService,
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
}

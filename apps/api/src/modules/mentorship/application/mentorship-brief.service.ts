import { Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { MentorshipBriefDto } from "@mentor/types";
import { MentorshipBriefService as AiBriefWriter } from "../../ai/application/mentorship-brief.service";
import { mentorshipBriefFingerprint } from "../../ai/domain/mentorship-brief-prompt";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { MentorshipLinkRepository } from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";
import { MentorshipRosterService } from "./mentorship-roster.service";

/**
 * The coach's AI brief about one student (W8 side).
 *
 * The split with W3 is deliberate: this service owns **authorization and the cache**, the AI
 * module owns **the text**. `getStudentReport` already runs `requireActiveLink`, so the brief
 * cannot be produced for a student this coach does not currently follow, and the AI writer never
 * receives anything but the report DTO — the same sanitized contract the coach reads on screen.
 *
 * The cache is the link row itself (`coach_students.brief`), keyed by a fingerprint of the report.
 * A coach clicking twice on an unchanged student pays once; a coach returning after the student
 * actually did something gets a fresh brief. Ending the link clears it along with the note.
 */
@Injectable()
export class MentorshipBriefService {
  constructor(
    private readonly roster: MentorshipRosterService,
    private readonly links: MentorshipLinkService,
    private readonly repo: MentorshipLinkRepository,
    private readonly writer: AiBriefWriter,
  ) {}

  async generate(
    coach: { id: string; roles: string[] },
    studentId: string,
  ): Promise<MentorshipBriefDto> {
    await this.links.assertEnabled();
    // Order matters: the gate first (404 for a student this coach does not follow), and only then
    // anything that costs money.
    const link = await this.links.requireActiveLink(coach.id, studentId);
    const report = await this.roster.getStudentReport(coach.id, studentId);

    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    const fingerprint = mentorshipBriefFingerprint(report, locale);
    if (link.brief && link.briefAt && link.briefFingerprint === fingerprint) {
      // The report has not moved since the last brief. Writing the same summary again would cost
      // the coach a quota unit and the platform an LLM call for a byte-identical answer.
      return {
        brief: link.brief,
        model: "cache",
        generatedAt: link.briefAt.toISOString(),
      };
    }

    const result = await this.writer.generate(report, coach, locale);
    const generatedAt = await this.repo.setBrief(link.id, result.text, fingerprint);
    return { brief: result.text, model: result.model, generatedAt: generatedAt.toISOString() };
  }
}

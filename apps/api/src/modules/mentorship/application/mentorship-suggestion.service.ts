import { Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import type { MentorshipAssignmentSuggestionsDto } from "@mentor/types";
import { AssignmentSuggestionService as AiSuggestionWriter } from "../../ai/application/assignment-suggestion.service";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { MentorshipLinkService } from "./mentorship-link.service";
import { MentorshipRosterService } from "./mentorship-roster.service";

/**
 * AI-proposed homework for one student (W8 side).
 *
 * The same split as both briefs: this service owns **authorization**, the AI module owns **the
 * text**. `getStudentReport` runs `requireActiveLink`, so a draft cannot be produced for a student
 * this coach does not currently follow.
 *
 * What it deliberately does NOT own is a write. The suggestion goes back to the composer, the coach
 * edits it, and the existing `POST /students/:id/assignments` is still the only way a task reaches
 * a student's plan — which keeps `PlanService.createFromMentorship` the single writer of
 * `plan_tasks` and the composer's picker the only gate on this student's exam taxonomy (APP-074).
 *
 * No cache, unlike the briefs: re-asking is the point, and the quota is the bound.
 */
@Injectable()
export class MentorshipSuggestionService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly roster: MentorshipRosterService,
    private readonly writer: AiSuggestionWriter,
  ) {}

  async suggest(
    coach: { id: string; roles: string[] },
    studentId: string,
  ): Promise<MentorshipAssignmentSuggestionsDto> {
    await this.links.assertEnabled();
    // The gate first (404 for a student this coach does not follow), and only then anything that
    // costs money.
    const report = await this.roster.getStudentReport(coach.id, studentId);
    const locale = (I18nContext.current()?.lang ?? "tr") as PromptLocale;
    return this.writer.suggest(report, coach, locale);
  }
}

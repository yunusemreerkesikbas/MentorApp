import { HttpStatus, Injectable } from "@nestjs/common";
import { I18nContext } from "nestjs-i18n";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import type {
  MentorshipBriefDeltaDto,
  MentorshipBriefDto,
  MentorshipBriefHistoryItemDto,
  MentorshipStudentReportDto,
  Paginated,
} from "@mentor/types";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { MentorshipBriefService as AiBriefWriter } from "../../ai/application/mentorship-brief.service";
import { mentorshipBriefFingerprint } from "../../ai/domain/mentorship-brief-prompt";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { buildBriefDelta, buildBriefSnapshot } from "../domain/brief-delta";
import {
  MentorshipBriefHistoryRepository,
  type BriefHistoryRow,
} from "../infrastructure/mentorship-brief-history.repository";
import { MentorshipFollowupRepository } from "../infrastructure/mentorship-followup.repository";
import {
  MentorshipLinkRepository,
  type MentorshipLinkRow,
} from "../infrastructure/mentorship-link.repository";
import { MentorshipLinkService } from "./mentorship-link.service";
import { MentorshipRosterService } from "./mentorship-roster.service";

/**
 * The coach's AI brief about one student (W8 side).
 *
 * The split with W3 is deliberate: this service owns **authorization, the cache and the memory**,
 * the AI module owns **the text**. `getStudentReport` already runs `requireActiveLink`, so the
 * brief cannot be produced for a student this coach does not currently follow, and the AI writer
 * never receives anything but the report DTO plus the rule-computed delta — both already sanitized.
 *
 * TWO stores, and they answer different questions (APP-093):
 *
 *   - **The link row** (`coach_students.brief*`) is the CACHE, keyed by a fingerprint of the
 *     report. A coach clicking twice on an unchanged student pays once. Ending the link clears it
 *     along with the note.
 *   - **`mentorship_student_briefs`** is the RECORD: every brief a model actually wrote, so the
 *     next one can open with what changed instead of starting over. A cache hit writes nothing
 *     here — no LLM call, no new history.
 */
@Injectable()
export class MentorshipBriefService {
  constructor(
    private readonly roster: MentorshipRosterService,
    private readonly links: MentorshipLinkService,
    private readonly repo: MentorshipLinkRepository,
    private readonly history: MentorshipBriefHistoryRepository,
    private readonly followups: MentorshipFollowupRepository,
    private readonly config: ConfigRegistryService,
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
    const previous = await this.history.findLatest(link.id, link.periodId);

    if (link.brief && link.briefAt && link.briefFingerprint === fingerprint) {
      // The report has not moved since the last brief. Writing the same summary again would cost
      // the coach a quota unit and the platform an LLM call for a byte-identical answer.
      return {
        brief: link.brief,
        model: "cache",
        generatedAt: link.briefAt.toISOString(),
        // Only when the stored row IS this cached text. A history row written under a different
        // fingerprint describes a different brief, and pairing it with this one would date the
        // band's "since" to the wrong moment.
        delta: previous?.fingerprint === fingerprint ? toDeltaDto(previous) : null,
      };
    }

    const delta = await this.buildDelta(link, report, previous);
    const result = await this.writer.generate(report, delta, coach, locale);
    const generatedAt = await this.repo.setBrief(link.id, result.text, fingerprint);
    if (!generatedAt) {
      // Either side can end the link at any moment, and writing a brief takes a whole LLM call.
      // If it ended while the model was typing, this text is about a student the coach may no
      // longer see — so it is dropped rather than returned. Same answer as any other read after
      // the gate closes: the link is simply not there. Nothing reaches the history either.
      throw new DomainError(ErrorCode.MENTORSHIP_LINK_NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    await this.history.append(
      {
        linkId: link.id,
        periodId: link.periodId,
        brief: result.text,
        model: result.model,
        fingerprint,
        snapshot: buildBriefSnapshot(report),
        delta,
      },
      await this.config.get("mentorship.brief.history_limit"),
    );

    return {
      brief: result.text,
      model: result.model,
      generatedAt: generatedAt.toISOString(),
      delta,
    };
  }

  /**
   * The coach paging back through what they were told about this student.
   *
   * Free: no model, no quota. It reads rows a model was already paid for, and charging to re-read
   * them would make the memory something a coach avoids using.
   */
  async listHistory(
    coachId: string,
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<MentorshipBriefHistoryItemDto>> {
    await this.links.assertEnabled();
    const link = await this.links.requireActiveLink(coachId, studentId);
    const { rows, total } = await this.history.list(
      link.id,
      link.periodId,
      page,
      pageSize,
    );
    return {
      items: rows.map((row) => ({
        id: row.id,
        brief: row.brief,
        model: row.model,
        generatedAt: row.generatedAt.toISOString(),
        delta: toDeltaDto(row),
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Null on the first brief of a relationship period — not an empty delta.
   *
   * "Nothing changed" and "there was nothing to compare" are different statements, and only the
   * first one is a brief's to make. The prompt drops its delta rules entirely on null for the same
   * reason: a model told to describe change with nothing to describe invents some.
   */
  private async buildDelta(
    link: MentorshipLinkRow,
    report: MentorshipStudentReportDto,
    previous: BriefHistoryRow | undefined,
  ): Promise<MentorshipBriefDeltaDto | null> {
    if (!previous) return null;
    const counts = await this.followups.countInWindow(
      link.id,
      link.periodId,
      previous.generatedAt,
    );
    return buildBriefDelta(
      { snapshot: previous.snapshot, generatedAt: previous.generatedAt.toISOString() },
      report,
      { followupsOpened: counts.opened, followupsClosed: counts.closed },
    );
  }
}

/**
 * The stored record is structurally the DTO — `database/schema.ts` declares its own mirror because
 * it does not import `@mentor/types` — so this is a named cast rather than a mapper, and it stays
 * one place for the next field added to either side to be noticed.
 */
function toDeltaDto(row: BriefHistoryRow | undefined): MentorshipBriefDeltaDto | null {
  return (row?.delta ?? null) as MentorshipBriefDeltaDto | null;
}

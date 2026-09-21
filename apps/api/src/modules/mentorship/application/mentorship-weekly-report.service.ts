import { createHash } from "node:crypto";
import { HttpStatus, Injectable } from "@nestjs/common";
import type {
  MentorshipWeeklyReportDto,
  MentorshipWeeklyReportListItemDto,
  MentorshipWeeklyReportPreviewDto,
  MentorshipWeeklyReportShareDto,
  Paginated,
} from "@mentor/types";
import type { FinalizeMentorshipWeeklyReportInput } from "@mentor/validation";
import { ConfigRegistryService } from "../../../common/config/config-registry.service";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import { MentorshipWeeklyEvidenceService } from "../../coaching/application/mentorship-weekly-evidence.service";
import { UsersService } from "../../identity/application/users.service";
import { MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION } from "../../ai/domain/mentorship-weekly-brief-prompt";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import {
  MentorshipWeeklyReportRepository,
  MentorshipWeeklyReportVersionConflictError,
  type MentorshipWeeklyReportRow,
} from "../infrastructure/mentorship-weekly-report.repository";
import { MentorshipLinkService } from "./mentorship-link.service";

function fingerprint(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

@Injectable()
export class MentorshipWeeklyReportService {
  constructor(
    private readonly links: MentorshipLinkService,
    private readonly evidence: MentorshipWeeklyEvidenceService,
    private readonly users: UsersService,
    private readonly reports: MentorshipWeeklyReportRepository,
    private readonly config: ConfigRegistryService,
  ) {}

  private async assertEnabled(): Promise<void> {
    await this.links.assertEnabled();
    if (!(await this.config.get("mentorship.weekly_reports.enabled"))) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_DISABLED,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private async prepare(
    coachId: string,
    studentId: string,
    weekStart?: string,
  ) {
    await this.assertEnabled();
    const link = await this.links.requireActiveLink(coachId, studentId);
    const [identities, profile] = await Promise.all([
      this.users.listDisplayIdentities([studentId]),
      this.users.getDiscoveryProfile(studentId),
    ]);
    let snapshot;
    try {
      snapshot = await this.evidence.getSnapshot(
        studentId,
        profile.examType,
        weekStart,
      );
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "MENTORSHIP_WEEK_INVALID"
      ) {
        throw new DomainError(
          ErrorCode.MENTORSHIP_WEEKLY_REPORT_PERIOD_INVALID,
          HttpStatus.BAD_REQUEST,
        );
      }
      throw error;
    }
    return {
      link,
      snapshot,
      sourceFingerprint: fingerprint(snapshot),
      studentDisplayName: identities.get(studentId)?.displayName ?? "",
    };
  }

  async preview(
    coachId: string,
    studentId: string,
    weekStart?: string,
    locale: PromptLocale = "tr",
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const prepared = await this.prepare(coachId, studentId, weekStart);
    const stored = await this.reports.findDraft(
      prepared.link.id,
      prepared.link.periodId,
      prepared.snapshot.period.startDate,
    );
    const draft =
      stored?.sourceFingerprint === prepared.sourceFingerprint
        ? stored
        : await this.reports.upsertDraft({
            linkId: prepared.link.id,
            periodId: prepared.link.periodId,
            weekStart: prepared.snapshot.period.startDate,
            weekEnd: prepared.snapshot.period.endDate,
            locale,
            sourceFingerprint: prepared.sourceFingerprint,
            snapshot: prepared.snapshot,
          });

    const briefMatches =
      draft.sourceFingerprint === prepared.sourceFingerprint &&
      draft.briefLocale === locale &&
      draft.briefPromptVersion === MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION;
    return {
      draftId: draft.id,
      coachContext: briefMatches ? draft.briefCoachContext : null,
      briefFingerprint: briefMatches ? draft.briefFingerprint : null,
      briefGenerationId: briefMatches ? draft.briefGenerationId : null,
      studentId,
      studentDisplayName: prepared.studentDisplayName,
      sourceFingerprint: prepared.sourceFingerprint,
      status: briefMatches ? draft.status : "DRAFT",
      snapshot: prepared.snapshot,
      brief: briefMatches ? draft.brief : null,
    };
  }

  async finalize(
    coachId: string,
    studentId: string,
    input: FinalizeMentorshipWeeklyReportInput,
    locale: PromptLocale = "tr",
  ): Promise<MentorshipWeeklyReportDto> {
    const prepared = await this.prepare(coachId, studentId, input.weekStart);
    const replay = await this.reports.findFinalizedByOperation(
      input.operationId,
      prepared.link.id,
      prepared.link.periodId,
    );
    const weekStart = prepared.snapshot.period.startDate;
    if (replay) {
      this.assertSameRequest(replay, input, weekStart);
      return this.toDto(replay, studentId, prepared.studentDisplayName);
    }
    if (prepared.sourceFingerprint !== input.sourceFingerprint) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
        HttpStatus.CONFLICT,
      );
    }
    const draft = await this.reports.findDraft(
      prepared.link.id,
      prepared.link.periodId,
      prepared.snapshot.period.startDate,
    );
    const briefMatches =
      draft?.sourceFingerprint === prepared.sourceFingerprint &&
      draft.briefLocale === locale &&
      draft.briefPromptVersion === MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION;
    let row: MentorshipWeeklyReportRow;
    try {
      row = await this.reports.finalize({
        linkId: prepared.link.id,
        periodId: prepared.link.periodId,
        weekStart: prepared.snapshot.period.startDate,
        weekEnd: prepared.snapshot.period.endDate,
        locale,
        sourceFingerprint: prepared.sourceFingerprint,
        snapshot: prepared.snapshot,
        brief: briefMatches ? draft.brief : null,
        coachEvaluation: input.coachEvaluation?.trim() || null,
        operationId: input.operationId,
        // The repository resolves the latest version under its transaction lock.
        replacesId: input.replacesId ?? null,
      });
    } catch (error) {
      if (error instanceof MentorshipWeeklyReportVersionConflictError) {
        throw new DomainError(
          ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
    // The repository replays under its lock too (a concurrent retry won the race); same rule there.
    this.assertSameRequest(row, input, weekStart);
    return this.toDto(row, studentId, prepared.studentDisplayName);
  }

  async list(
    coachId: string,
    studentId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<MentorshipWeeklyReportListItemDto>> {
    await this.assertEnabled();
    const link = await this.links.requireActiveLink(coachId, studentId);
    const result = await this.reports.listFinalized(
      link.id,
      link.periodId,
      page,
      pageSize,
    );
    return {
      items: result.rows.map((row) => this.toListItem(row)),
      total: result.total,
      page,
      pageSize,
    };
  }

  async get(coachId: string, studentId: string, reportId: string) {
    const { row, studentDisplayName } = await this.find(
      coachId,
      studentId,
      reportId,
    );
    return this.toDto(row, studentId, studentDisplayName);
  }

  async share(
    coachId: string,
    studentId: string,
    reportId: string,
  ): Promise<MentorshipWeeklyReportShareDto> {
    const { row, studentDisplayName } = await this.find(
      coachId,
      studentId,
      reportId,
    );
    const coach = await this.users.listDisplayIdentities([coachId]);
    const { evidence: _evidence, ...safeSnapshot } = row.snapshot;
    return {
      id: row.id,
      locale: row.locale as "tr" | "en",
      studentDisplayName,
      coachDisplayName: coach.get(coachId)?.displayName ?? "",
      period: row.snapshot.period,
      version: row.version,
      finalizedAt: row.finalizedAt!.toISOString(),
      snapshot: safeSnapshot,
      coachEvaluation: row.coachEvaluation,
    };
  }

  private async find(coachId: string, studentId: string, reportId: string) {
    await this.assertEnabled();
    const link = await this.links.requireActiveLink(coachId, studentId);
    const [row, identities] = await Promise.all([
      this.reports.findFinalized(reportId, link.id, link.periodId),
      this.users.listDisplayIdentities([studentId]),
    ]);
    if (!row) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_NOT_FOUND,
        HttpStatus.NOT_FOUND,
      );
    }
    return {
      row,
      studentDisplayName: identities.get(studentId)?.displayName ?? "",
    };
  }

  /**
   * An operationId names ONE finalization. Reused for a different week, fingerprint or evaluation it
   * must not answer with the old report as if the new one had been saved. `replacesId` is left out:
   * the row stores the version the repository resolved under its lock, not what the client sent.
   */
  private assertSameRequest(
    row: MentorshipWeeklyReportRow,
    input: FinalizeMentorshipWeeklyReportInput,
    /** The normalized period start the request resolved to, not the raw query value. */
    weekStart: string,
  ): void {
    if (
      row.sourceFingerprint !== input.sourceFingerprint ||
      row.weekStart !== weekStart ||
      row.coachEvaluation !== (input.coachEvaluation?.trim() || null)
    ) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
        HttpStatus.CONFLICT,
      );
    }
  }

  private toListItem(
    row: MentorshipWeeklyReportRow,
  ): MentorshipWeeklyReportListItemDto {
    return {
      id: row.id,
      locale: row.locale as "tr" | "en",
      period: row.snapshot.period,
      version: row.version,
      finalizedAt: row.finalizedAt!.toISOString(),
      replacesId: row.replacesId,
    };
  }

  private toDto(
    row: MentorshipWeeklyReportRow,
    studentId: string,
    studentDisplayName: string,
  ): MentorshipWeeklyReportDto {
    return {
      ...this.toListItem(row),
      studentId,
      studentDisplayName,
      sourceFingerprint: row.sourceFingerprint,
      snapshot: row.snapshot,
      coachEvaluation: row.coachEvaluation,
      brief: row.brief,
    };
  }
}

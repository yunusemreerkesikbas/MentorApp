import { HttpStatus, Inject, Injectable } from "@nestjs/common";
import { z } from "zod";
import type { MentorshipWeeklyReportPreviewDto } from "@mentor/types";
import { DomainError } from "../../../common/errors/domain-error";
import { ErrorCode } from "../../../common/errors/error-code";
import {
  JOB_QUEUE_PORT,
  type JobQueuePort,
} from "../../../shared/ports/job-queue.port";
import { MentorshipWeeklyBriefWriterService } from "../../ai/application/mentorship-weekly-brief-writer.service";
import type { PromptLocale } from "../../ai/domain/prompt-locale";
import { MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION } from "../../ai/domain/mentorship-weekly-brief-prompt";
import { MentorshipWeeklyReportRepository } from "../infrastructure/mentorship-weekly-report.repository";
import { MentorshipWeeklyReportService } from "./mentorship-weekly-report.service";

export const MENTORSHIP_WEEKLY_BRIEF_JOB = "mentorship.generate-weekly-brief";

const mentorshipWeeklyBriefJobSchema = z.object({
  draftId: z.string().min(1),
  coachId: z.string().min(1),
  coachRoles: z.array(z.string()),
  studentId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  locale: z.enum(["tr", "en"]),
  promptVersion: z.string().min(1),
});

export type MentorshipWeeklyBriefJob = z.infer<
  typeof mentorshipWeeklyBriefJobSchema
>;

@Injectable()
export class MentorshipWeeklyBriefService {
  constructor(
    private readonly reportService: MentorshipWeeklyReportService,
    private readonly reports: MentorshipWeeklyReportRepository,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly writer: MentorshipWeeklyBriefWriterService,
  ) {}

  async request(
    coach: { id: string; roles: string[] },
    studentId: string,
    input: { weekStart: string; sourceFingerprint: string },
    locale: PromptLocale,
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const preview = await this.reportService.preview(
      coach.id,
      studentId,
      input.weekStart,
      locale,
    );
    if (preview.sourceFingerprint !== input.sourceFingerprint) {
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
        HttpStatus.CONFLICT,
      );
    }
    if (preview.status === "BRIEF_READY" && preview.brief) return preview;
    if (preview.status === "BRIEF_PENDING") return preview;
    const draftId = preview.draftId!;
    const claimed = await this.reports.markBriefPending(
      draftId,
      input.sourceFingerprint,
      locale,
      MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION,
    );
    if (!claimed) {
      const current = await this.reportService.preview(
        coach.id,
        studentId,
        input.weekStart,
        locale,
      );
      if (current.sourceFingerprint !== input.sourceFingerprint) {
        throw new DomainError(
          ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
          HttpStatus.CONFLICT,
        );
      }
      if (
        current.status === "BRIEF_PENDING" ||
        (current.status === "BRIEF_READY" && current.brief)
      ) {
        return current;
      }
      throw new DomainError(
        ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
        HttpStatus.CONFLICT,
      );
    }
    try {
      await this.queue.enqueue<MentorshipWeeklyBriefJob>(
        MENTORSHIP_WEEKLY_BRIEF_JOB,
        {
          draftId,
          coachId: coach.id,
          coachRoles: coach.roles,
          studentId,
          weekStart: input.weekStart,
          sourceFingerprint: input.sourceFingerprint,
          locale,
          promptVersion: MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION,
        },
        { maxAttempts: 3 },
      );
    } catch (error) {
      await this.reports.setBriefResult(
        draftId,
        input.sourceFingerprint,
        locale,
        MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION,
        null,
      );
      throw error;
    }
    return { ...preview, status: "BRIEF_PENDING", brief: null };
  }

  async handle(rawPayload: unknown): Promise<void> {
    const payload = mentorshipWeeklyBriefJobSchema.parse(rawPayload);
    if (payload.promptVersion !== MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION)
      return;
    const before = await this.reportService.preview(
      payload.coachId,
      payload.studentId,
      payload.weekStart,
      payload.locale,
    );
    if (
      before.draftId !== payload.draftId ||
      before.sourceFingerprint !== payload.sourceFingerprint
    ) {
      return;
    }
    try {
      const result = await this.writer.generate(
        before.snapshot,
        { id: payload.coachId, roles: payload.coachRoles },
        payload.locale,
      );
      // The student can write data while the model works. Rebuild and compare before persisting.
      const after = await this.reportService.preview(
        payload.coachId,
        payload.studentId,
        payload.weekStart,
        payload.locale,
      );
      if (
        after.draftId !== payload.draftId ||
        after.sourceFingerprint !== payload.sourceFingerprint
      ) {
        return;
      }
      await this.reports.setBriefResult(
        payload.draftId,
        payload.sourceFingerprint,
        payload.locale,
        payload.promptVersion,
        {
          findings: result.findings,
          model: result.model,
          generatedAt: new Date().toISOString(),
          locale: payload.locale,
          promptVersion: payload.promptVersion,
        },
      );
    } catch (error) {
      await this.reports.setBriefResult(
        payload.draftId,
        payload.sourceFingerprint,
        payload.locale,
        payload.promptVersion,
        null,
      );
      throw error;
    }
  }
}

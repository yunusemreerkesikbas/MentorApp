import { createHash, randomUUID } from "node:crypto";
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
import { MentorshipWeeklyBriefRepository } from "../infrastructure/mentorship-weekly-brief.repository";
import { MentorshipWeeklyReportService } from "./mentorship-weekly-report.service";

export const MENTORSHIP_WEEKLY_BRIEF_JOB = "mentorship.generate-weekly-brief";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const jobSchema = z.object({
  draftId: z.string().min(1),
  coachId: z.string().min(1),
  studentId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  sourceFingerprint: hash,
  briefFingerprint: hash,
  generationId: z.string().uuid(),
  locale: z.enum(["tr", "en"]),
  promptVersion: z.string().min(1),
});
export type MentorshipWeeklyBriefJob = z.infer<typeof jobSchema>;

export function weeklyBriefFingerprint(
  sourceFingerprint: string,
  coachContext: string | null,
  locale: PromptLocale,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        sourceFingerprint,
        coachContext,
        locale,
        promptVersion: MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION,
      }),
    )
    .digest("hex");
}

function conflict(): never {
  throw new DomainError(
    ErrorCode.MENTORSHIP_WEEKLY_REPORT_CONFLICT,
    HttpStatus.CONFLICT,
  );
}

@Injectable()
export class MentorshipWeeklyBriefService {
  constructor(
    private readonly reportService: MentorshipWeeklyReportService,
    private readonly reports: MentorshipWeeklyBriefRepository,
    @Inject(JOB_QUEUE_PORT) private readonly queue: JobQueuePort,
    private readonly writer: MentorshipWeeklyBriefWriterService,
  ) {}

  async request(
    coach: { id: string; roles: string[] },
    studentId: string,
    input: {
      weekStart: string;
      sourceFingerprint: string;
      coachContext?: string;
    },
    locale: PromptLocale,
  ): Promise<MentorshipWeeklyReportPreviewDto> {
    const coachContext = input.coachContext?.trim() || null;
    const briefFingerprint = weeklyBriefFingerprint(
      input.sourceFingerprint,
      coachContext,
      locale,
    );
    const preview = await this.reportService.preview(
      coach.id,
      studentId,
      input.weekStart,
      locale,
    );
    if (preview.sourceFingerprint !== input.sourceFingerprint) conflict();
    if (
      preview.briefFingerprint === briefFingerprint &&
      (preview.status === "BRIEF_PENDING" ||
        (preview.status === "BRIEF_READY" && preview.brief))
    )
      return preview;
    if (preview.status === "BRIEF_PENDING") conflict();
    const payload: MentorshipWeeklyBriefJob = {
      draftId: preview.draftId!,
      coachId: coach.id,
      studentId,
      weekStart: input.weekStart,
      sourceFingerprint: input.sourceFingerprint,
      briefFingerprint,
      generationId: randomUUID(),
      locale,
      promptVersion: MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION,
    };
    if (!(await this.reports.markBriefPending(payload, coachContext))) {
      const current = await this.reportService.preview(
        coach.id,
        studentId,
        input.weekStart,
        locale,
      );
      if (
        current.sourceFingerprint === input.sourceFingerprint &&
        current.briefFingerprint === briefFingerprint &&
        (current.status === "BRIEF_PENDING" ||
          (current.status === "BRIEF_READY" && current.brief))
      )
        return current;
      conflict();
    }
    try {
      // No user text in the queue payload. The worker reads the generation-bound private draft.
      await this.queue.enqueue(MENTORSHIP_WEEKLY_BRIEF_JOB, payload, {
        maxAttempts: 1,
      });
    } catch (error) {
      await this.reports.setBriefResult(payload, null);
      throw error;
    }
    return {
      ...preview,
      status: "BRIEF_PENDING",
      brief: null,
      coachContext,
      briefFingerprint,
      briefGenerationId: payload.generationId,
    };
  }

  async handle(rawPayload: unknown): Promise<void> {
    const version = z
      .object({ promptVersion: z.string() })
      .parse(rawPayload).promptVersion;
    if (version !== MENTORSHIP_WEEKLY_BRIEF_PROMPT_VERSION) return;
    const payload = jobSchema.parse(rawPayload);
    try {
      const before = await this.reportService.preview(
        payload.coachId,
        payload.studentId,
        payload.weekStart,
        payload.locale,
      );
      if (
        !this.matches(before, payload) ||
        !(await this.reports.markBriefStarted(payload))
      )
        return;
      const result = await this.writer.generate(
        before.snapshot,
        { id: payload.coachId, roles: undefined },
        payload.locale,
        before.coachContext ?? null,
      );
      const after = await this.reportService.preview(
        payload.coachId,
        payload.studentId,
        payload.weekStart,
        payload.locale,
      );
      if (!this.matches(after, payload)) return;
      await this.reports.setBriefResult(payload, {
        findings: result.findings,
        preparation: result.preparation,
        coachContext: before.coachContext ?? null,
        model: result.model,
        generatedAt: new Date().toISOString(),
        locale: payload.locale,
        promptVersion: payload.promptVersion,
      });
    } catch (error) {
      await this.reports.setBriefResult(payload, null);
      throw error;
    }
  }

  private matches(
    preview: MentorshipWeeklyReportPreviewDto,
    payload: MentorshipWeeklyBriefJob,
  ): boolean {
    return (
      preview.status === "BRIEF_PENDING" &&
      preview.draftId === payload.draftId &&
      preview.sourceFingerprint === payload.sourceFingerprint &&
      preview.briefFingerprint === payload.briefFingerprint &&
      preview.briefGenerationId === payload.generationId
    );
  }
}

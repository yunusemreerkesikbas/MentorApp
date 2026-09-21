import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { MentorshipWeeklyBriefDto } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipWeeklyReports as reports } from "../../../database/schema";

export interface WeeklyBriefGeneration {
  draftId: string;
  sourceFingerprint: string;
  locale: "tr" | "en";
  promptVersion: string;
  briefFingerprint: string;
  generationId: string;
}

@Injectable()
export class MentorshipWeeklyBriefRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  markBriefPending(
    input: WeeklyBriefGeneration,
    coachContext: string | null,
  ): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(reports)
        .set({
          status: "BRIEF_PENDING",
          brief: null,
          briefCoachContext: coachContext,
          briefLocale: input.locale,
          briefPromptVersion: input.promptVersion,
          briefFingerprint: input.briefFingerprint,
          briefGenerationId: input.generationId,
          briefStartedAt: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(reports.id, input.draftId),
            eq(reports.version, 0),
            eq(reports.sourceFingerprint, input.sourceFingerprint),
            // An old prompt's queued work cannot run after a deployment; allow replacing that draft.
            sql`(${reports.status} <> 'BRIEF_PENDING' OR ${reports.briefPromptVersion} IS DISTINCT FROM ${input.promptVersion})`,
            sql`(${reports.status} <> 'BRIEF_READY' OR ${reports.briefFingerprint} IS DISTINCT FROM ${input.briefFingerprint})`,
          ),
        )
        .returning({ id: reports.id });
      return rows.length === 1;
    });
  }

  /** At-most-once provider dispatch, including duplicate delivery of the same queued job. */
  markBriefStarted(input: WeeklyBriefGeneration): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(reports)
        .set({ briefStartedAt: new Date() })
        .where(and(this.matches(input), isNull(reports.briefStartedAt)))
        .returning({ id: reports.id });
      return rows.length === 1;
    });
  }

  setBriefResult(
    input: WeeklyBriefGeneration,
    brief: MentorshipWeeklyBriefDto | null,
  ): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(reports)
        .set({
          status: brief ? "BRIEF_READY" : "BRIEF_FAILED",
          brief,
          updatedAt: new Date(),
        })
        .where(this.matches(input))
        .returning({ id: reports.id });
      return rows.length === 1;
    });
  }

  private matches(input: WeeklyBriefGeneration) {
    return and(
      eq(reports.id, input.draftId),
      eq(reports.version, 0),
      eq(reports.status, "BRIEF_PENDING"),
      eq(reports.sourceFingerprint, input.sourceFingerprint),
      eq(reports.briefLocale, input.locale),
      eq(reports.briefPromptVersion, input.promptVersion),
      eq(reports.briefFingerprint, input.briefFingerprint),
      eq(reports.briefGenerationId, input.generationId),
    );
  }
}

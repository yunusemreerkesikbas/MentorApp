import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import type {
  MentorshipWeeklyBriefDto,
  MentorshipWeeklySnapshotDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipWeeklyReports } from "../../../database/schema";

export type MentorshipWeeklyReportRow =
  typeof mentorshipWeeklyReports.$inferSelect;

interface DraftInput {
  linkId: string;
  periodId: string;
  weekStart: string;
  weekEnd: string;
  locale: "tr" | "en";
  sourceFingerprint: string;
  snapshot: MentorshipWeeklySnapshotDto;
}

interface FinalizeInput extends DraftInput {
  operationId: string;
  coachEvaluation: string | null;
  replacesId: string | null;
  brief: MentorshipWeeklyBriefDto | null;
}

export class MentorshipWeeklyReportVersionConflictError extends Error {
  constructor() {
    super("MENTORSHIP_WEEKLY_REPORT_VERSION_CONFLICT");
  }
}

@Injectable()
export class MentorshipWeeklyReportRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  findDraft(linkId: string, periodId: string, weekStart: string) {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipWeeklyReports)
        .where(
          and(
            eq(mentorshipWeeklyReports.linkId, linkId),
            eq(mentorshipWeeklyReports.periodId, periodId),
            eq(mentorshipWeeklyReports.weekStart, weekStart),
            eq(mentorshipWeeklyReports.version, 0),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  upsertDraft(input: DraftInput): Promise<MentorshipWeeklyReportRow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .insert(mentorshipWeeklyReports)
        .values({ ...input, version: 0, status: "DRAFT" })
        .onConflictDoUpdate({
          target: [
            mentorshipWeeklyReports.linkId,
            mentorshipWeeklyReports.periodId,
            mentorshipWeeklyReports.weekStart,
            mentorshipWeeklyReports.version,
          ],
          set: {
            weekEnd: input.weekEnd,
            locale: input.locale,
            sourceFingerprint: input.sourceFingerprint,
            snapshot: input.snapshot,
            status: "DRAFT",
            brief: null,
            briefLocale: null,
            briefPromptVersion: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0]!;
    });
  }

  markBriefPending(
    id: string,
    sourceFingerprint: string,
    locale: "tr" | "en",
    promptVersion: string,
  ): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipWeeklyReports)
        .set({
          status: "BRIEF_PENDING",
          brief: null,
          briefLocale: locale,
          briefPromptVersion: promptVersion,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mentorshipWeeklyReports.id, id),
            eq(mentorshipWeeklyReports.version, 0),
            eq(mentorshipWeeklyReports.sourceFingerprint, sourceFingerprint),
            inArray(mentorshipWeeklyReports.status, ["DRAFT", "BRIEF_FAILED"]),
          ),
        )
        .returning({ id: mentorshipWeeklyReports.id });
      return rows.length === 1;
    });
  }

  setBriefResult(
    id: string,
    sourceFingerprint: string,
    locale: "tr" | "en",
    promptVersion: string,
    brief: MentorshipWeeklyBriefDto | null,
  ): Promise<boolean> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .update(mentorshipWeeklyReports)
        .set({
          status: brief ? "BRIEF_READY" : "BRIEF_FAILED",
          brief,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(mentorshipWeeklyReports.id, id),
            eq(mentorshipWeeklyReports.version, 0),
            eq(mentorshipWeeklyReports.sourceFingerprint, sourceFingerprint),
            eq(mentorshipWeeklyReports.briefLocale, locale),
            eq(mentorshipWeeklyReports.briefPromptVersion, promptVersion),
          ),
        )
        .returning({ id: mentorshipWeeklyReports.id });
      return rows.length === 1;
    });
  }

  finalize(input: FinalizeInput): Promise<MentorshipWeeklyReportRow> {
    return withServiceContext(this.db, async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`${input.linkId}:${input.periodId}:${input.weekStart}`}))`,
      );
      const replay = await tx
        .select()
        .from(mentorshipWeeklyReports)
        .where(
          and(
            eq(mentorshipWeeklyReports.linkId, input.linkId),
            eq(mentorshipWeeklyReports.periodId, input.periodId),
            eq(mentorshipWeeklyReports.operationId, input.operationId),
          ),
        )
        .limit(1);
      if (replay[0]) return replay[0];

      const latestRows = await tx
        .select({
          id: mentorshipWeeklyReports.id,
          version: mentorshipWeeklyReports.version,
        })
        .from(mentorshipWeeklyReports)
        .where(
          and(
            eq(mentorshipWeeklyReports.linkId, input.linkId),
            eq(mentorshipWeeklyReports.periodId, input.periodId),
            eq(mentorshipWeeklyReports.weekStart, input.weekStart),
            eq(mentorshipWeeklyReports.status, "FINALIZED"),
          ),
        )
        .orderBy(desc(mentorshipWeeklyReports.version))
        .limit(1);
      const latest = latestRows[0];
      if (input.replacesId && input.replacesId !== latest?.id) {
        throw new MentorshipWeeklyReportVersionConflictError();
      }

      const version = (latest?.version ?? 0) + 1;
      const rows = await tx
        .insert(mentorshipWeeklyReports)
        .values({
          ...input,
          replacesId: latest?.id ?? null,
          briefLocale: input.brief?.locale ?? null,
          briefPromptVersion: input.brief?.promptVersion ?? null,
          version,
          status: "FINALIZED",
          finalizedAt: new Date(),
        })
        .returning();
      return rows[0]!;
    });
  }

  listFinalized(
    linkId: string,
    periodId: string,
    page: number,
    pageSize: number,
  ) {
    return withServiceContext(this.db, async (tx) => {
      const where = and(
        eq(mentorshipWeeklyReports.linkId, linkId),
        eq(mentorshipWeeklyReports.periodId, periodId),
        eq(mentorshipWeeklyReports.status, "FINALIZED"),
      );
      const [rows, totals] = await Promise.all([
        tx
          .select()
          .from(mentorshipWeeklyReports)
          .where(where)
          .orderBy(
            desc(mentorshipWeeklyReports.weekStart),
            desc(mentorshipWeeklyReports.version),
          )
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ value: count() })
          .from(mentorshipWeeklyReports)
          .where(where),
      ]);
      return { rows, total: totals[0]?.value ?? 0 };
    });
  }

  findFinalized(id: string, linkId: string, periodId: string) {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipWeeklyReports)
        .where(
          and(
            eq(mentorshipWeeklyReports.id, id),
            eq(mentorshipWeeklyReports.linkId, linkId),
            eq(mentorshipWeeklyReports.periodId, periodId),
            eq(mentorshipWeeklyReports.status, "FINALIZED"),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }

  findFinalizedByOperation(
    operationId: string,
    linkId: string,
    periodId: string,
  ) {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select()
        .from(mentorshipWeeklyReports)
        .where(
          and(
            eq(mentorshipWeeklyReports.operationId, operationId),
            eq(mentorshipWeeklyReports.linkId, linkId),
            eq(mentorshipWeeklyReports.periodId, periodId),
            eq(mentorshipWeeklyReports.status, "FINALIZED"),
          ),
        )
        .limit(1);
      return rows[0];
    });
  }
}

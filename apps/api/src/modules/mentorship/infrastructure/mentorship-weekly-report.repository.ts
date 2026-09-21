import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, sql } from "drizzle-orm";
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
            briefCoachContext: null,
            briefFingerprint: null,
            briefGenerationId: null,
            briefStartedAt: null,
            updatedAt: new Date(),
          },
        })
        .returning();
      return rows[0]!;
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
          briefCoachContext: input.brief?.coachContext ?? null,
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

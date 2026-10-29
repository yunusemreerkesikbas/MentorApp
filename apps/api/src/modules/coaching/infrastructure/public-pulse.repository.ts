import { Inject, Injectable } from "@nestjs/common";
import { and, gte, inArray, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { studySessions } from "../../../database/schema";

/**
 * One anonymous number for the public landing. SERVICE context because `study_sessions` has per-user
 * RLS and this reads across everyone; nothing leaves but the count.
 */
@Injectable()
export class PublicPulseRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Distinct people with a session started since `since` that is done or still running; abandoned ones do not count. */
  async studiedSince(since: Date): Promise<number> {
    // ponytail: count(distinct) over the window; add an index on study_sessions(started_at) if this slows down.
    const [row] = await withServiceContext(this.db, (tx) =>
      tx
        .select({ people: sql<number>`count(distinct ${studySessions.userId})::int` })
        .from(studySessions)
        .where(and(inArray(studySessions.status, ["COMPLETED", "IN_PROGRESS"]), gte(studySessions.startedAt, since))),
    );
    return row?.people ?? 0;
  }
}

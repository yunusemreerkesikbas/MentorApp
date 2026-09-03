import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { mentorshipDroppedAssignments } from "../../../database/schema";

export type MentorshipDroppedAssignmentRow =
  typeof mentorshipDroppedAssignments.$inferSelect;

/** Append-only: rows are written once and only ever removed by the link's cascade (erasure). */
@Injectable()
export class MentorshipDroppedAssignmentRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async record(linkId: string, taskTitle: string, taskDate: string): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(mentorshipDroppedAssignments).values({ linkId, taskTitle, taskDate });
    });
  }

  /**
   * Scoped to one link, never to a coach or a student: a coach must not read what a PREVIOUS coach
   * assigned, the same isolation `plan_tasks.coach_note` already gets in the evidence repository.
   */
  listByLink(
    linkId: string,
    since: string,
    limit: number,
  ): Promise<MentorshipDroppedAssignmentRow[]> {
    return withServiceContext(this.db, (tx) =>
      tx
        .select()
        .from(mentorshipDroppedAssignments)
        .where(
          and(
            eq(mentorshipDroppedAssignments.linkId, linkId),
            gte(mentorshipDroppedAssignments.taskDate, since),
          ),
        )
        .orderBy(desc(mentorshipDroppedAssignments.droppedAt))
        .limit(limit),
    );
  }
}

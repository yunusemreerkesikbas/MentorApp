import { Injectable } from "@nestjs/common";
import {
  and,
  asc,
  eq,
  gte,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type { ListPlanTasksQuery } from "@mentor/validation";
import type { DatabaseTx } from "../../../database/drizzle";
import {
  planEventAttendees,
  planEventSeries,
  planEvents,
} from "../../../database/schema";
import {
  hydratePlanEvents,
  listCoachPlanEvents,
  removeFuturePlanEventAttendee,
  replacePlanEventAttendees,
} from "./plan-event.repository.helpers";

export type PlanEventRow = typeof planEvents.$inferSelect;
export type NewPlanEvent = typeof planEvents.$inferInsert;
export type PlanEventSeriesRow = typeof planEventSeries.$inferSelect;
export type NewPlanEventSeries = typeof planEventSeries.$inferInsert;

export interface PlanEventRecord extends PlanEventRow {
  attendeeIds: string[];
  series: PlanEventSeriesRow | null;
}

const eventOrder = [
  asc(planEvents.eventDate),
  sql`${planEvents.startTime} asc nulls first`,
  asc(planEvents.createdAt),
  asc(planEvents.id),
];

function dateFilter(query: ListPlanTasksQuery) {
  if (query.from && query.to) {
    return and(
      gte(planEvents.eventDate, query.from),
      lte(planEvents.eventDate, query.to),
    );
  }
  return eq(planEvents.eventDate, query.date!);
}

@Injectable()
export class PlanEventRepository {
  async acquireOrganizerLock(
    tx: DatabaseTx,
    organizerUserId: string,
  ): Promise<void> {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${"coaching:event:" + organizerUserId}, 0))`,
    );
  }

  async createSeries(
    tx: DatabaseTx,
    data: NewPlanEventSeries,
  ): Promise<PlanEventSeriesRow> {
    const [row] = await tx.insert(planEventSeries).values(data).returning();
    return row!;
  }

  async updateSeries(
    tx: DatabaseTx,
    organizerUserId: string,
    id: string,
    patch: Partial<NewPlanEventSeries>,
  ): Promise<void> {
    await tx
      .update(planEventSeries)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(planEventSeries.id, id),
          eq(planEventSeries.organizerUserId, organizerUserId),
        ),
      );
  }

  async createOccurrences(
    tx: DatabaseTx,
    values: NewPlanEvent[],
  ): Promise<PlanEventRow[]> {
    if (values.length === 0) return [];
    return tx.insert(planEvents).values(values).returning();
  }

  async addAttendees(
    tx: DatabaseTx,
    values: Array<{
      eventId: string;
      organizerUserId: string;
      attendeeUserId: string;
    }>,
  ): Promise<void> {
    if (values.length === 0) return;
    await tx.insert(planEventAttendees).values(values);
  }

  async findOwnedById(
    tx: DatabaseTx,
    organizerUserId: string,
    id: string,
  ): Promise<PlanEventRecord | undefined> {
    const rows = await tx
      .select()
      .from(planEvents)
      .where(
        and(
          eq(planEvents.id, id),
          eq(planEvents.organizerUserId, organizerUserId),
        ),
      )
      .limit(1);
    return (await hydratePlanEvents(tx, rows))[0];
  }

  async listParticipantPaged(
    tx: DatabaseTx,
    participantUserId: string,
    query: ListPlanTasksQuery,
  ): Promise<{ items: PlanEventRecord[]; total: number }> {
    const participant = or(
      eq(planEvents.organizerUserId, participantUserId),
      sql`exists (
        select 1 from ${planEventAttendees}
        where ${planEventAttendees.eventId} = ${planEvents.id}
          and ${planEventAttendees.attendeeUserId} = ${participantUserId}
      )`,
    );
    const where = and(participant, dateFilter(query));
    const [rows, count] = await Promise.all([
      tx
        .select()
        .from(planEvents)
        .where(where)
        .orderBy(...eventOrder)
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize),
      tx
        .select({ count: sql<number>`count(*)::int` })
        .from(planEvents)
        .where(where),
    ]);
    return {
      items: await hydratePlanEvents(tx, rows),
      total: count[0]?.count ?? 0,
    };
  }

  async findParticipantByIds(
    tx: DatabaseTx,
    participantUserId: string,
    ids: string[],
  ): Promise<PlanEventRecord[]> {
    if (ids.length === 0) return [];
    const rows = await tx
      .select()
      .from(planEvents)
      .where(
        and(
          inArray(planEvents.id, ids),
          or(
            eq(planEvents.organizerUserId, participantUserId),
            sql`exists (
              select 1 from ${planEventAttendees}
              where ${planEventAttendees.eventId} = ${planEvents.id}
                and ${planEventAttendees.attendeeUserId} = ${participantUserId}
            )`,
          ),
        ),
      );
    return hydratePlanEvents(tx, rows);
  }

  async updateOccurrence(
    tx: DatabaseTx,
    organizerUserId: string,
    id: string,
    patch: Partial<NewPlanEvent>,
  ): Promise<PlanEventRow | undefined> {
    const [row] = await tx
      .update(planEvents)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(planEvents.id, id),
          eq(planEvents.organizerUserId, organizerUserId),
        ),
      )
      .returning();
    return row;
  }

  async updateFutureOccurrences(
    tx: DatabaseTx,
    organizerUserId: string,
    seriesId: string,
    from: string,
    patch: Partial<NewPlanEvent>,
  ): Promise<PlanEventRow[]> {
    return tx
      .update(planEvents)
      .set({ ...patch, updatedAt: new Date() })
      .where(
        and(
          eq(planEvents.organizerUserId, organizerUserId),
          eq(planEvents.seriesId, seriesId),
          gte(planEvents.eventDate, from),
        ),
      )
      .returning();
  }

  async deleteFutureOccurrences(
    tx: DatabaseTx,
    organizerUserId: string,
    seriesId: string,
    from: string,
  ): Promise<void> {
    await tx
      .delete(planEvents)
      .where(
        and(
          eq(planEvents.organizerUserId, organizerUserId),
          eq(planEvents.seriesId, seriesId),
          gte(planEvents.eventDate, from),
        ),
      );
  }

  async replaceAttendees(
    tx: DatabaseTx,
    organizerUserId: string,
    eventIds: string[],
    attendeeUserIds: string[],
  ): Promise<void> {
    return replacePlanEventAttendees(
      tx,
      organizerUserId,
      eventIds,
      attendeeUserIds,
    );
  }

  async cancelOccurrence(
    tx: DatabaseTx,
    organizerUserId: string,
    id: string,
  ): Promise<PlanEventRow | undefined> {
    return this.updateOccurrence(tx, organizerUserId, id, {
      status: "CANCELLED",
    });
  }

  async cancelFutureSeries(
    tx: DatabaseTx,
    organizerUserId: string,
    seriesId: string,
    from: string,
  ): Promise<PlanEventRecord[]> {
    const rows = await this.updateFutureOccurrences(
      tx,
      organizerUserId,
      seriesId,
      from,
      { status: "CANCELLED" },
    );
    return hydratePlanEvents(tx, rows);
  }

  async listAuthorizedForCoach(
    tx: DatabaseTx,
    organizerUserId: string,
    studentIds: string[],
    from: string,
    to: string,
  ): Promise<PlanEventRecord[]> {
    return listCoachPlanEvents(
      tx,
      organizerUserId,
      studentIds,
      from,
      to,
    );
  }

  async removeFutureAttendee(
    tx: DatabaseTx,
    organizerUserId: string,
    attendeeUserId: string,
    from: string,
  ): Promise<number> {
    return removeFuturePlanEventAttendee(
      tx,
      organizerUserId,
      attendeeUserId,
      from,
    );
  }
}

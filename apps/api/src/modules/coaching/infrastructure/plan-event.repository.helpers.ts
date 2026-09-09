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
import type {
  PlanEventRecord,
  PlanEventRow,
} from "./plan-event.repository";

const eventOrder = [
  asc(planEvents.eventDate),
  sql`${planEvents.startTime} asc nulls first`,
  asc(planEvents.createdAt),
  asc(planEvents.id),
];

function eventDateFilter(query: ListPlanTasksQuery) {
  return query.from && query.to
    ? and(
        gte(planEvents.eventDate, query.from),
        lte(planEvents.eventDate, query.to),
      )
    : eq(planEvents.eventDate, query.date!);
}

function participantFilter(participantUserId: string) {
  return or(
    eq(planEvents.organizerUserId, participantUserId),
    sql`exists (
      select 1 from ${planEventAttendees}
      where ${planEventAttendees.eventId} = ${planEvents.id}
        and ${planEventAttendees.attendeeUserId} = ${participantUserId}
    )`,
  );
}

export async function listParticipantPlanEvents(
  tx: DatabaseTx,
  participantUserId: string,
  query: ListPlanTasksQuery,
): Promise<{ items: PlanEventRecord[]; total: number }> {
  const where = and(
    participantFilter(participantUserId),
    eventDateFilter(query),
  );
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

export async function findParticipantPlanEvents(
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
        participantFilter(participantUserId),
      ),
    )
    .orderBy(...eventOrder);
  return hydratePlanEvents(tx, rows);
}

export async function listFutureSeriesPlanEvents(
  tx: DatabaseTx,
  organizerUserId: string,
  seriesId: string,
  from: string,
): Promise<PlanEventRecord[]> {
  const rows = await tx
    .select()
    .from(planEvents)
    .where(
      and(
        eq(planEvents.organizerUserId, organizerUserId),
        eq(planEvents.seriesId, seriesId),
        gte(planEvents.eventDate, from),
      ),
    )
    .orderBy(...eventOrder);
  return hydratePlanEvents(tx, rows);
}

export async function hydratePlanEvents(
  tx: DatabaseTx,
  rows: PlanEventRow[],
): Promise<PlanEventRecord[]> {
  if (rows.length === 0) return [];
  const eventIds = rows.map((row) => row.id);
  const seriesIds = [
    ...new Set(rows.flatMap((row) => (row.seriesId ? [row.seriesId] : []))),
  ];
  const [attendees, series] = await Promise.all([
    tx
      .select()
      .from(planEventAttendees)
      .where(inArray(planEventAttendees.eventId, eventIds)),
    seriesIds.length
      ? tx
          .select()
          .from(planEventSeries)
          .where(inArray(planEventSeries.id, seriesIds))
      : Promise.resolve([]),
  ]);
  const attendeeMap = new Map<string, string[]>();
  for (const attendee of attendees) {
    const ids = attendeeMap.get(attendee.eventId) ?? [];
    ids.push(attendee.attendeeUserId);
    attendeeMap.set(attendee.eventId, ids);
  }
  const seriesMap = new Map(series.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    attendeeIds: attendeeMap.get(row.id) ?? [],
    series: row.seriesId ? (seriesMap.get(row.seriesId) ?? null) : null,
  }));
}

export async function replacePlanEventAttendees(
  tx: DatabaseTx,
  organizerUserId: string,
  eventIds: string[],
  attendeeUserIds: string[],
): Promise<void> {
  if (eventIds.length === 0) return;
  await tx
    .delete(planEventAttendees)
    .where(
      and(
        eq(planEventAttendees.organizerUserId, organizerUserId),
        inArray(planEventAttendees.eventId, eventIds),
      ),
    );
  if (attendeeUserIds.length > 0) {
    await tx.insert(planEventAttendees).values(
      eventIds.flatMap((eventId) =>
        attendeeUserIds.map((attendeeUserId) => ({
          eventId,
          organizerUserId,
          attendeeUserId,
        })),
      ),
    );
  }
  await tx
    .update(planEvents)
    .set({ attendeeCount: attendeeUserIds.length, updatedAt: new Date() })
    .where(
      and(
        eq(planEvents.organizerUserId, organizerUserId),
        inArray(planEvents.id, eventIds),
      ),
    );
}

export async function listCoachPlanEvents(
  tx: DatabaseTx,
  organizerUserId: string,
  studentIds: string[],
  from: string,
  to: string,
): Promise<PlanEventRecord[]> {
  if (studentIds.length === 0) return [];
  const rows = await tx
    .select()
    .from(planEvents)
    .where(
      and(
        eq(planEvents.organizerUserId, organizerUserId),
        gte(planEvents.eventDate, from),
        lte(planEvents.eventDate, to),
        sql`exists (
          select 1 from ${planEventAttendees}
          where ${planEventAttendees.eventId} = ${planEvents.id}
            and ${planEventAttendees.attendeeUserId} in (${sql.join(
              studentIds.map((id) => sql`${id}`),
              sql`, `,
            )})
        )`,
      ),
    )
    .orderBy(...eventOrder);
  return hydratePlanEvents(tx, rows);
}

export async function removeFuturePlanEventAttendee(
  tx: DatabaseTx,
  organizerUserId: string,
  attendeeUserId: string,
  from: string,
): Promise<number> {
  const eventIds = tx
    .select({ id: planEvents.id })
    .from(planEvents)
    .where(
      and(
        eq(planEvents.organizerUserId, organizerUserId),
        gte(planEvents.eventDate, from),
      ),
    );
  const removed = await tx
    .delete(planEventAttendees)
    .where(
      and(
        eq(planEventAttendees.organizerUserId, organizerUserId),
        eq(planEventAttendees.attendeeUserId, attendeeUserId),
        inArray(planEventAttendees.eventId, eventIds),
      ),
    )
    .returning({ eventId: planEventAttendees.eventId });
  if (removed.length === 0) return 0;
  await tx
    .update(planEvents)
    .set({
      attendeeCount: sql`greatest(${planEvents.attendeeCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(planEvents.organizerUserId, organizerUserId),
        inArray(
          planEvents.id,
          removed.map((row) => row.eventId),
        ),
      ),
    );
  return removed.length;
}

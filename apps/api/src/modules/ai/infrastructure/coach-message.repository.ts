import { Inject, Injectable } from "@nestjs/common";
import { desc, eq, sql } from "drizzle-orm";
import { CoachMessageRole, type CoachMessageDto, type Paginated } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withUserContext } from "../../../database/rls";
import { coachMessages } from "../../../database/schema";

type SourceChip = { title: string; slug: string; url: string };

type CoachMessageRow = typeof coachMessages.$inferSelect;

function toDto(row: CoachMessageRow): CoachMessageDto {
  return {
    id: row.id,
    role: row.role as CoachMessageRole,
    content: row.content,
    sources: (row.sources as SourceChip[] | null) ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Persisted coach chat history (W3, multi-turn). Single rolling conversation per user — no thread
 * table. All access runs in the user's RLS context (per-user behavioral data, §4 #6 / KVKK).
 */
@Injectable()
export class CoachMessageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Persist one exchange (user message + coach reply) atomically after a successful LLM call. */
  async appendExchange(
    userId: string,
    userContent: string,
    coach: { content: string; model: string; sources: SourceChip[] },
  ): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx.insert(coachMessages).values({
        userId,
        role: CoachMessageRole.USER,
        content: userContent,
      });
      await tx.insert(coachMessages).values({
        userId,
        role: CoachMessageRole.COACH,
        content: coach.content,
        sources: coach.sources,
        model: coach.model,
      });
    });
  }

  /** Last `n` messages in chronological order — the multi-turn prompt window. */
  async lastN(userId: string, n: number): Promise<CoachMessageDto[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(coachMessages)
        .where(eq(coachMessages.userId, userId))
        .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
        .limit(n);
      return rows.reverse().map(toDto);
    });
  }

  /** Paginated history, newest-first (mock-exam/mood list pattern). */
  async listPaged(userId: string, page: number, pageSize: number): Promise<Paginated<CoachMessageDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [rows, totals] = await Promise.all([
        tx
          .select()
          .from(coachMessages)
          .where(eq(coachMessages.userId, userId))
          .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(coachMessages)
          .where(eq(coachMessages.userId, userId)),
      ]);
      return { items: rows.map(toDto), page, pageSize, total: totals[0]?.n ?? 0 };
    });
  }

  /** "Yeni sohbet" — clears the user's own rolling conversation. */
  async clearAll(userId: string): Promise<void> {
    await withUserContext(this.db, { userId }, async (tx) => {
      await tx.delete(coachMessages).where(eq(coachMessages.userId, userId));
    });
  }
}

import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { CoachMessageRole, type CoachMessageDto, type Paginated } from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coachConversations, coachMessages } from "../../../database/schema";

type SourceChip = { title: string; slug: string; url: string };
type SuggestedTask = { title: string; subject: string | null };

/** Cross-user feedback aggregate (admin report). */
export interface FeedbackCounts {
  up: number;
  down: number;
  rated: number;
}

/** A 👎-rated coach reply with the question that prompted it (admin report). */
export interface DownratedReply {
  id: string;
  userId: string;
  question: string | null;
  reply: string;
  createdAt: string;
}

type CoachMessageRow = typeof coachMessages.$inferSelect;

function toDto(row: CoachMessageRow): CoachMessageDto {
  const task = (row.suggestedTask as SuggestedTask | null) ?? null;
  return {
    id: row.id,
    role: row.role as CoachMessageRole,
    content: row.content,
    sources: (row.sources as SourceChip[] | null) ?? [],
    feedback: row.feedback ?? null,
    ...(task ? { suggestedTask: task } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Persisted coach chat history (W3, multi-turn threads). Messages are scoped to a conversation;
 * the prompt window reads one thread, the memory profile reads across threads.
 * All access runs in the user's RLS context (per-user behavioral data, §4 #6 / KVKK).
 */
@Injectable()
export class CoachMessageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Persist one exchange (user message + coach reply) atomically after a successful LLM call, and
   * bump the thread's `last_message_at` in the same tx. Returns the user's total message count
   * (across threads) so the caller can decide whether to refresh the memory profile.
   */
  async appendExchange(
    userId: string,
    conversationId: string,
    userContent: string,
    coach: { content: string; model: string; sources: SourceChip[]; suggestedTask?: SuggestedTask },
  ): Promise<{ totalMessages: number }> {
    return withUserContext(this.db, { userId }, async (tx) => {
      await tx.insert(coachMessages).values({
        userId,
        conversationId,
        role: CoachMessageRole.USER,
        content: userContent,
      });
      await tx.insert(coachMessages).values({
        userId,
        conversationId,
        role: CoachMessageRole.COACH,
        content: coach.content,
        sources: coach.sources,
        model: coach.model,
        suggestedTask: coach.suggestedTask ?? null,
      });
      await tx
        .update(coachConversations)
        .set({ lastMessageAt: new Date() })
        .where(eq(coachConversations.id, conversationId));
      const totals = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(coachMessages)
        .where(eq(coachMessages.userId, userId));
      return { totalMessages: totals[0]?.n ?? 0 };
    });
  }

  /**
   * Regenerate: overwrite the user's own COACH row in place — content/model/sources/suggestedTask
   * replaced, feedback reset (it rated the OLD reply). Row identity and message count are stable.
   */
  async updateCoachReply(
    userId: string,
    messageId: string,
    coach: { content: string; model: string; sources: SourceChip[]; suggestedTask?: SuggestedTask },
  ): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const updated = await tx
        .update(coachMessages)
        .set({
          content: coach.content,
          model: coach.model,
          sources: coach.sources,
          suggestedTask: coach.suggestedTask ?? null,
          feedback: null,
        })
        .where(
          and(
            eq(coachMessages.id, messageId),
            eq(coachMessages.userId, userId),
            eq(coachMessages.role, CoachMessageRole.COACH),
          ),
        )
        .returning({ id: coachMessages.id });
      return updated.length > 0;
    });
  }

  /** Set 👍/👎/none on the user's own COACH message. Returns false when no such row (wrong id/role/owner). */
  async setFeedback(userId: string, messageId: string, feedback: number | null): Promise<boolean> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const updated = await tx
        .update(coachMessages)
        .set({ feedback })
        .where(
          and(
            eq(coachMessages.id, messageId),
            eq(coachMessages.userId, userId),
            eq(coachMessages.role, CoachMessageRole.COACH),
          ),
        )
        .returning({ id: coachMessages.id });
      return updated.length > 0;
    });
  }

  /** Last `n` messages of ONE thread, chronological — the multi-turn prompt window. */
  async lastN(userId: string, conversationId: string, n: number): Promise<CoachMessageDto[]> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const rows = await tx
        .select()
        .from(coachMessages)
        .where(eq(coachMessages.conversationId, conversationId))
        .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
        .limit(n);
      return rows.reverse().map(toDto);
    });
  }

  /** Last `n` messages across ALL threads, chronological — the memory-profile distillation window. */
  async recentForUser(userId: string, n: number): Promise<CoachMessageDto[]> {
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

  /** Paginated history of ONE thread, newest-first (mock-exam/mood list pattern). */
  async listPagedByConversation(
    userId: string,
    conversationId: string,
    page: number,
    pageSize: number,
  ): Promise<Paginated<CoachMessageDto>> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const [rows, totals] = await Promise.all([
        tx
          .select()
          .from(coachMessages)
          .where(eq(coachMessages.conversationId, conversationId))
          .orderBy(desc(coachMessages.createdAt), desc(coachMessages.id))
          .limit(pageSize)
          .offset((page - 1) * pageSize),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(coachMessages)
          .where(eq(coachMessages.conversationId, conversationId)),
      ]);
      return { items: rows.map(toDto), page, pageSize, total: totals[0]?.n ?? 0 };
    });
  }

  /** Cross-user 👍/👎 counts on COACH rows (admin report, SERVICE ctx). */
  async feedbackCounts(): Promise<FeedbackCounts> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          up: sql<number>`count(*) filter (where ${coachMessages.feedback} = 1)::int`,
          down: sql<number>`count(*) filter (where ${coachMessages.feedback} = -1)::int`,
          rated: sql<number>`count(*) filter (where ${coachMessages.feedback} is not null)::int`,
        })
        .from(coachMessages)
        .where(eq(coachMessages.role, CoachMessageRole.COACH));
      return rows[0] ?? { up: 0, down: 0, rated: 0 };
    });
  }

  /**
   * Most recent 👎-rated coach replies with the question that prompted each (admin report, SERVICE
   * ctx). `question` = the latest USER message before the coach row IN THE SAME THREAD (null if none).
   */
  async listDownrated(limit: number): Promise<DownratedReply[]> {
    return withServiceContext(this.db, async (tx) => {
      const u = alias(coachMessages, "u");
      const question = sql<string | null>`(
        select ${u.content} from ${u}
        where ${u.conversationId} = ${coachMessages.conversationId}
          and ${u.role} = ${CoachMessageRole.USER}
          and ${u.createdAt} < ${coachMessages.createdAt}
        order by ${u.createdAt} desc
        limit 1
      )`;
      const rows = await tx
        .select({
          id: coachMessages.id,
          userId: coachMessages.userId,
          reply: coachMessages.content,
          createdAt: coachMessages.createdAt,
          question,
        })
        .from(coachMessages)
        .where(and(eq(coachMessages.role, CoachMessageRole.COACH), eq(coachMessages.feedback, -1)))
        .orderBy(desc(coachMessages.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        userId: r.userId,
        reply: r.reply,
        question: r.question ?? null,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }
}

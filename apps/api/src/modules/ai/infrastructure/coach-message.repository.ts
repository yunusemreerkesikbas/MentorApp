import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  CoachMessageRole,
  type CoachMessageDto,
  type CoachPersonalizationDto,
  type CountdownDto,
  type Paginated,
  type CoachConversationOriginDto,
} from "@mentor/types";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext, withUserContext } from "../../../database/rls";
import { coachConversations, coachMessages } from "../../../database/schema";

type SourceChip = { title: string; slug: string; url: string };
type SuggestedTask = { title: string; subject: string | null };

export type CoachConversationTarget =
  | { kind: "existing"; conversationId: string }
  | { kind: "new"; title: string; origin?: CoachConversationOriginDto };

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
  const countdown = (row.officialCountdown as CountdownDto | null) ?? null;
  const personalization =
    (row.personalizationContext as CoachPersonalizationDto | null) ?? null;
  return {
    id: row.id,
    role: row.role as CoachMessageRole,
    content: row.content,
    sources: (row.sources as SourceChip[] | null) ?? [],
    feedback: row.feedback ?? null,
    ...(task ? { suggestedTask: task } : {}),
    ...(countdown ? { officialCountdown: countdown } : {}),
    ...(personalization ? { personalization } : {}),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Persisted coach chat history (W3, multi-turn threads). Messages are scoped to a conversation;
 * the prompt window reads one thread.
 * All access runs in the user's RLS context (per-user behavioral data, §4 #6 / KVKK).
 */
@Injectable()
export class CoachMessageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Persist a complete exchange; new threads and both messages share one transaction. */
  async persistExchange(
    userId: string,
    target: CoachConversationTarget,
    userContent: string,
    coach: {
      content: string;
      model: string;
      sources: SourceChip[];
      suggestedTask?: SuggestedTask;
      officialCountdown?: CountdownDto;
      personalization?: CoachPersonalizationDto;
    },
  ): Promise<string> {
    return withUserContext(this.db, { userId }, async (tx) => {
      const conversationId =
        target.kind === "existing"
          ? target.conversationId
          : (
              await tx
                .insert(coachConversations)
                .values({
                  userId,
                  title: target.title,
                  originType: target.origin?.type ?? null,
                  originRefId: target.origin?.refId ?? null,
                  originMeta: target.origin?.meta ?? null,
                })
                .returning({ id: coachConversations.id })
            )[0]!.id;

      const userCreatedAt = new Date();
      const coachCreatedAt = new Date(userCreatedAt.getTime() + 1);
      await tx.insert(coachMessages).values([
        {
          userId,
          conversationId,
          role: CoachMessageRole.USER,
          content: userContent,
          createdAt: userCreatedAt,
        },
        {
          userId,
          conversationId,
          role: CoachMessageRole.COACH,
          content: coach.content,
          createdAt: coachCreatedAt,
          sources: coach.sources,
          model: coach.model,
          suggestedTask: coach.suggestedTask ?? null,
          officialCountdown: coach.officialCountdown ?? null,
          personalizationContext: coach.personalization ?? null,
        },
      ]);
      const updated = await tx
        .update(coachConversations)
        .set({ lastMessageAt: coachCreatedAt })
        .where(
          and(
            eq(coachConversations.id, conversationId),
            eq(coachConversations.userId, userId),
          ),
        )
        .returning({ id: coachConversations.id });
      if (updated.length === 0) {
        throw new Error("Coach conversation disappeared during persistence");
      }
      return conversationId;
    });
  }

  /**
   * Regenerate: overwrite the user's own COACH row in place — content/model/sources/suggestedTask
   * replaced, feedback reset (it rated the OLD reply). Row identity and message count are stable.
   */
  async updateCoachReply(
    userId: string,
    messageId: string,
    coach: {
      content: string;
      model: string;
      sources: SourceChip[];
      suggestedTask?: SuggestedTask;
      officialCountdown?: CountdownDto;
      personalization?: CoachPersonalizationDto;
    },
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
          officialCountdown: coach.officialCountdown ?? null,
          personalizationContext: coach.personalization ?? null,
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
  async setFeedback(
    userId: string,
    messageId: string,
    feedback: number | null,
  ): Promise<boolean> {
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
  async lastN(
    userId: string,
    conversationId: string,
    n: number,
  ): Promise<CoachMessageDto[]> {
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
      return {
        items: rows.map(toDto),
        page,
        pageSize,
        total: totals[0]?.n ?? 0,
      };
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
        .where(
          and(
            eq(coachMessages.role, CoachMessageRole.COACH),
            eq(coachMessages.feedback, -1),
          ),
        )
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

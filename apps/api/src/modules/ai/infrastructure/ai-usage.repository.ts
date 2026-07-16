import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { DRIZZLE } from "../../../database/database.constants";
import type { Database } from "../../../database/drizzle";
import { withServiceContext } from "../../../database/rls";
import { aiUsage, users } from "../../../database/schema";

/** Aggregate cost/usage over a time window (admin cost dashboard). */
export interface UsageWindow {
  costMicros: number;
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

export interface ModelUsage extends UsageWindow {
  model: string;
}

export interface FeatureUsage extends UsageWindow {
  feature: string;
}

export interface SpenderUsage {
  userId: string;
  email: string;
  displayName: string;
  costMicros: number;
  calls: number;
}

/** AI usage meter (W3, §7). Append-only token/cost rows (no prompt/reply text, §4 #6). SERVICE ctx. */
@Injectable()
export class AiUsageRepository {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async append(row: {
    userId: string;
    model: string;
    /** AI feature label (chat/vision/...) — drives the admin per-feature cost breakdown. */
    feature: string;
    promptTokens: number;
    completionTokens: number;
    costMicros: number;
  }): Promise<void> {
    await withServiceContext(this.db, async (tx) => {
      await tx.insert(aiUsage).values(row);
    });
  }

  /** Count a user's calls since `since` — drives the premium daily rate-limit. */
  async countSince(userId: string, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aiUsage)
        .where(and(eq(aiUsage.userId, userId), gte(aiUsage.createdAt, since)));
      return rows[0]?.n ?? 0;
    });
  }

  /** Count one feature's calls for a user since `since` — drives per-feature daily caps. */
  async countFeatureSince(userId: string, feature: string, since: Date): Promise<number> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(aiUsage)
        .where(
          and(
            eq(aiUsage.userId, userId),
            eq(aiUsage.feature, feature),
            gte(aiUsage.createdAt, since),
          ),
        );
      return rows[0]?.n ?? 0;
    });
  }

  /** Aggregate cost + calls + tokens across ALL users since `since` (admin cost dashboard, SERVICE ctx). */
  async windowSince(since: Date): Promise<UsageWindow> {
    return withServiceContext(this.db, async (tx) => {
      const rows = await tx
        .select({
          costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int`,
          calls: sql<number>`count(*)::int`,
          promptTokens: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, since));
      return rows[0] ?? { costMicros: 0, calls: 0, promptTokens: 0, completionTokens: 0 };
    });
  }

  /** Per-model cost/calls/tokens since `since`, highest cost first. */
  async byModelSince(since: Date): Promise<ModelUsage[]> {
    return withServiceContext(this.db, async (tx) =>
      tx
        .select({
          model: aiUsage.model,
          costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int`,
          calls: sql<number>`count(*)::int`,
          promptTokens: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, since))
        .groupBy(aiUsage.model)
        .orderBy(desc(sql`sum(${aiUsage.costMicros})`)),
    );
  }

  /** Per-feature cost/calls/tokens since `since`, highest cost first. Pre-labeling rows → "other". */
  async byFeatureSince(since: Date): Promise<FeatureUsage[]> {
    const featureExpr = sql<string>`coalesce(${aiUsage.feature}, 'other')`;
    return withServiceContext(this.db, async (tx) =>
      tx
        .select({
          feature: featureExpr,
          costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int`,
          calls: sql<number>`count(*)::int`,
          promptTokens: sql<number>`coalesce(sum(${aiUsage.promptTokens}), 0)::int`,
          completionTokens: sql<number>`coalesce(sum(${aiUsage.completionTokens}), 0)::int`,
        })
        .from(aiUsage)
        .where(gte(aiUsage.createdAt, since))
        .groupBy(featureExpr)
        .orderBy(desc(sql`sum(${aiUsage.costMicros})`)),
    );
  }

  /** Top spenders since `since` (admin-only PII: email/name), highest cost first. */
  async topSpendersSince(since: Date, limit: number): Promise<SpenderUsage[]> {
    return withServiceContext(this.db, async (tx) =>
      tx
        .select({
          userId: aiUsage.userId,
          email: users.email,
          displayName: users.displayName,
          costMicros: sql<number>`coalesce(sum(${aiUsage.costMicros}), 0)::int`,
          calls: sql<number>`count(*)::int`,
        })
        .from(aiUsage)
        .innerJoin(users, eq(users.id, aiUsage.userId))
        .where(gte(aiUsage.createdAt, since))
        .groupBy(aiUsage.userId, users.email, users.displayName)
        .orderBy(desc(sql`sum(${aiUsage.costMicros})`))
        .limit(limit),
    );
  }
}

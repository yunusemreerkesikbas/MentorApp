import { Injectable } from "@nestjs/common";
import { and, desc, eq, gte, isNotNull, isNull, ne, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { infoArticleDailyViews, infoArticles } from "../../../database/schema";

export type InfoArticleRow = typeof infoArticles.$inferSelect;
export type NewInfoArticle = typeof infoArticles.$inferInsert;

/** One RAG hit (W3): published article ranked by cosine distance to the query embedding. */
export interface SimilarArticleRow {
  id: string;
  slug: string;
  title: string;
  body: string;
  sourceUrl: string;
  distance: number;
}

/** Data access for editorial `info_articles` rows. */
@Injectable()
export class InfoArticleRepository {
  async findBySlug(
    db: Database | DatabaseTx,
    slug: string,
  ): Promise<InfoArticleRow | undefined> {
    const rows = await db.select().from(infoArticles).where(eq(infoArticles.slug, slug)).limit(1);
    return rows[0];
  }

  async listPublishedByFamily(
    db: Database | DatabaseTx,
    family: string,
    page: number,
    pageSize: number,
    filters?: { category?: string; excludeSlug?: string },
  ): Promise<{ items: InfoArticleRow[]; total: number }> {
    const where = and(
      eq(infoArticles.family, family),
      isNotNull(infoArticles.publishedAt),
      filters?.category ? eq(infoArticles.category, filters.category) : undefined,
      filters?.excludeSlug ? ne(infoArticles.slug, filters.excludeSlug) : undefined,
    );
    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(infoArticles)
        .where(where)
        .orderBy(desc(infoArticles.publishedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(infoArticles)
        .where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  async findActiveFeatured(
    db: Database | DatabaseTx,
    family: string,
    now: Date,
  ): Promise<InfoArticleRow | undefined> {
    const rows = await db
      .select()
      .from(infoArticles)
      .where(
        and(
          eq(infoArticles.family, family),
          eq(infoArticles.isFeatured, true),
          isNotNull(infoArticles.publishedAt),
          gte(infoArticles.featuredUntil, now),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async findTrendingByViews(
    db: Database | DatabaseTx,
    family: string,
    sinceDay: string,
  ): Promise<InfoArticleRow | undefined> {
    const viewSum = sql<number>`coalesce(sum(${infoArticleDailyViews.count}), 0)`;
    const rows = await db
      .select({
        article: infoArticles,
        views: sql<number>`${viewSum}::int`,
      })
      .from(infoArticles)
      .leftJoin(
        infoArticleDailyViews,
        and(
          eq(infoArticleDailyViews.articleId, infoArticles.id),
          gte(infoArticleDailyViews.day, sinceDay),
        ),
      )
      .where(
        and(eq(infoArticles.family, family), isNotNull(infoArticles.publishedAt)),
      )
      .groupBy(infoArticles.id)
      .having(sql`${viewSum} > 0`)
      .orderBy(sql`${viewSum} desc`, desc(infoArticles.publishedAt))
      .limit(1);
    return rows[0]?.article;
  }

  async findNewestWithCover(
    db: Database | DatabaseTx,
    family: string,
  ): Promise<InfoArticleRow | undefined> {
    const rows = await db
      .select()
      .from(infoArticles)
      .where(
        and(
          eq(infoArticles.family, family),
          isNotNull(infoArticles.publishedAt),
          isNotNull(infoArticles.coverImageKey),
        ),
      )
      .orderBy(desc(infoArticles.publishedAt))
      .limit(1);
    return rows[0];
  }

  async findNewestPublished(
    db: Database | DatabaseTx,
    family: string,
  ): Promise<InfoArticleRow | undefined> {
    const rows = await db
      .select()
      .from(infoArticles)
      .where(
        and(eq(infoArticles.family, family), isNotNull(infoArticles.publishedAt)),
      )
      .orderBy(desc(infoArticles.publishedAt))
      .limit(1);
    return rows[0];
  }

  async clearFeaturedInFamily(
    tx: DatabaseTx,
    family: string,
    exceptSlug: string,
  ): Promise<void> {
    await tx
      .update(infoArticles)
      .set({ isFeatured: false, featuredUntil: null })
      .where(
        and(
          eq(infoArticles.family, family),
          eq(infoArticles.isFeatured, true),
          ne(infoArticles.slug, exceptSlug),
        ),
      );
  }

  async incrementDailyView(
    tx: DatabaseTx,
    articleId: string,
    day: string,
  ): Promise<void> {
    await tx
      .insert(infoArticleDailyViews)
      .values({ articleId, day, count: 1 })
      .onConflictDoUpdate({
        target: [infoArticleDailyViews.articleId, infoArticleDailyViews.day],
        set: { count: sql`${infoArticleDailyViews.count} + 1` },
      });
  }

  async upsertBySlug(
    tx: DatabaseTx,
    data: NewInfoArticle,
    resetEmbedding = false,
  ): Promise<InfoArticleRow> {
    const rows = await tx
      .insert(infoArticles)
      .values(data)
      .onConflictDoUpdate({
        target: infoArticles.slug,
        set: {
          title: data.title,
          body: data.body,
          bodyFormat: data.bodyFormat,
          family: data.family,
          category: data.category,
          source: data.source,
          sourceUrl: data.sourceUrl,
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
          authorName: data.authorName,
          authorTitle: data.authorTitle,
          authorBio: data.authorBio,
          coverImageKey: data.coverImageKey,
          coverImageAlt: data.coverImageAlt,
          coverImageWidth: data.coverImageWidth,
          coverImageHeight: data.coverImageHeight,
          galleryImages: data.galleryImages,
          isFeatured: data.isFeatured,
          featuredUntil: data.featuredUntil,
          ...(resetEmbedding ? { embedding: null } : {}),
        },
      })
      .returning();
    return rows[0]!;
  }

  /** Admin listing — ALL articles (incl. drafts), optionally filtered by family. */
  async listAll(
    db: Database | DatabaseTx,
    family: string | undefined,
    page: number,
    pageSize: number,
  ): Promise<{ items: InfoArticleRow[]; total: number }> {
    const where = family ? eq(infoArticles.family, family) : undefined;
    const [items, totalRow] = await Promise.all([
      db
        .select()
        .from(infoArticles)
        .where(where)
        .orderBy(desc(infoArticles.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      db.select({ count: sql<number>`count(*)::int` }).from(infoArticles).where(where),
    ]);
    return { items, total: totalRow[0]?.count ?? 0 };
  }

  async setPublishedAt(
    tx: DatabaseTx,
    slug: string,
    publishedAt: Date | null,
  ): Promise<InfoArticleRow | undefined> {
    const rows = await tx
      .update(infoArticles)
      .set({ publishedAt })
      .where(eq(infoArticles.slug, slug))
      .returning();
    return rows[0];
  }

  async findById(db: Database | DatabaseTx, id: string): Promise<InfoArticleRow | undefined> {
    const rows = await db.select().from(infoArticles).where(eq(infoArticles.id, id)).limit(1);
    return rows[0];
  }

  /** Store the RAG embedding (W3 — content owns the column; AI computes the vector). */
  async setEmbedding(tx: DatabaseTx, id: string, embedding: number[]): Promise<void> {
    await tx.update(infoArticles).set({ embedding }).where(eq(infoArticles.id, id));
  }

  /** Published articles still missing an embedding — for the backfill job. */
  async listPublishedWithoutEmbedding(db: Database | DatabaseTx): Promise<{ id: string }[]> {
    return db
      .select({ id: infoArticles.id })
      .from(infoArticles)
      .where(and(isNotNull(infoArticles.publishedAt), isNull(infoArticles.embedding)));
  }

  /**
   * RAG retrieval (W3): published articles in `family` ranked by cosine distance to `vector`
   * (pgvector `<=>`). The vector is bound as a text param cast to `::vector` (no injection — floats).
   */
  async searchSimilar(
    db: Database | DatabaseTx,
    family: string,
    vector: number[],
    topK: number,
  ): Promise<SimilarArticleRow[]> {
    const literal = `[${vector.join(",")}]`;
    const distance = sql<number>`${infoArticles.embedding} <=> ${literal}::vector`;
    return db
      .select({
        id: infoArticles.id,
        slug: infoArticles.slug,
        title: infoArticles.title,
        body: infoArticles.body,
        sourceUrl: infoArticles.sourceUrl,
        distance,
      })
      .from(infoArticles)
      .where(
        and(
          eq(infoArticles.family, family),
          isNotNull(infoArticles.publishedAt),
          isNotNull(infoArticles.embedding),
        ),
      )
      .orderBy(distance)
      .limit(topK);
  }
}

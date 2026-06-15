import { Injectable } from "@nestjs/common";
import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import type { Database, DatabaseTx } from "../../../database/drizzle";
import { infoArticles } from "../../../database/schema";

export type InfoArticleRow = typeof infoArticles.$inferSelect;
export type NewInfoArticle = typeof infoArticles.$inferInsert;

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
  ): Promise<{ items: InfoArticleRow[]; total: number }> {
    const where = and(eq(infoArticles.family, family), isNotNull(infoArticles.publishedAt));
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

  async upsertBySlug(tx: DatabaseTx, data: NewInfoArticle): Promise<InfoArticleRow> {
    const rows = await tx
      .insert(infoArticles)
      .values(data)
      .onConflictDoUpdate({
        target: infoArticles.slug,
        set: {
          title: data.title,
          body: data.body,
          family: data.family,
          category: data.category,
          source: data.source,
          sourceUrl: data.sourceUrl,
          verifiedAt: data.verifiedAt,
          verifiedBy: data.verifiedBy,
          metaTitle: data.metaTitle,
          metaDescription: data.metaDescription,
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
}

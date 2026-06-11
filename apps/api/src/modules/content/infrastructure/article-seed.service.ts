import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ContentService } from "../application/content.service";

interface SeedArticle {
  slug: string;
  title: string;
  body: string;
  family: string;
  category: string;
  source: string;
  sourceUrl: string;
  verifiedAt: string;
  verifiedBy: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  publishedAt: string;
}

interface SeedFile {
  articles: SeedArticle[];
}

/**
 * Loads editorial knowledge-center seed on startup (idempotent upserts + publish).
 */
@Injectable()
export class ArticleSeedService implements OnModuleInit {
  private readonly logger = new Logger(ArticleSeedService.name);

  constructor(private readonly content: ContentService) {}

  async onModuleInit(): Promise<void> {
    try {
      const path = resolve(__dirname, "../seed/articles.seed.json");
      const raw = readFileSync(path, "utf8");
      const data = JSON.parse(raw) as SeedFile;

      for (const article of data.articles) {
        await this.content.upsertArticle({
          slug: article.slug,
          title: article.title,
          body: article.body,
          family: article.family,
          category: article.category,
          source: article.source,
          sourceUrl: article.sourceUrl,
          verifiedAt: article.verifiedAt,
          verifiedBy: article.verifiedBy,
          metaTitle: article.metaTitle ?? null,
          metaDescription: article.metaDescription ?? null,
        });
        await this.content.publishArticle(article.slug, article.publishedAt);
      }

      this.logger.log(`Knowledge-center seed applied (${data.articles.length} articles).`);
    } catch (err) {
      this.logger.error("Knowledge-center seed failed — articles empty until fixed.", err);
    }
  }
}
